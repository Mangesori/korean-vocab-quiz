import { supabase } from "@/integrations/supabase/client";
import { assembleForDisplay, stripSpaces } from "./wordMagnet";
import type { Tile } from "./segment";

/**
 * 정답으로 인정할 다른 어순을 AI(suggest-word-orders 엣지 함수)에게 제안받는다.
 * 서버는 타일 인덱스 순서만 돌려주고, 문자열 조립은 학생 화면과 같은
 * assembleForDisplay로 여기서 한다(띄어쓰기 규칙을 한 곳에서만 관리).
 *
 * 제안은 부가 기능이라 실패해도 퀴즈 생성·편집을 막지 않는다 — 예외 대신 null을 돌려준다
 * (빈 객체가 아니라 null인 이유: "제안할 어순이 없음"과 "호출 실패"를 호출부가 구분해야 한다).
 * 반환: { [id]: 어순 문장[] } (기본 정답과 같거나 서로 겹치는 것은 제외) | 실패 시 null
 */
export async function suggestAcceptableOrders(
  problems: { id: string; tiles: Tile[] }[]
): Promise<Record<string, string[]> | null> {
  const out: Record<string, string[]> = {};
  if (problems.length === 0) return out;

  try {
    const { data, error } = await supabase.functions.invoke("suggest-word-orders", {
      body: { problems },
    });
    if (error) throw error;

    const results: { id: string; orders: number[][] }[] = data?.results || [];
    for (const r of results) {
      const tiles = problems.find((p) => p.id === r.id)?.tiles;
      if (!tiles) continue;

      const seen = new Set([stripSpaces(assembleForDisplay(tiles))]);
      const sentences: string[] = [];
      for (const order of r.orders || []) {
        if (order.length !== tiles.length || order.some((i) => !tiles[i])) continue;
        const sentence = assembleForDisplay(order.map((i) => tiles[i]));
        const key = stripSpaces(sentence);
        if (seen.has(key)) continue;
        seen.add(key);
        sentences.push(sentence);
      }
      out[r.id] = sentences;
    }
  } catch (e) {
    console.error("suggest-word-orders failed", e);
    return null;
  }

  return out;
}

/** 기존 목록에 새 제안을 합친다(공백 무시 기준으로 중복 제거, 기존 순서 유지). */
export function mergeOrders(existing: string[], incoming: string[], baseText: string): string[] {
  const seen = new Set([stripSpaces(baseText), ...existing.map(stripSpaces)]);
  const merged = [...existing];
  for (const s of incoming) {
    const key = stripSpaces(s);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged;
}
