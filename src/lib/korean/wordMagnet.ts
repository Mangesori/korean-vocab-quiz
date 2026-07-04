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
export function parseSentenceToItems(text: string): WordMagnetItem[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const items: WordMagnetItem[] = [];
  let id = 1;

  for (const word of words) {
    let matched = false;
    for (const particle of PARTICLES) {
      if (word.endsWith(particle) && word.length > particle.length) {
        const stem = word.slice(0, -particle.length);
        items.push({ id: String(id++), content: stem, isParticle: false });
        items.push({ id: String(id++), content: particle, isParticle: true });
        matched = true;
        break;
      }
    }
    if (!matched) {
      items.push({ id: String(id++), content: word, isParticle: false });
    }
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
