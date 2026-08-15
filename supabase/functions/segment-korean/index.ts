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
- 조사가 두 개 이상 겹쳐 있으면("에는", "에서는", "로는", "까지는" 등) 절대 하나로 합치지 말고 전부 개별 조사 타일로 쪼갭니다. (예: "학교에는" → "학교" / "에" / "는", 절대 "학교" / "에는"이 아님. "집에서는" → "집" / "에서" / "는")
- 명사 뒤에 붙는 서술격 조사 "이다"의 활용형(이에요/예요/이었어요/였어요/입니다/이고/이며 등)은 어미가 아니라 조사이므로 명사와 분리하고 isParticle=true 를 부여합니다. (예: "학생이에요" → "학생"(isParticle=false) / "이에요"(isParticle=true). "선생님이었어요" → "선생님" / "이었어요") 이건 동사·형용사 활용형과 다릅니다 — 아래 규칙과 헷갈리지 마세요.
- 동사·형용사 활용형(서술어)은 어간/어미로 쪼개지 말고 어절 전체를 한 타일로 두며 isParticle=false 로 둡니다. (예: "좋아서", "냈어요", "쓰기로", "했어요", "완성해서", "드렸어요", "낮아졌다고", "해요" 는 각각 통째로 한 타일)
- 명사·부사·관형사 등도 조사가 붙지 않았다면 어절 전체를 통째로 한 타일(isParticle=false)로 둡니다.
- 원문에 있는 글자(받침·복수 접미사 "들" 등 포함)를 하나도 빠뜨리지 마세요. 타일을 순서대로 이어붙이면 원문과 완전히 같아야 합니다 — 아래 검증 규칙 참고.
- 각 타일의 content를 공백 없이 순서대로 이으면 원문 문장(공백 제거)과 정확히 같아야 합니다. 글자를 추가/삭제/변형하지 마세요.
- 문장 부호(. ? !)는 바로 앞 타일의 content에 붙입니다.
- isParticle = true 는 오직 "명사에서 분리된 조사(격조사·보조사·서술격 조사: 은/는/이/가/을/를/의/에/에서/한테/에게/도/만/이에요/였어요 등)"에만 부여합니다. 조사가 겹쳐 있으면 그 조사들 전부에 isParticle=true를 부여합니다.
- 어미·연결어미·종결어미에는 절대 isParticle=true 를 부여하지 않습니다(애초에 서술어는 분리하지 않습니다).
- isParticle = false: 내용 형태소(명사·동사·형용사 활용형 전체·부사·관형사 등).

[동음이의 주의]
- "많이"의 "이"는 부사의 일부이므로 조사로 보고 분리하지 마세요. ("많이" 통째로)
- "쓰기로"의 "로"는 어미이므로 분리하거나 조사(isParticle=true)로 만들지 마세요. ("쓰기로" 통째로)
- "낮아졌다고"의 "다고"는 어미이므로 분리하거나 조사로 만들지 마세요. ("낮아졌다고" 통째로)

[예시]
"운동하고 싶지만 시간이 없어요." →
[{"content":"운동하고","isParticle":false},{"content":"싶지만","isParticle":false},{"content":"시간","isParticle":false},{"content":"이","isParticle":true},{"content":"없어요.","isParticle":false}]
"요즘 한국은 출산율이 많이 낮아졌다고 해요." →
[{"content":"요즘","isParticle":false},{"content":"한국","isParticle":false},{"content":"은","isParticle":true},{"content":"출산율","isParticle":false},{"content":"이","isParticle":true},{"content":"많이","isParticle":false},{"content":"낮아졌다고","isParticle":false},{"content":"해요.","isParticle":false}]
"저는 학생이에요." →
[{"content":"저","isParticle":false},{"content":"는","isParticle":true},{"content":"학생","isParticle":false},{"content":"이에요.","isParticle":true}]
"이 동물원에는 여러 종의 동물들이 있어요." →
[{"content":"이","isParticle":false},{"content":"동물원","isParticle":false},{"content":"에","isParticle":true},{"content":"는","isParticle":true},{"content":"여러","isParticle":false},{"content":"종","isParticle":false},{"content":"의","isParticle":true},{"content":"동물들","isParticle":false},{"content":"이","isParticle":true},{"content":"있어요.","isParticle":false}]

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
