import { supabase } from "@/integrations/supabase/client";
import { parseSentenceToItems } from "./wordMagnet";

export type Tile = { content: string; isParticle: boolean };

/**
 * 문장들을 AI(segment-korean 엣지 함수)로 형태소 타일 분절한다.
 * 실패하거나 검증에 걸린 문장은 휴리스틱(parseSentenceToItems)으로 폴백한다.
 * 반환: { [id]: Tile[] }
 */
export async function segmentSentences(
  sentences: { id: string; text: string }[]
): Promise<Record<string, Tile[]>> {
  const out: Record<string, Tile[]> = {};
  // 기본값: 휴리스틱 폴백
  for (const s of sentences) {
    out[s.id] = parseSentenceToItems(s.text).map((it) => ({
      content: it.content,
      isParticle: it.isParticle,
    }));
  }

  if (sentences.length === 0) return out;

  try {
    const { data, error } = await supabase.functions.invoke("segment-korean", {
      body: { sentences },
    });
    if (error) throw error;
    const results: { id: string; tiles: Tile[] }[] = data?.results || [];
    for (const r of results) {
      // tiles가 비어있으면(서버 검증 실패) 폴백 유지
      if (r.tiles && r.tiles.length > 0) {
        out[r.id] = r.tiles.map((t) => ({ content: t.content, isParticle: !!t.isParticle }));
      }
    }
  } catch (e) {
    console.error("segment-korean failed, using heuristic fallback", e);
  }

  return out;
}
