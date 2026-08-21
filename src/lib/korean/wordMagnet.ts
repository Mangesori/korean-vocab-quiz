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
 * 격조사 뒤에 붙어 두 겹째로 겹칠 수 있는 보조사(는/도/만/조차/마저/밖에).
 * 한국어에서 조사가 두 겹 겹치는 경우는 사실상 [격조사]+[보조사] 순서뿐이다.
 * 이 집합에 없는 조사가 먼저 벗겨졌다면(예: "이","가","로" 등 격조사) 그 자체로
 * 어절이 끝난 것으로 보고 더 벗기지 않는다 — 안 그러면 "벽난로"(명사)의 "로",
 * "제주도"의 "도"처럼 조사가 아닌 어간 끝음절까지 조사로 오인해 쪼갠다.
 */
const OUTER_STACKABLE_PARTICLES = new Set(["는", "도", "만", "조차", "마저", "밖에"]);

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

    // 조사가 겹쳐 있으면("에는", "에서는") 벗긴다. 단, 무한정 반복하면
    // "벽난로에"→"벽난"+[로]+[에]처럼 조사가 아닌 어간 끝음절까지 조사로
    // 오인해 과도하게 쪼개는 사고가 난다(실측: Kiwi 채점 기준 정답률이 오히려
    // 떨어짐). 한국어 조사는 [격조사] + [보조사](는/도/만/조차/마저/밖에)
    // 순으로만 두 겹 겹치므로, 첫 겹이 보조사일 때만 한 겹 더 벗기고 그 이상은
    // 시도하지 않는다(최대 2겹).
    const particleTiles: string[] = [];
    let stem = core;
    const firstPeel = peelOneParticle(stem);
    if (firstPeel) {
      particleTiles.unshift(firstPeel.particle);
      stem = firstPeel.stem;
      if (OUTER_STACKABLE_PARTICLES.has(firstPeel.particle)) {
        const secondPeel = peelOneParticle(stem);
        if (secondPeel) {
          particleTiles.unshift(secondPeel.particle);
          stem = secondPeel.stem;
        }
      }
    }

    if (particleTiles.length === 0) {
      items.push({ id: String(id++), content: core + trailingPunct, isParticle: false });
      continue;
    }

    // 가드: 의존명사 "거"에 현재·미래 추측 조사(예요/이에요)가 붙으면("거예요")
    // "거"만 남기고 쪼개는 게 부자연스러워 통째로 한 타일로 둔다. 단 과거
    // 회상·무산된 계획을 나타내는 "거였어요"(였어요/이었어요)는 일반적인
    // 명사+서술격 조사와 같이 "거" / "였어요"로 정상 분리한다.
    const isPastCopula =
      particleTiles.length === 1 &&
      (particleTiles[0] === "였어요" || particleTiles[0] === "이었어요");
    if (stem === "거" && !isPastCopula) {
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
