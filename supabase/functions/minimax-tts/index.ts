import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MINIMAX_T2A_URL = "https://api.minimax.io/v1/t2a_v2";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, model } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MINIMAX_API_KEY = Deno.env.get('MINIMAX_API_KEY');

    if (!MINIMAX_API_KEY) {
      console.error("MINIMAX_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "MiniMax API key not configured in Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating TTS via MiniMax for text: "${text.substring(0, 50)}..."`);

    const payload = {
      model: model || "speech-01-hd",
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId || "Korean_EnchantingSister",
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
    };

    const response = await fetch(MINIMAX_T2A_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MiniMax API HTTP error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `MiniMax API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const json = await response.json();

    if (json.base_resp && json.base_resp.status_code !== 0) {
      console.error(`MiniMax API error response: ${json.base_resp.status_code} - ${json.base_resp.status_msg}`);
      return new Response(
        JSON.stringify({ error: json.base_resp.status_msg || "TTS Generation Failed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hexAudio = json.data?.audio || json.audio_file || json.audio;

    if (!hexAudio) {
      console.error("No audio content received from MiniMax");
      return new Response(
        JSON.stringify({ error: "No audio returned from MiniMax" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBytes = hexToBytes(hexAudio);
    console.log(`MiniMax audio generated successfully: ${audioBytes.byteLength} bytes`);

    return new Response(audioBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('MiniMax TTS error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
