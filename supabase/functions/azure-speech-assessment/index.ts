import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading azure-speech-assessment function...");

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
  errorType?: string;
}

interface AssessmentResponse {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number;
  overallScore: number;
  wordLevelFeedback: WordFeedback[];
  isPassed: boolean;
}

// Base64 to ArrayBuffer 변환
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

serve(async (req) => {
  console.log("Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const {
      audioBase64,
      referenceText,
      language = "ko-KR",
      quizId,
      problemId,
      attemptNumber = 1,
      recordingUrl,
    }: AssessmentRequest = await req.json();

    if (!audioBase64 || !referenceText) {
      return new Response(
        JSON.stringify({ error: "audioBase64와 referenceText는 필수입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Assessing pronunciation for: "${referenceText.substring(0, 50)}..."`);

    const AZURE_SPEECH_KEY = Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_SPEECH_REGION = Deno.env.get("AZURE_SPEECH_REGION") || "koreacentral";

    if (!AZURE_SPEECH_KEY) {
      throw new Error("AZURE_SPEECH_KEY is not configured");
    }

    // Convert base64 to ArrayBuffer
    const audioBuffer = base64ToArrayBuffer(audioBase64);

    // Build pronunciation assessment config
    const pronunciationAssessmentConfig = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    };

    const pronunciationAssessmentHeader = btoa(
      unescape(encodeURIComponent(JSON.stringify(pronunciationAssessmentConfig)))
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      // Call Azure Speech API
      const response = await fetch(
        `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
            "Content-Type": "audio/wav",
            "Pronunciation-Assessment": pronunciationAssessmentHeader,
            Accept: "application/json",
          },
          body: audioBuffer,
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Azure Speech API error:", response.status, errorText);
        throw new Error(`Azure Speech API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Azure response:", JSON.stringify(result).substring(0, 500));

      // Parse Azure response
      let assessmentResult: AssessmentResponse;

      if (result.RecognitionStatus === "Success" && result.NBest && result.NBest.length > 0) {
        const best = result.NBest[0];
        // Azure returns scores directly on NBest[0], not nested under PronunciationAssessment
        const accuracyScore = best.AccuracyScore ?? best.PronunciationAssessment?.AccuracyScore ?? 0;
        const fluencyScore = best.FluencyScore ?? best.PronunciationAssessment?.FluencyScore ?? 0;
        const completenessScore = best.CompletenessScore ?? best.PronunciationAssessment?.CompletenessScore ?? 0;
        const pronScore = best.PronScore ?? best.PronunciationAssessment?.PronScore ?? 0;
        const prosodyScore = best.ProsodyScore ?? best.PronunciationAssessment?.ProsodyScore ?? 0;

        // Extract word-level feedback (scores also directly on word object)
        const wordFeedback: WordFeedback[] = (best.Words || []).map((w: any) => ({
          word: w.Word,
          accuracyScore: w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore ?? 0,
          errorType: w.ErrorType ?? w.PronunciationAssessment?.ErrorType ?? undefined,
        }));

        assessmentResult = {
          pronunciationScore: pronScore,
          accuracyScore,
          fluencyScore,
          completenessScore,
          prosodyScore,
          // 운율(prosody) 점수는 한국어에서 안정적으로 제공되지 않아 제외
          overallScore: Math.round(
            accuracyScore * 0.4 +
            fluencyScore * 0.3 +
            completenessScore * 0.3
          ),
          wordLevelFeedback: wordFeedback,
          isPassed: false, // Will be calculated below
        };

        assessmentResult.isPassed = assessmentResult.overallScore >= 60;
      } else {
        // Recognition failed or no results
        console.warn("Recognition status:", result.RecognitionStatus, "Full result:", JSON.stringify(result));
        assessmentResult = {
          pronunciationScore: 0,
          accuracyScore: 0,
          fluencyScore: 0,
          completenessScore: 0,
          prosodyScore: 0,
          overallScore: 0,
          wordLevelFeedback: [],
          isPassed: false,
          recognitionStatus: result.RecognitionStatus,
        } as any;
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
    console.error("Error in azure-speech-assessment function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
