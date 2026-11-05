/**
 * 빈칸 채우기 문장의 "완성 문장"과 말하기 문장 비교 규칙.
 * 학생 화면(QuizTake)과 편집 화면(RecordingProblemList)이 같은 규칙을 써야
 * 엉뚱한 문장의 음성을 대신 트는 일이 없다.
 */

/** 끝 문장부호 정리 + 앞뒤 공백 제거 */
export function cleanSentenceEnding(text: string): string {
  return text
    .replace(/([.?!])\s*\.+\s*$/, "$1")
    .replace(/\.\s*\.$/, ".")
    .trim();
}

/** `( )` 빈칸을 정답으로 채운 완성 문장 */
export function fillBlankSentence(sentence: string, answer: string): string {
  return cleanSentenceEnding(sentence.replace(/\(\s*\)|\(\)/g, answer));
}

/**
 * 말하기 문장이 빈칸 채우기 완성 문장과 정확히 같을 때만 true.
 * 이때만 빈칸 채우기 음성을 말하기 음성 대신 써도 된다.
 */
export function isSameAsFilledSentence(
  recordingSentence: string | null | undefined,
  fillBlankSentenceText: string | null | undefined,
  answer: string | null | undefined,
): boolean {
  if (!recordingSentence || !fillBlankSentenceText || !answer) return false;
  return cleanSentenceEnding(recordingSentence) === fillBlankSentence(fillBlankSentenceText, answer);
}
