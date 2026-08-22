export interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  meaning?: string; // 단어(기본형)의 짧은 뜻 — 매치업/문장만들기 뜻 칸에 사용
  // B1+ 난이도에서 말하기 연습/문장 순서 맞추기에 쓰는, 빈칸 채우기와 다른
  // 짧은(≤25자) 완성형 문장과 그 번역. 없으면 빈칸 채우기 문장에서 파생(폴백).
  short_sentence?: string;
  short_translation?: string;
  // 문장 순서 맞추기 전용으로 독립적으로 재생성된 문장(있으면 이걸 우선 사용,
  // 없으면 빈칸 채우기 문장에서 그대로 파생). "문제 재생성" 버튼으로 설정됨.
  word_magnet_sentence?: string;
  word_magnet_translation?: string;
}

export interface SentenceMakingProblem {
  problem_id: string;
  word: string;
  word_meaning: string;
  model_answer: string;
}

/**
 * 문장 만들기 채점이 찾아낸 오류 한 건.
 *
 * 채점 기준은 supabase/functions/grade-sentence/GRADING-CRITERIA.md 참조.
 * 심각도가 그대로 감점(major −12 / minor −5)이 되므로, 오류 1건은
 * "학생이 저지른 실수 1개"여야 한다. 하나의 실수에서 파생된 부작용을
 * 따로 세면 점수가 그만큼 틀어진다.
 *
 * 목표 단어 오용·결합 오류·문장 의미 붕괴는 여기 들어가지 않는다.
 * 그건 감점이 아니라 즉시 불합격 사유라 별도 필드로 온다.
 */
export type GradedErrorSeverity = 'major' | 'minor';

export interface GradedError {
  text: string;
  severity: GradedErrorSeverity;
}

export interface MatchupProblem {
  problem_id: string;
  korean_text: string;
  meaning_text: string;
}

export interface TypeAnswerProblem {
  problem_id: string;
  prompt: string; // 뜻
  answer: string; // 한국어 단어(기본형)
}

export interface WordMagnetItemData {
  content: string;
  isParticle: boolean;
}

export interface WordMagnetProblem {
  problem_id: string;
  base_text: string; // 정답 완성 문장
  translation: string; // 프롬프트(번역)
  items: WordMagnetItemData[];
}

export interface RecordingProblem {
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  translation: string;
  label?: string;
}

// 퀴즈 스테이지 정규 순서 — QuizCreate 카드, QuizPreview 스테퍼, QuizTake 진행 모두 이 순서를 따른다.
// 내부 키는 그대로 두고 표시 이름만 STAGE_LABELS로 관리.
export type BaseStage =
  | "matchup"
  | "type_answer"
  | "fill_blank"
  | "word_magnet"
  | "sentence_making"
  | "recording";

export const STAGE_ORDER: BaseStage[] = [
  "matchup",
  "type_answer",
  "fill_blank",
  "word_magnet",
  "sentence_making",
  "recording",
];

export const STAGE_LABELS: Record<BaseStage, string> = {
  matchup: "짝 맞추기",
  type_answer: "단어 받아쓰기",
  fill_blank: "빈칸 채우기",
  word_magnet: "문장 순서 맞추기",
  sentence_making: "문장 만들기",
  recording: "말하기 연습",
};

// 좁은 배지·칩처럼 STAGE_LABELS가 줄바꿈될 만한 자리에서만 쓰는 축약 라벨.
// 넓은 자리(카드 제목, 스테퍼 등)는 계속 STAGE_LABELS를 쓴다.
export const STAGE_SHORT_LABELS: Record<BaseStage, string> = {
  matchup: "짝맞추기",
  type_answer: "받아쓰기",
  fill_blank: "빈칸",
  word_magnet: "문장순서",
  sentence_making: "문장",
  recording: "말하기",
};

// 오답 집계 RPC가 반환하는 유형만 좁힌 타입.
// 문장 만들기·말하기 연습은 AI 채점(부분 점수)이라 오답 집계 대상이 아니다.
export type WrongAnswerSource = Extract<
  BaseStage,
  "fill_blank" | "matchup" | "type_answer" | "word_magnet"
>;

// 각 스테이지의 활성 여부가 저장된 quizzes 테이블 실제 컬럼명.
// (src/integrations/supabase/types.ts의 quizzes Row 정의와 일치해야 한다.)
export const STAGE_ENABLED_KEY: Record<BaseStage, string> = {
  matchup: "matchup_enabled",
  type_answer: "type_answer_enabled",
  fill_blank: "fill_blank_enabled",
  word_magnet: "word_magnet_enabled",
  sentence_making: "sentence_making_enabled",
  recording: "recording_enabled",
};

// 스테이지 활성 판정. 반드시 이 헬퍼를 거쳐서 판정할 것.
//
// 왜 fill_blank만 다른가: fill_blank_enabled는 DB DEFAULT가 true이고
// 나머지 5개 컬럼은 DEFAULT가 false다. 빈칸 채우기는 원래 유일한 퀴즈 유형이라
// 컬럼이 나중에 추가됐고, 기존 행이 전부 활성으로 남아야 했기 때문.
// 그래서 fill_blank는 "명시적으로 false가 아니면 활성"(!== false)이고,
// 나머지는 "명시적으로 true여야 활성"(truthy)이다. 호출부마다 이 차이를
// 다시 구현하면 틀리기 쉬워서 여기서 한 번만 처리한다.
export function isStageEnabled(stage: BaseStage, quiz: Record<string, unknown>): boolean {
  const value = quiz[STAGE_ENABLED_KEY[stage]];
  if (stage === "fill_blank") return value !== false;
  return Boolean(value);
}

// 스테이지 → quiz_results의 점수 컬럼. StudentDashboard/TeacherDashboard/Quizzes의
// "완료" 판정이 화면마다 다르면 학생 쪽엔 진행 중인데 선생님 쪽엔 미제출로 보인다 —
// 반드시 이 매핑을 거쳐서 판정할 것.
export const STAGE_SCORE_KEY: Record<BaseStage, string> = {
  matchup: "matchup_score",
  type_answer: "type_answer_score",
  fill_blank: "fill_blank_score",
  word_magnet: "word_magnet_score",
  sentence_making: "sentence_making_score",
  recording: "recording_score",
};

export function stageScore(result: Record<string, unknown>, stage: BaseStage): number | null {
  const value = result[STAGE_SCORE_KEY[stage]];
  return typeof value === "number" ? value : null;
}

/** 결과 한 건 기준으로, 해당 퀴즈의 활성 스테이지가 전부 채점됐는지. */
export function isResultComplete(quiz: Record<string, unknown>, result: Record<string, unknown>): boolean {
  return STAGE_ORDER.every((stage) => !isStageEnabled(stage, quiz) || stageScore(result, stage) !== null);
}

export interface QuizDraft {
  title: string;
  words: string[];
  difficulty: string;
  translationLanguage: string;
  wordsPerSet: number;
  timerEnabled: boolean;
  timerSeconds: number | null;
  problems: Problem[];
  fillBlankEnabled?: boolean;
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  matchupEnabled?: boolean;
  typeAnswerEnabled?: boolean;
  wordMagnetEnabled?: boolean;
  sentenceMakingProblems?: SentenceMakingProblem[];
  recordingProblems?: RecordingProblem[];
  matchupProblems?: MatchupProblem[];
  typeAnswerProblems?: TypeAnswerProblem[];
  wordMagnetProblems?: WordMagnetProblem[];
  ttsProvider?: "azure" | "elevenlabs";
}
