import { FunctionsError, FunctionsHttpError } from '@supabase/supabase-js';

// 서버가 보낸 한국어 문구를 사용자에게 실제로 보여주기 위한 헬퍼들.
// 경로가 둘이라 꺼내는 방법도 둘이다:
//
//  1) 엣지 함수(functions.invoke) — non-2xx면 data=null, error=FunctionsHttpError인데
//     error.message가 "Edge Function returned a non-2xx status code"라는 영문 일반 문구다.
//     한국어는 error.context(= Response)의 JSON body { error: "..." } 안에 있어 따로 읽어야 한다.
//
//  2) 직접 INSERT(PostgREST) — 트리거의 RAISE EXCEPTION 메시지는 error.message로 그대로 온다.
//     다만 그 외 DB 에러의 message는 영문 Postgres 문구라 그대로 띄우면 안 된다. SQLSTATE로 가른다.

export interface EdgeFunctionError {
  /** 엣지 함수가 본문에 담아 보낸 한국어 문구. 못 읽으면 fallback. */
  message: string;
  /** HTTP 상태. 네트워크 실패 등 응답 자체가 없으면 null. 한도 초과는 429. */
  status: number | null;
}

/** 퀴즈 생성 한도 초과. generate-quiz 사전 체크가 이 상태로 준다. */
const QUOTA_EXCEEDED_STATUS = 429;

/**
 * quizzes 한도 트리거(enforce_quiz_quota)가 쓰는 SQLSTATE.
 * 'PT429' = 한도 소진(PostgREST가 HTTP 429로 매핑), 'P0001' = 한도를 알 수 없어 막힘.
 * supabase/migrations/20260716000000_add_plan_limits_and_quota_trigger.sql 참고.
 */
const QUOTA_TRIGGER_SQLSTATES = ['PT429', 'P0001'];

/**
 * functions.invoke가 준 error에서 사용자에게 보여줄 한국어 문구와 HTTP 상태를 꺼낸다.
 * 본문을 못 읽으면(비-JSON 응답, 네트워크 실패 등) fallback을 쓴다.
 *
 * error.context는 Response라 body를 한 번만 읽을 수 있다. 같은 error 객체로 두 번 부르지 말 것.
 */
export async function readEdgeFunctionError(
  error: unknown,
  fallback: string
): Promise<EdgeFunctionError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response | undefined;
    const status = typeof response?.status === 'number' ? response.status : null;

    try {
      const body = await response!.json();
      const message = typeof body?.error === 'string' ? body.error.trim() : '';
      return { message: message || fallback, status };
    } catch {
      // 본문이 JSON이 아니거나 이미 읽힌 경우.
      return { message: fallback, status };
    }
  }

  // FunctionsFetchError/FunctionsRelayError는 message가 영문 내부 문구라 그대로 못 쓴다.
  if (error instanceof FunctionsError) {
    return { message: fallback, status: null };
  }

  // 함수가 200으로 { error } 를 줘서 호출부가 직접 Error로 감싼 경우 등.
  // 이땐 message가 이미 사용자에게 보여줄 만한 문구다.
  if (error instanceof Error && error.message) {
    return { message: error.message, status: null };
  }

  return { message: fallback, status: null };
}

/** 이 엣지 함수 에러가 퀴즈 생성 한도 초과인가. */
export function isQuotaExceeded(error: EdgeFunctionError): boolean {
  return error.status === QUOTA_EXCEEDED_STATUS;
}

/**
 * quizzes INSERT 실패를 사용자에게 보여줄 문구로 바꾼다.
 *
 * 한도 트리거가 던진 메시지는 이미 한국어 완성 문장이라 그대로 쓴다. 그 외 DB 에러
 * (RLS 위반, 제약 위반 등)는 message가 영문 Postgres 문구라 fallback으로 덮는다.
 * quizzes에 INSERT하는 경로에서만 쓸 것 — 다른 테이블의 P0001까지 통과시키지 않기 위해서다.
 */
export function quizInsertErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && QUOTA_TRIGGER_SQLSTATES.includes(code)) {
    const message = error instanceof Error ? error.message.trim() : '';
    if (message) return message;
  }
  return fallback;
}
