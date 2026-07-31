import { ARTICLES, ARTICLE_ORDER } from "./articles";
import type { HelpArticleId } from "./articles";
import { CATEGORY_GROUPS } from "./categories";
import type { HelpArticle, HelpCategory, HelpRole } from "./types";

export * from "./types";
export { ARTICLES, ARTICLE_ORDER } from "./articles";
export type { HelpArticleId } from "./articles";
export { CATEGORY_GROUPS } from "./categories";
export { TEACHER_FAQ, STUDENT_FAQ, ALL_FAQ } from "./faq";
export { POPULAR } from "./popular";

/** id로 문서 하나를 가져온다. */
export function getArticle(id: HelpArticleId): HelpArticle {
  return ARTICLES[id];
}

/** 문서가 속한 카테고리를 찾는다. 모든 문서는 정확히 하나의 카테고리에 속한다
 *  (그렇지 않으면 scripts/help-shots/verify.ts가 실패한다). */
export function getCategoryOf(articleId: HelpArticleId): HelpCategory | undefined {
  for (const role of Object.keys(CATEGORY_GROUPS) as HelpRole[]) {
    for (const category of CATEGORY_GROUPS[role]) {
      if ((category.articleIds as HelpArticleId[]).includes(articleId)) return category;
    }
  }
  return undefined;
}

/** 같은 role 안에서, 선언 순서(ARTICLE_ORDER) 기준 이전/다음 문서. */
export function getNeighbors(id: HelpArticleId): { prev: HelpArticle | null; next: HelpArticle | null } {
  const role = ARTICLES[id].role;
  const idsInRole = ARTICLE_ORDER.filter((articleId) => ARTICLES[articleId].role === role);
  const index = idsInRole.indexOf(id);
  const prev = index > 0 ? ARTICLES[idsInRole[index - 1]] : null;
  const next = index >= 0 && index < idsInRole.length - 1 ? ARTICLES[idsInRole[index + 1]] : null;
  return { prev, next };
}

/** article.related의 id들을 실제 HelpArticle로 해석한다. 존재하지 않는 id는 조용히 걸러낸다
 *  (verify.ts가 애초에 존재하지 않는 related id를 에러로 잡아내므로 런타임 방어용). */
export function getRelated(article: HelpArticle): HelpArticle[] {
  return article.related.filter((id): id is HelpArticleId => id in ARTICLES).map((id) => ARTICLES[id]);
}

const SHOT_BASE_PATH = "/help";

/** shot-<articleId>-<stepNumber>.png 파일명 규칙의 단일 소스.
 *  캡처 스크립트(scripts/help-shots/capture.ts)와 화면 컴포넌트(StepShot 등)는
 *  반드시 이 함수만 참조한다 — 파일명 로직을 두 곳에 따로 두지 않는다.
 *  정적 파일 경로가 /help 라우트와 충돌하면 SHOT_BASE_PATH 한 곳만 바꾸면 된다. */
export function shotPath(articleId: HelpArticleId, stepNumber: number): string {
  return `${SHOT_BASE_PATH}/shot-${articleId}-${stepNumber}.png`;
}
