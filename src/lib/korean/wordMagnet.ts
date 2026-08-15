import { PARTICLES } from "./particles";

export interface WordMagnetItem {
  id: string;
  content: string;
  isParticle: boolean;
}

/**
 * 완성 문장을 어절 단위로 나눈 뒤, 어절이 조사로 끝나면 어간 + 조사 타일로 분리한다.
 * (참고 구현: Edurockk/bananakorean/src/lib/quiz/parser.ts parseAnswerToItems)
 * 표시용 isParticle만 부여하고, 채점은 어순(공백 무시)으로 별도 처리한다.
 */
// `이`나 `로`로 끝나지만 조사가 아닌 흔한 부사. 통째로 흰색 타일로 둔다.
const ADVERB_STOPLIST = new Set([
  "많이", "같이", "굳이", "깊이", "높이", "없이", "다같이",
  "함부로", "그대로", "따로", "억지로",
]);

/**
 * 어절 하나에서 뒤쪽 조사를 한 겹만 벗긴다. 못 벗기면 null.
 * (예: "동물원에는" → { stem: "동물원에", particle: "는" })
 */
function peelOneParticle(word: string): { stem: string; particle: string } | null {
  for (const particle of PARTICLES) {
    if (word.endsWith(particle) && word.length > particle.length) {
      // 가드: 조사 `로`/`으로`로 분리하려 할 때, "기로"로 끝나면(예: 쓰기로 = 어미)
      // 분리하지 않고 다음 후보로 넘어간다.
      if ((particle === "로" || particle === "으로") && word.endsWith("기로")) {
        continue;
      }
      return { stem: word.slice(0, -particle.length), particle };
    }
  }
  return null;
}

export function parseSentenceToItems(text: string): WordMagnetItem[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const items: WordMagnetItem[] = [];
  let id = 1;

  for (const word of words) {
    // 어절 끝에 붙은 문장부호(.?!)는 조사 매칭을 방해하므로 떼어냈다가
    // 마지막 타일에 다시 붙인다. 문장부호가 없는 대부분의 어절은 core === word라
    // 아래 로직이 그대로 기존 동작과 동일하게 흘러간다.
    const punctMatch = word.match(/[.?!]+$/);
    const trailingPunct = punctMatch ? punctMatch[0] : "";
    const core = trailingPunct ? word.slice(0, -trailingPunct.length) : word;

    // 가드: `이`나 `로`로 끝나는 흔한 부사는 분리하지 않고 통째로 둔다.
    if (ADVERB_STOPLIST.has(core)) {
      items.push({ id: String(id++), content: core + trailingPunct, isParticle: false });
      continue;
    }

    // 조사가 겹쳐 있으면("에는", "에서는") 한 겹만 벗기고 멈추지 않고, 더 이상
    // 벗겨지지 않을 때까지 반복해서 전부 개별 조사 타일로 쪼갠다.
    const particleTiles: string[] = [];
    let stem = core;
    while (true) {
      const peeled = peelOneParticle(stem);
      if (!peeled) break;
      particleTiles.unshift(peeled.particle);
      stem = peeled.stem;
    }

    if (particleTiles.length === 0) {
      items.push({ id: String(id++), content: core + trailingPunct, isParticle: false });
      continue;
    }
    items.push({ id: String(id++), content: stem, isParticle: false });
    particleTiles.forEach((particle, i) => {
      const isLast = i === particleTiles.length - 1;
      items.push({
        id: String(id++),
        content: isLast ? particle + trailingPunct : particle,
        isParticle: true,
      });
    });
  }

  return items;
}

/**
 * 타일 순서를 화면 표시용 문자열로 조립한다.
 * 조사는 앞 타일에 붙이고(공백 없음), 일반 단어 앞에는 공백을 둔다.
 */
export function assembleForDisplay(items: Pick<WordMagnetItem, "content" | "isParticle">[]): string {
  let s = "";
  items.forEach((it, i) => {
    if (i > 0 && !it.isParticle) s += " ";
    s += it.content;
  });
  return s;
}

/** 어순 채점용: 모든 공백 제거. */
export function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}
