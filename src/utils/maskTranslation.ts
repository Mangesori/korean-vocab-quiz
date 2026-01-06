/**
 * 대괄호로 감싸진 부분을 _____로 변환
 * 예: "I am [a student]" → "I am _______"
 */
export function maskTranslation(translation: string): string {
  if (!translation) return translation;
  
  return translation.replace(/\[[^\]]+\]/g, (match) => {
    const length = match.length - 2; // 대괄호 제외
    return '_'.repeat(Math.max(5, length));
  });
}

/**
 * 대괄호 제거하여 완전한 번역 반환
 * 예: "I am [a student]" → "I am a student"
 */
export function unmaskTranslation(translation: string): string {
  if (!translation) return translation;
  
  return translation.replace(/[\[\]]/g, '');
}
