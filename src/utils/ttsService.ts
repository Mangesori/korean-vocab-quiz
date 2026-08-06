import { supabase } from "@/integrations/supabase/client";

export type TtsProvider = "azure" | "elevenlabs" | "minimax";

interface TtsOptions {
  /** Azure 음성 이름 (예: ko-KR-SunHiNeural, ko-KR-InJoonNeural 등) */
  voice?: string;
  /** MiniMax 전용 옵션 */
  voiceId?: string;
  model?: string;
}

/**
 * TTS Edge Function을 호출하여 mp3 오디오 Blob을 반환합니다.
 *
 * @param text 음성으로 변환할 텍스트
 * @param provider TTS 엔진 ("azure" | "elevenlabs" | "minimax")
 * @param options 추가 옵션 (보이스 등)
 * @returns mp3 오디오 Blob, 실패 시 null
 */
export async function generateTtsAudio(
  text: string,
  provider: TtsProvider = "azure",
  options?: TtsOptions,
): Promise<Blob | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    let functionName = "azure-tts";
    if (provider === "elevenlabs") functionName = "elevenlabs-tts";
    if (provider === "minimax") functionName = "minimax-tts";

    const body: Record<string, string> = { text };
    if (provider === "azure" && options?.voice) {
      body.voice = options.voice;
    } else if (provider === "minimax") {
      if (options?.voiceId) body.voiceId = options.voiceId;
      if (options?.model) body.model = options.model;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      console.error(`TTS generation failed (${provider}): ${response.status}`);
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error(`TTS error (${provider}):`, error);
    return null;
  }
}
