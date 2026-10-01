// 문장 순서 맞추기 허용 어순 제안 — 덩어리 묶기와 AI 응답 검증(순수 함수).
// Deno/Node 어느 쪽에서도 돌도록 런타임 의존성을 두지 않는다(로컬 테스트용).

export interface Tile {
  content: string;
  isParticle: boolean;
}

/** 어절 덩어리: 조사가 아닌 타일 하나 + 그 뒤에 붙은 조사 타일들. tileIdx는 원래 타일 인덱스. */
export interface Chunk {
  text: string;
  tileIdx: number[];
}

/**
 * 타일을 어절 덩어리로 묶는다. AI에게 타일이 아니라 덩어리 순서를 고르게 하는 이유:
 * 조사를 따로 움직이면 "저는 친구를"이 "저를 친구는"처럼 뜻이 바뀐 문장이 되는데,
 * 조사를 원래 명사에 묶어 두면 그런 재배열은 애초에 만들어질 수 없다.
 */
export function toChunks(tiles: Tile[]): Chunk[] {
  const chunks: Chunk[] = [];
  tiles.forEach((t, i) => {
    const last = chunks[chunks.length - 1];
    if (t.isParticle && last) {
      last.text += t.content;
      last.tileIdx.push(i);
    } else {
      chunks.push({ text: t.content, tileIdx: [i] });
    }
  });
  return chunks;
}

/**
 * AI가 낸 덩어리 순서 목록을 검증해 타일 인덱스 순서로 바꾼다.
 * 문법 판단은 AI에게 맡기되, 기계적으로 확실한 것만 여기서 강제한다:
 * - 0..n-1의 순열이어야 한다(타일을 빼거나 더하면 학생이 만들 수 없는 답이 된다)
 * - 마지막 덩어리(서술어 + 문장부호)는 맨 끝에 그대로 있어야 한다
 * - 원래 순서와 같으면 버린다(이미 기본 정답)
 * 중복은 제거하고 최대 maxPerProblem개까지만 남긴다.
 */
export function validateChunkOrders(
  chunks: Chunk[],
  rawOrders: unknown,
  maxPerProblem = 3,
): number[][] {
  if (!Array.isArray(rawOrders)) return [];
  const n = chunks.length;
  const seen = new Set<string>();
  const out: number[][] = [];

  for (const order of rawOrders) {
    if (out.length >= maxPerProblem) break;
    if (!Array.isArray(order) || order.length !== n) continue;
    if (!order.every((x) => Number.isInteger(x) && x >= 0 && x < n)) continue;
    if (new Set(order).size !== n) continue;
    if (order[n - 1] !== n - 1) continue;
    if (order.every((x, i) => x === i)) continue;

    const key = order.join(",");
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(order.flatMap((ci: number) => chunks[ci].tileIdx));
  }
  return out;
}
