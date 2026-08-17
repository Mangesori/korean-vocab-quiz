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
  /** import = 사람이 검수한 문장, quiz = AI 퀴즈에서 자동 수집한 문장. */
  source?: string;
}

/**
 * 6개 복습 유형(stage 0~5) 중 실제로 "문장"을 화면에 쓰는 유형만, 진행 순서대로.
 * (0 짝맞추기·1 단어받아쓰기·4 문장만들기는 단어/뜻만 쓰고 문장을 안 보여준다 —
 * reviewTypeAssignment.ts의 STAGE_TO_FORMAT과 각 Stage 컴포넌트가 쓰는 필드 참고.)
 * 문장 회전(원본→은행1→은행2→...)은 이 세 스테이지 차례로만 세야 한다 — stage
 * 번호를 그대로 쓰면 안 쓰이는 stage에 슬롯이 낭비되어 은행 문장 일부가 화면에
 * 영영 안 뜨는 문제가 있었다(예: 은행 문장이 2개면 은행 1번째가 stage 1·4에만
 * 배정되는데 그 두 stage 다 문장을 안 쓴다).
 */
const SENTENCE_CONSUMING_STAGES = [2, 3, 5] as const; // 빈칸 채우기, 문장 순서 맞추기, 말하기

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

  // 검수 문장(import)을 먼저 쓰고 모자랄 때만 AI 수집분(quiz)으로 넘어간다.
  // 서버의 get_due_review_items ORDER BY와 같은 순서여야 한다.
  const rank = (c: BankSentence) => (c.source === "quiz" ? 1 : 0);
  const pool = candidates
    .filter((c) => c.level === useLevel)
    .sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);

  if (pool.length === 0) return null;

  // 문장을 쓰는 3개 스테이지(2·3·5) 안에서의 순번(0·1·2)으로 순환시킨다.
  // 문장을 안 쓰는 stage(0·1·4)가 들어오면 결과가 안 쓰이니 0으로 둔다.
  const exposureIndex = SENTENCE_CONSUMING_STAGES.indexOf(stage as 2 | 3 | 5);
  const cycleIndex = exposureIndex === -1 ? 0 : exposureIndex;
  const slot = cycleIndex % (pool.length + 1);
  return slot === 0 ? null : (pool[slot - 1] ?? null);
}
