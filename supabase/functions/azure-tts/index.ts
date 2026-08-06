import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_VOICE = "ko-KR-SunHiNeural";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || "koreacentral";

    if (!AZURE_SPEECH_KEY) {
      console.error("AZURE_SPEECH_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Azure Speech Key not configured in Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const voiceName = voice || DEFAULT_VOICE;
    console.log(`Generating Azure TTS (voice=${voiceName}) for text: "${text.substring(0, 50)}..."`);

    // SSML (Speech Synthesis Markup Language) 구성
    const ssml = `<speak version='1.0' xml:lang='ko-KR'>
      <voice xml:lang='ko-KR' xml:gender='Female' name='${voiceName}'>
        ${text}
      </voice>
    </speak>`;

    const azureUrl = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'KoreanVocabQuiz',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Azure Speech API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Azure TTS failed: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Generated Azure Speech audio: ${audioBuffer.byteLength} bytes`);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Azure TTS error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
