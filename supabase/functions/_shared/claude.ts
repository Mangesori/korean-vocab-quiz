// generate-quiz와 grade-sentence가 공유하는 Claude Messages API 호출 헬퍼.
//
// 왜 만들었나: 두 함수가 각자 raw fetch로 https://api.anthropic.com/v1/messages를
// 호출하며 재시도 로직 없이(429/5xx가 그대로 실패), 마크다운 코드펜스를 정규식으로
// 벗겨내는 동일한 코드를 중복으로 갖고 있었다. 이 파일이 그 공통 로직의 단일 원본이다.
//
// 구조화된 출력(output_config.format): claude-sonnet-5가 지원함을 Anthropic 공식
// 문서로 확인했다("Supported models: Claude Fable 5, Claude Opus 5, Claude Opus 4.8,
// Claude Sonnet 5, and Claude Haiku 4.5"). outputSchema를 넘기면 모델이 마크다운 펜스
// 없이 스키마를 따르는 JSON을 직접 반환한다. 원문(raw HTTP) 요청 바디 형태:
//   output_config: { effort, format: { type: "json_schema", schema: {...} } }
// (SDK의 zodOutputFormat()이 내부적으로 만드는 값과 같은 형태 — C# SDK의
// JsonOutputFormat { Type: "json_schema" (자동), Schema } 문서로 wire shape를 교차 확인함.)
//
// 스키마 제약(Anthropic 문서): 모든 object에 additionalProperties: false 필요,
// minLength/maxLength·min/maximum·재귀 스키마는 미지원.

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeJsonSchemaFormat {
  type: "json_schema";
  schema: Record<string, unknown>;
}

export interface CallClaudeOptions {
  model?: string;
  maxTokens: number;
  effort?: ClaudeEffort;
  system?: string;
  /** 지정하지 않으면 타임아웃 없이 대기(AbortController 미사용). */
  timeoutMs?: number;
  /** 지정하면 output_config.format으로 구조화된 출력을 요청한다. */
  outputSchema?: ClaudeJsonSchemaFormat;
}

export interface ClaudeCallResult {
  /**
   * 응답 텍스트. outputSchema를 지정했으면 스키마를 따르는 JSON 문자열이라
   * 마크다운 스트립 없이 바로 JSON.parse 가능하다(정상 동작 시).
   */
  text: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  stopReason?: string;
  blockTypes?: string[];
}

export class ClaudeApiError extends Error {
  /** HTTP 상태. 네트워크 실패·타임아웃 등 응답 자체가 없으면 null. */
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

const DEFAULT_MODEL = "claude-sonnet-5";
// 429/5xx만 재시도한다. 4xx(429 제외)는 요청 자체가 잘못된 것이라 재시도해도 똑같이 실패한다.
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function statusMessage(status: number): string {
  // 429는 사용자에게 그대로 보여줄 수 있는 한국어 문구. 그 외는 내부 진단용 영문 메시지
  // (호출부가 필요하면 자기 한국어 문구로 감싼다 — 지금까지도 그렇게 해왔다).
  return status === 429
    ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
    : `Claude API error: ${status}`;
}

/**
 * 구조화된 출력을 안 쓸 때(또는 실패했을 때)를 위한 마크다운 코드펜스 스트립 폴백.
 * 구조화된 출력 도입 전 두 함수가 각자 쓰던 로직 그대로다 — 구조화된 출력이 실패하거나
 * 되돌려야 할 경우를 대비해 지우지 않고 남겨둔다.
 */
export function stripMarkdownJsonFence(raw: string): string {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }
  return jsonStr;
}

/**
 * Claude Messages API를 호출한다.
 * - 429/5xx는 지수 백오프(500ms, 1000ms)로 최대 2회 재시도한다.
 * - 그 외 4xx는 즉시 실패한다.
 * - 실패 시 ClaudeApiError를 던진다. status가 429면 message는 사용자에게 그대로
 *   보여줘도 되는 한국어 문구다.
 */
export async function callClaude(
  prompt: string,
  options: CallClaudeOptions,
): Promise<ClaudeCallResult> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new ClaudeApiError("ANTHROPIC_API_KEY is not configured", null);
  }

  const {
    model = DEFAULT_MODEL,
    maxTokens,
    effort = "medium",
    system,
    timeoutMs,
    outputSchema,
  } = options;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    let response: Response;
    try {
      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        // temperature는 넣지 말 것 — Sonnet 5는 기본값이 아닌 sampling 파라미터를 400으로 거부한다.
        output_config: outputSchema ? { effort, format: outputSchema } : { effort },
        messages: [{ role: "user", content: prompt }],
      };
      if (system) body.system = system;

      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      // 네트워크 실패·타임아웃(AbortError) 등 — HTTP 상태 자체가 없다. 재시도하지 않는다
      // (같은 이유로 다시 실패할 확률이 높고, 이미 타임아웃까지 기다린 뒤라 추가 대기는 손해다).
      throw new ClaudeApiError(
        error instanceof Error ? error.message : "Claude API 호출에 실패했습니다.",
        null,
      );
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);

      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      throw new ClaudeApiError(statusMessage(response.status), response.status);
    }

    const data = await response.json();
    // adaptive thinking이 켜지면 content[0]이 thinking 블록일 수 있다.
    // 인덱스로 집지 말고 type === "text"인 블록을 찾아야 한다.
    const content = data.content?.find(
      (block: { type?: string; text?: string }) => block?.type === "text",
    )?.text;

    if (!content) {
      throw new ClaudeApiError("No content received from AI", null);
    }

    return {
      text: content,
      usage: data.usage,
      stopReason: data.stop_reason,
      blockTypes: data.content?.map((b: { type?: string }) => b?.type),
    };
  }

  // 루프는 항상 return이나 throw로 끝난다 — 여기 도달하면 안 되지만 타입 체커를 위해 남긴다.
  throw new ClaudeApiError("Claude API 호출에 실패했습니다.", null);
}
