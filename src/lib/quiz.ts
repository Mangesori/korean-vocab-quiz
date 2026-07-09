// 퀴즈 공통 유틸

// B1 이상 난이도 여부 — 말하기 연습/문장 순서 맞추기에서 빈칸 채우기와 다른
// 짧은 문장(short_sentence)을 사용할지 판단하는 게이트.
export const isShortSentenceLevel = (d?: string) =>
  ["B1", "B2", "C1", "C2"].includes(d ?? "");
