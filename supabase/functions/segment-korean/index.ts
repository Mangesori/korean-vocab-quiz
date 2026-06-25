import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading segment-korean function...");

interface SegmentRequest {
  sentences: { id: string; text: string }[];
}

interface Tile {
  content: string;
  isParticle: boolean;
}

const buildPrompt = (sentences: { id: string; text: string }[]) => {
  const list = sentences.map((s) => `{"id": "${s.id}", "text": "${s.text}"}`).join(",\n  ");
  return `당신은 한국어 형태소 분석 전문가입니다. "워드 마그넷"(문장 순서 맞추기) 퀴즈용으로 각 문장을 타일 단위로 분절하세요.

[분절 규칙]
- 띄어쓰기(어절) 기준으로 의미 단위로 나눕니다.
- 명사 + 조사 → 명사 / 조사 (예: "학생이" → "학생" / "이")
- 동사·형용사 활용형 → 어간 / 어미(들) (예: "운동하고" → "운동하" / "고", "싶지만" → "싶" / "지만", "먹었어요" → "먹" / "었어요")
- 각 타일의 content를 공백 없이 순서대로 이으면 원문 문장(공백 제거)과 정확히 같아야 합니다. 글자를 추가/삭제/변형하지 마세요.
- 문장 부호(. ? !)는 바로 앞 타일의 content에 붙입니다.
- isParticle = true: 앞 타일에 붙는 문법 형태소(조사·어미·연결어미·종결어미).
- isParticle = false: 내용 형태소(명사·동사어간·형용사어간·부사·관형사 등).

[예시]
"운동하고 싶지만 시간이 없어요." →
[{"content":"운동하","isParticle":false},{"content":"고","isParticle":true},{"content":"싶","isParticle":false},{"content":"지만","isParticle":true},{"content":"시간","isParticle":false},{"content":"이","isParticle":true},{"content":"없","isParticle":false},{"content":"어요.","isParticle":true}]

[입력 문장]
[
  ${list}
]

[출력 — JSON만, 코드블록 없이. 첫 글자는 { ]
{
  "results": [
    { "id": "...", "tiles": [ { "content": "...", "isParticle": true }, ... ] }
  ]
}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "인증에 실패했습니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profileData || (profileData.role !== "teacher" && profileData.role !== "admin")) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sentences }: SegmentRequest = await req.json();
    if (!sentences || sentences.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let content: string;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          temperature: 0,
          messages: [{ role: "user", content: buildPrompt(sentences) }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Claude API error:", response.status, errorText);
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      content = data.content?.[0]?.text;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

    if (!content) throw new Error("No content received from AI");

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    if (!jsonStr.startsWith("{")) {
      console.error("AI response not JSON:", jsonStr.substring(0, 200));
      throw new Error("AI가 JSON이 아닌 텍스트로 응답했습니다.");
    }

    const parsed = JSON.parse(jsonStr);
    const rawResults: { id: string; tiles: Tile[] }[] = parsed.results || [];

    // 검증: 타일을 이어붙인 결과가 원문(공백 제거)과 같은지. 다르면 해당 문장은 빈 tiles로(클라이언트가 폴백).
    const stripSpaces = (s: string) => s.replace(/\s+/g, "");
    const results = sentences.map((s) => {
      const found = rawResults.find((r) => r.id === s.id);
      if (
        found &&
        Array.isArray(found.tiles) &&
        found.tiles.length > 0 &&
        stripSpaces(found.tiles.map((t) => t.content).join("")) === stripSpaces(s.text)
      ) {
        return { id: s.id, tiles: found.tiles.map((t) => ({ content: t.content, isParticle: !!t.isParticle })) };
      }
      return { id: s.id, tiles: [] as Tile[] }; // 폴백 신호
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in segment-korean function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
