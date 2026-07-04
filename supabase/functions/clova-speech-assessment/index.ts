import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading clova-speech-assessment function...");

interface AssessmentRequest {
  audioBase64: string;
  referenceText: string;
  language?: string;
  quizId?: string;
  problemId?: string;
  attemptNumber?: number;
  recordingUrl?: string;
}

interface WordFeedback {
  word: string;
  accuracyScore: number;
}

interface AssessmentResponse {
  accuracyScore: number;
  overallScore: number;
  wordLevelFeedback: WordFeedback[];
  isPassed: boolean;
}

// Base64 to ArrayBuffer 변환
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 클로바 assessment_details 문자열 파싱
// 예: "그분은|{그(gɯ):65, 분(bʊn):100, 은(ɯn):99} 젊었을|{젊(t͡ɕʌlm):39, 었(ʌs):100, 을(ɯl):99}"
// 단어별로 묶어서, 그 단어에 속한 음절 점수 중 최솟값을 단어 점수로 사용
function parseAssessmentDetails(details: string): WordFeedback[] {
  const results: WordFeedback[] = [];
  const wordPattern = /(\S+)\|\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = wordPattern.exec(details)) !== null) {
    const word = match[1];
    const syllablesRaw = match[2];
    const scores = [...syllablesRaw.matchAll(/:(\d+)/g)].map((m) => Number(m[1]));
    if (scores.length === 0) continue;
    results.push({ word, accuracyScore: Math.min(...scores) });
  }
  return results;
}

serve(async (req) => {
  console.log("Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { audioBase64, referenceText }: AssessmentRequest = await req.json();

    if (!audioBase64 || !referenceText) {
      return new Response(
        JSON.stringify({ error: "audioBase64와 referenceText는 필수입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Assessing pronunciation for: "${referenceText.substring(0, 50)}..."`);

    const CLOVA_SPEECH_SECRET_KEY = Deno.env.get("CLOVA_SPEECH_SECRET_KEY");
    const CLOVA_SPEECH_INVOKE_URL =
      Deno.env.get("CLOVA_SPEECH_INVOKE_URL") || "https://clovaspeech-gw.ncloud.com/recog/v1/stt";

    if (!CLOVA_SPEECH_SECRET_KEY) {
      throw new Error("CLOVA_SPEECH_SECRET_KEY is not configured");
    }

    const audioBuffer = base64ToArrayBuffer(audioBase64);

    const params = new URLSearchParams({
      lang: "Kor",
      assessment: "true",
      utterance: referenceText,
    });
    const url = `${CLOVA_SPEECH_INVOKE_URL}?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-CLOVASPEECH-API-KEY": CLOVA_SPEECH_SECRET_KEY,
        },
        body: audioBuffer,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("CLOVA Speech API error:", response.status, errorText);
        throw new Error(`CLOVA Speech API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("CLOVA response:", JSON.stringify(result).substring(0, 500));

      let assessmentResult: AssessmentResponse;

      if (typeof result.assessment_score === "number") {
        const overallScore = Math.round(result.assessment_score);
        const wordLevelFeedback =
          typeof result.assessment_details === "string"
            ? parseAssessmentDetails(result.assessment_details)
            : [];

        assessmentResult = {
          accuracyScore: overallScore,
          overallScore,
          wordLevelFeedback,
          isPassed: overallScore >= 60,
        };
      } else {
        console.warn("No assessment_score in response:", JSON.stringify(result));
        assessmentResult = {
          accuracyScore: 0,
          overallScore: 0,
          wordLevelFeedback: [],
          isPassed: false,
        };
      }

      console.log(
        `Assessment complete: ${assessmentResult.overallScore}점 (${assessmentResult.isPassed ? "합격" : "불합격"})`
      );

      return new Response(JSON.stringify(assessmentResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error("Error in clova-speech-assessment function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
