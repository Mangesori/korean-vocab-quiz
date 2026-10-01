import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, ClaudeApiError, type ClaudeJsonSchemaFormat } from "../_shared/claude.ts";
import { toChunks, validateChunkOrders, type Chunk, type Tile } from "./chunks.ts";

/**
 * 문장 순서 맞추기: 정답으로 인정할 다른 어순 제안.
 *
 * 한국어는 조사가 격을 표시해 "저는 어제 영화를 봤어요" / "어제 저는 영화를 봤어요"가
 * 둘 다 자연스럽다. 어떤 재배열이 자연스러운지는 관형어 결합·보조용언 구성 같은 문법
 * 판단이 필요해 규칙으로 정하기 어렵다 — 그 판단만 모델에게 맡기고, 결과는 선생님이
 * 편집 화면에서 확인·삭제할 수 있는 "제안"으로만 들어간다(채점은 저장된 목록과의 일치만 본다).
 *
 * 응답은 각 문제의 "타일 인덱스 순서" 배열이다. 문자열 조립은 클라이언트의
 * assembleForDisplay 한 곳에서만 한다(학생 화면과 똑같은 띄어쓰기 규칙).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PROBLEMS = 40;
const MAX_TILES = 30;

interface SuggestRequest {
  problems: { id: string; tiles: Tile[] }[];
}

const SYSTEM = `당신은 외국인에게 한국어를 가르치는 숙련된 교사입니다.

"문장 순서 맞추기" 퀴즈에서 학생은 흩어진 어절 덩어리를 순서대로 놓아 문장을 완성합니다. 기본 정답은 하나지만, 한국어는 조사가 문법 관계를 표시하기 때문에 같은 덩어리를 다른 순서로 놓아도 뜻이 같고 자연스러운 경우가 있습니다. 그런 순서를 찾는 것이 당신의 일입니다 — 학생이 그렇게 답했을 때 한국어 교사가 망설임 없이 정답으로 인정할 순서만 고르세요.

여기서 고른 순서는 그대로 정답으로 채점됩니다. 어색한 순서를 넣으면 학생이 틀린 어순을 맞았다고 배우게 되므로, 조금이라도 확신이 없으면 빼세요. 다른 순서가 없는 문장도 많고, 그때는 빈 배열이 정답입니다.

판단 기준:
- 마지막 덩어리(서술어)는 항상 맨 끝에 둡니다.
- 관형어는 꾸미는 말 바로 앞에 붙어 있어야 합니다 — 관형사(이/그/저/제/여러/새/모든 등), 관형형(-은/-는/-ㄴ/-ㄹ/-던), "~의". 예: "예쁜 | 가방을"에서 "예쁜"은 떨어질 수 없습니다.
- 의존명사·보조용언 구성은 순서를 유지합니다: "갈 | 거예요", "할 | 수 | 있어요", "먹고 | 싶어요".
- 연결어미(-고, -아서/어서, -지만, -면 등)로 이어진 절의 앞뒤 순서는 바꾸지 않습니다.
- 시간·장소·빈도 부사어(어제, 매일, 학교에서, 주말에 등)와 주어·목적어 덩어리는 대체로 서로 자리를 바꿀 수 있습니다. 다만 바꾼 결과가 어색하거나 문장의 초점이 크게 달라지면 넣지 마세요.

각 문장마다 덩어리 번호(0부터 시작)의 순열로 답하고, 원래 순서는 넣지 마세요. 문장당 최대 3개.

예시
문장: 저는 어제 영화를 봤어요.
덩어리: 0 저는 / 1 어제 / 2 영화를 / 3 봤어요.
→ [[1,0,2,3]]

문장: 학교에서 한국어를 배워요.
덩어리: 0 학교에서 / 1 한국어를 / 2 배워요.
→ [[1,0,2]]

문장: 이것은 제 가방이에요.
덩어리: 0 이것은 / 1 제 / 2 가방이에요.
→ [] ("제"는 "가방" 앞에 붙어 있어야 하고, 남는 덩어리로 만들 수 있는 다른 순서는 어색합니다)`;

const OUTPUT_SCHEMA: ClaudeJsonSchemaFormat = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            orders: {
              type: "array",
              items: { type: "array", items: { type: "integer" } },
            },
          },
          required: ["id", "orders"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
};

function buildPrompt(items: { id: string; sentence: string; chunks: Chunk[] }[]): string {
  const body = items
    .map((it) => {
      const list = it.chunks.map((c, i) => `${i} ${c.text}`).join(" / ");
      return `id: ${it.id}\n문장: ${it.sentence}\n덩어리: ${list}`;
    })
    .join("\n\n");
  return `다음 문장들에 대해 정답으로 인정할 다른 순서를 찾아 주세요. 모든 id에 대해 결과를 하나씩 내 주세요.\n\n${body}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "인증이 필요합니다." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "인증에 실패했습니다." }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
      return json({ error: "권한이 없습니다." }, 403);
    }

    const { problems }: SuggestRequest = await req.json();
    if (!Array.isArray(problems) || problems.length === 0) return json({ results: [] });
    if (problems.length > MAX_PROBLEMS) {
      return json({ error: `한 번에 ${MAX_PROBLEMS}문제까지 요청할 수 있어요.` }, 400);
    }

    // 덩어리가 2개 이하면(마지막은 고정) 다른 순서가 있을 수 없으니 모델에 보내지 않는다.
    const candidates = problems
      .filter((p) => typeof p?.id === "string" && Array.isArray(p.tiles) && p.tiles.length <= MAX_TILES)
      .map((p) => {
        const tiles = p.tiles.map((t) => ({ content: String(t?.content ?? ""), isParticle: !!t?.isParticle }));
        const chunks = toChunks(tiles);
        return { id: p.id, sentence: chunks.map((c) => c.text).join(" "), chunks };
      })
      .filter((p) => p.chunks.length >= 3);

    if (candidates.length === 0) {
      return json({ results: problems.map((p) => ({ id: p.id, orders: [] })) });
    }

    const result = await callClaude(buildPrompt(candidates), {
      model: "claude-opus-5-5",
      maxTokens: 16000,
      effort: "medium",
      system: SYSTEM,
      timeoutMs: 90000,
      outputSchema: OUTPUT_SCHEMA,
      fallbacks: "default",
    });

    const parsed = JSON.parse(result.text) as { results?: { id: string; orders: unknown }[] };
    const byId = new Map((parsed.results ?? []).map((r) => [r.id, r.orders]));

    const results = problems.map((p) => {
      const c = candidates.find((x) => x.id === p.id);
      return { id: p.id, orders: c ? validateChunkOrders(c.chunks, byId.get(p.id)) : [] };
    });

    return json({ results });
  } catch (error) {
    console.error("Error in suggest-word-orders:", error);
    const status = error instanceof ClaudeApiError && error.status === 429 ? 429 : 500;
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, status);
  }
});
