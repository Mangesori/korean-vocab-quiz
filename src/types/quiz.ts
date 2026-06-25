export interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  meaning?: string; // 단어(기본형)의 짧은 뜻 — 매치업/문장만들기 뜻 칸에 사용
}

export interface SentenceMakingProblem {
  problem_id: string;
  word: string;
  word_meaning: string;
  model_answer: string;
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
  type_answer: "뜻 보고 단어 쓰기",
  fill_blank: "빈칸 채우기",
  word_magnet: "문장 순서 맞추기",
  sentence_making: "문장 만들기",
  recording: "말하기 연습",
};

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
}
