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
