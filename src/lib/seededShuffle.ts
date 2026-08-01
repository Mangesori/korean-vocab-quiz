/**
 * 씨앗값으로 결정되는 셔플.
 *
 * 라이브 세션에서 "학생마다 섞기"를 끄면 모든 학생이 **같은** 순서를 봐야 한다.
 * 그렇다고 문제를 만든 원래 순서 그대로면 재미가 없으므로, 세션 id를 씨앗으로
 * 한 번 섞은 결과를 모두가 공유한다. 같은 세션이면 누가 언제 열어도 같은 순서,
 * 세션이 바뀌면 다른 순서가 나온다.
 */

/** 문자열을 32비트 정수 씨앗으로 (FNV-1a) */
function seedFrom(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — 씨앗 하나로 재현 가능한 난수열을 만든다. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 같은 (배열 길이, 씨앗)이면 항상 같은 순서를 돌려준다. 원본은 건드리지 않는다.
 * Fisher-Yates — 모든 순열이 같은 확률로 나온다.
 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  const rand = mulberry32(seedFrom(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
