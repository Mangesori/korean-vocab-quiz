// 퀴즈 유형별 score/total 컬럼을 가진 부분 타입
export interface CombinableResult {
  score: number;
  total_questions: number;
  fill_blank_score: number | null;
  fill_blank_total: number | null;
  matchup_score: number | null;
  matchup_total: number | null;
  type_answer_score: number | null;
  type_answer_total: number | null;
  word_magnet_score: number | null;
  word_magnet_total: number | null;
  sentence_making_score: number | null;
  sentence_making_total: number | null;
  recording_score: number | null;
  recording_total: number | null;
}

/**
 * 여러 퀴즈 유형의 점수를 합산한 원자값을 반환한다.
 * 빈칸이 실제로 퀴즈에 포함된 경우(fill_blank_total > 0)에만 fill_blank 폴백(전체 집계값 score/total_questions)을 사용한다.
 * fill_blank_total이 null/0이면 빈칸 미포함으로 간주하고 result.score 폴백을 쓰지 않는다.
 */
export function getCombinedScore(r: CombinableResult): { score: number; total: number } {
  const hasFillBlank = (r.fill_blank_total ?? 0) > 0;
  const fillBlankScore = hasFillBlank ? (r.fill_blank_score ?? r.score) : 0;
  const fillBlankTotal = hasFillBlank ? (r.fill_blank_total ?? r.total_questions) : 0;
  const score =
    fillBlankScore +
    (r.matchup_score ?? 0) +
    (r.type_answer_score ?? 0) +
    (r.word_magnet_score ?? 0) +
    (r.sentence_making_score ?? 0) +
    (r.recording_score ?? 0);
  const total =
    fillBlankTotal +
    (r.matchup_total ?? 0) +
    (r.type_answer_total ?? 0) +
    (r.word_magnet_total ?? 0) +
    (r.sentence_making_total ?? 0) +
    (r.recording_total ?? 0);
  return { score, total };
}

export function getCombinedPercent(r: CombinableResult): number {
  const { score, total } = getCombinedScore(r);
  return total > 0 ? (score / total) * 100 : 0;
}
