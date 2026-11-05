// TTS 공급자 호출 공용 모듈.
// elevenlabs-tts / azure-tts 함수와 같은 모델·음성·출력 형식을 쓴다
// (두 함수는 아직 이 모듈을 쓰지 않는다 — 바꾸면 재배포 대상에 넣을 것).
// 키·비밀은 로그에 남기지 않는다.

export type TtsProvider = "elevenlabs" | "azure";

export const ELEVENLABS_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
export const ELEVENLABS_MODEL_ID = "eleven_v3";
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

export const AZURE_DEFAULT_VOICE = "ko-KR-SunHiNeural";
export const AZURE_OUTPUT_FORMAT = "audio-16khz-128kbitrate-mono-mp3";

export type TtsResult =
  | { ok: true; audio: ArrayBuffer; provider: TtsProvider }
  | { ok: false; status: number; quotaExceeded: boolean; message: string; provider: TtsProvider };

export interface TtsCallOptions {
  /** 공급자 호출 하나의 제한 시간(ms). 기본 25초. */
  timeoutMs?: number;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** ElevenLabs 오류 본문이 크레딧 소진인지(elevenlabs-tts의 402 판정과 동일). */
export function isElevenLabsQuotaExceeded(errorText: string): boolean {
  if (errorText.includes("quota_exceeded")) return true;
  try {
    const parsed = JSON.parse(errorText);
    return parsed?.detail?.status === "quota_exceeded";
  } catch {
    return false;
  }
}

export async function synthesizeElevenLabs(text: string, opts: TtsCallOptions = {}): Promise<TtsResult> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return { ok: false, status: 500, quotaExceeded: false, message: "ELEVENLABS_API_KEY not configured", provider: "elevenlabs" };
  }
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL_ID }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      const quotaExceeded = response.status === 402 || isElevenLabsQuotaExceeded(errorText);
      return {
        ok: false,
        status: quotaExceeded ? 402 : response.status,
        quotaExceeded,
        message: `ElevenLabs ${response.status}: ${errorText.slice(0, 300)}`,
        provider: "elevenlabs",
      };
    }
    return { ok: true, audio: await response.arrayBuffer(), provider: "elevenlabs" };
  } catch (e) {
    return { ok: false, status: 0, quotaExceeded: false, message: `ElevenLabs 호출 실패: ${errorMessage(e)}`, provider: "elevenlabs" };
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function synthesizeAzure(text: string, voice?: string, opts: TtsCallOptions = {}): Promise<TtsResult> {
  const key = Deno.env.get("AZURE_SPEECH_KEY");
  const region = Deno.env.get("AZURE_SPEECH_REGION") || "koreacentral";
  if (!key) {
    return { ok: false, status: 500, quotaExceeded: false, message: "AZURE_SPEECH_KEY not configured", provider: "azure" };
  }
  const voiceName = voice || AZURE_DEFAULT_VOICE;
  // azure-tts와 같은 SSML. 다만 &,<,> 는 이스케이프한다(평범한 문장은 결과가 같다).
  const ssml = `<speak version='1.0' xml:lang='ko-KR'>
      <voice xml:lang='ko-KR' xml:gender='Female' name='${voiceName}'>
        ${escapeXml(text)}
      </voice>
    </speak>`;
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": AZURE_OUTPUT_FORMAT,
        "User-Agent": "KoreanVocabQuiz",
      },
      body: ssml,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        status: response.status,
        quotaExceeded: false,
        message: `Azure ${response.status}: ${errorText.slice(0, 300)}`,
        provider: "azure",
      };
    }
    return { ok: true, audio: await response.arrayBuffer(), provider: "azure" };
  } catch (e) {
    return { ok: false, status: 0, quotaExceeded: false, message: `Azure 호출 실패: ${errorMessage(e)}`, provider: "azure" };
  }
}

/**
 * 공급자 순서대로 음성을 만든다. ElevenLabs가 크레딧 소진(402)이면 Azure로 대신한다
 * (클라이언트 ttsService.ts와 같은 규칙).
 */
export async function synthesize(text: string, provider: TtsProvider, opts: TtsCallOptions = {}): Promise<TtsResult> {
  if (provider === "azure") return synthesizeAzure(text, undefined, opts);
  const result = await synthesizeElevenLabs(text, opts);
  if (!result.ok && result.quotaExceeded) {
    console.warn("ElevenLabs 크레딧 소진, Azure로 전환");
    return synthesizeAzure(text, undefined, opts);
  }
  return result;
}
