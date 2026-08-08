/**
 * 간격 반복 복습의 클라이언트 쪽 상수와 문장 회전 규칙.
 *
 * 서버(supabase/migrations/20260808000000_add_spaced_repetition.sql,
 * 20260808010000_add_sentence_bank.sql)와 **같은 규칙을 유지해야 한다**.
 * 여기 숫자나 순환 방식을 고치면 get_due_review_items도 같이 고칠 것.
 */

/** stage N을 통과한 뒤 기다리는 날수. stage가 MASTER_STAGE에 닿으면 졸업. */
export const STAGE_INTERVAL_DAYS = [1, 3, 7, 16, 35, 90] as const;

/** 이 단계에 도달하면 마스터(총 152일). */
export const MASTER_STAGE = 6;

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
 * 이번 복습에서 쓸 문장을 고른다.
 *
 * 순환은 [원본, 은행1, 은행2, ...] 순이다. 0번 자리가 선생님이 보낸 원본 퀴즈
 * 문장인 이유는 두 가지다 — 은행에 그 단어가 없어도 복습이 되어야 하고,
 * 첫 복습은 배운 그대로 확인하는 게 자연스럽다.
 *
 * ★ 레벨은 올라가지 않는다.
 *   단계가 오를수록 레벨도 올리면(35일=B1) A1 학생이 "-는데도" 같은 문법에서
 *   틀린다. 단어를 잊어서가 아니라 문법을 몰라서 틀리는 것이라, 복습이 재려던
 *   것(그 단어를 기억하나)이 오염된다. 난이도는 선생님이 더 높은 난이도 퀴즈에
 *   그 단어를 다시 낼 때 올라간다(wrong_answer_progress.level).
 *
 * @returns null이면 "원본 퀴즈 문장을 그대로 쓰라"는 뜻.
 */
export function pickRotatedSentence(
  candidates: BankSentence[],
  stage: number,
  level: string | null
): BankSentence | null {
  if (candidates.length === 0) return null;

  // 레벨이 아직 정해지지 않은 단어는 은행에 있는 가장 쉬운 레벨로 대신한다.
  // (A1 < A2 < B1 < B2 < C1 < C2 이므로 문자열 정렬이 난이도 순과 같다.)
  const useLevel =
    level ?? [...candidates].sort((a, b) => a.level.localeCompare(b.level))[0].level;

  const pool = candidates
    .filter((c) => c.level === useLevel)
    .sort((a, b) => a.seq - b.seq);

  if (pool.length === 0) return null;

  // 주기 = 원본 1개 + 은행 문장 수.
  const slot = ((stage % (pool.length + 1)) + pool.length + 1) % (pool.length + 1);
  return slot === 0 ? null : (pool[slot - 1] ?? null);
}
