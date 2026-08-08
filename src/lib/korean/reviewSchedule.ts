/**
 * 간격 반복 복습의 클라이언트 쪽 상수와 문장 선택 규칙.
 *
 * 서버(supabase/migrations/20260808000000_add_spaced_repetition.sql,
 * 20260808010000_add_sentence_bank.sql)와 **같은 값을 유지해야 한다**.
 * 여기 숫자를 고치면 마이그레이션의 _intervals와 get_due_review_items의
 * want_level/want_seq도 같이 고칠 것.
 */

/** stage N을 통과한 뒤 기다리는 날수. stage가 MASTER_STAGE에 닿으면 졸업. */
export const STAGE_INTERVAL_DAYS = [1, 3, 7, 16, 35, 90] as const;

/** 이 단계에 도달하면 마스터(총 152일). */
export const MASTER_STAGE = 6;

/**
 * 단계별로 보여줄 문장의 자리.
 *
 * 간격이 길어질수록 문법도 어려워지도록 레벨을 함께 올린다. 35일 뒤에는 B1 문법
 * 안에 들어 있는 그 단어를 만나야 하므로, 문장을 통째로 외우는 방식으로는
 * 통과할 수 없다.
 */
export function sentenceSlotForStage(stage: number): { level: string; seq: number } {
  if (stage <= 0) return { level: "A1", seq: 1 };
  if (stage === 1) return { level: "A1", seq: 2 };
  if (stage === 2) return { level: "A2", seq: 1 };
  if (stage === 3) return { level: "A2", seq: 2 };
  return { level: "B1", seq: 1 }; // stage 4, 5 (35일·90일)
}

/** 문장 은행 한 줄 중 문장 선택에 필요한 부분만. */
export interface BankSentence {
  word: string;
  level: string;
  seq: number;
  sentence: string;
  answer: string;
  hint: string | null;
  translation: string | null;
  meaning: string | null;
}

/**
 * 그 단계에 맞는 문장을 고른다.
 *
 * 원하는 (레벨, 순서)가 은행에 없을 수 있다 — 선생님이 A1만 넣었는데 학생이
 * 35일 단계까지 올라간 경우 등. 그럴 땐 같은 레벨의 다른 순서 → 아무 문장 순으로
 * 물러선다. 아무것도 없으면 null을 돌려주고, 호출 쪽이 기존 방식(학생이 틀린
 * 문제에서 문장 가져오기)을 그대로 쓰게 한다.
 */
export function pickSentenceForStage(
  candidates: BankSentence[],
  stage: number
): BankSentence | null {
  if (candidates.length === 0) return null;

  const want = sentenceSlotForStage(stage);

  return (
    candidates.find((c) => c.level === want.level && c.seq === want.seq) ??
    candidates.find((c) => c.level === want.level) ??
    // 레벨 문자열 정렬(A1 < A2 < B1 < B2 < C1 < C2)이 난이도 순과 같아 그대로 쓴다.
    [...candidates].sort((a, b) => a.level.localeCompare(b.level) || a.seq - b.seq)[0] ??
    null
  );
}
