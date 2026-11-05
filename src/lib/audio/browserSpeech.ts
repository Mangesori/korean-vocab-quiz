/**
 * 서버 음성이 아직 없을 때 쓰는 브라우저 내장 음성(Web Speech API).
 * 한국어 음성이 없는 기기도 있으므로 실패를 돌려준다.
 */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function findKoreanVoice(): SpeechSynthesisVoice | undefined {
  if (!isSpeechSynthesisSupported()) return undefined;
  return window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ko"));
}

/** getVoices()는 처음에 빈 배열일 수 있어 voiceschanged를 잠깐 기다린다. */
export function loadKoreanVoice(timeoutMs = 1500): Promise<SpeechSynthesisVoice | undefined> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve(undefined);
  const found = findKoreanVoice();
  if (found || window.speechSynthesis.getVoices().length > 0) return Promise.resolve(found);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(findKoreanVoice());
    };
    const timer = setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

/**
 * 문장을 한국어로 읽는다. 끝까지 읽으면 true, 재생할 수 없으면 false.
 * 한국어 음성이 목록에 없어도 lang만으로 시도해 보고, 오류가 나면 false.
 */
export async function speakKorean(
  text: string,
  options: { rate?: number; onStart?: () => void } = {},
): Promise<boolean> {
  if (!isSpeechSynthesisSupported() || !text.trim()) return false;
  const voice = await loadKoreanVoice();
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = options.rate ?? 1;
    if (voice) utter.voice = voice;
    let started = false;
    utter.onstart = () => {
      started = true;
      options.onStart?.();
    };
    utter.onend = () => resolve(started || !!voice);
    utter.onerror = (e) => {
      // 다른 재생으로 끊긴 경우는 실패로 보지 않는다.
      resolve(e.error === "interrupted" || e.error === "canceled");
    };
    synth.speak(utter);
  });
}
