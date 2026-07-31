import { ARTICLES, ARTICLE_ORDER, ALL_FAQ, getCategoryOf, type HelpArticleId } from "@/data/help";
import type { HelpArticle, HelpFaq, HelpRole } from "@/data/help";

export interface HelpSearchResult {
  articles: HelpArticle[];
  faqs: (HelpFaq & { role: HelpRole })[];
}

// macOS 클립보드 등에서 텍스트가 NFD로 들어오면 NFC로 쓰인 인덱스와 includes()가
// false를 반환한다. 쿼리·인덱스 양쪽 다 NFC로 정규화해 이 문제를 없앤다.
function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

// tip·caution까지 포함해야 "이어폰"(tip 전용)·"마이크 차단"(caution 전용) 같은
// 검색어가 매칭된다. category는 categoryKey가 아니라 사람이 읽는 라벨("클래스 관리" 등)로 넣는다.
function articleHaystack(article: HelpArticle): string {
  const category = getCategoryOf(article.id as HelpArticleId)?.label ?? "";
  const stepsText = article.steps.map((step) => `${step.title} ${step.body}`).join(" ");
  return normalize(
    [article.title, article.summary, article.intro, category, stepsText, article.tip, article.caution ?? ""].join(
      " ",
    ),
  );
}

function faqHaystack(faq: HelpFaq): string {
  return normalize(`${faq.q} ${faq.a}`);
}

/** role이 일치하는 항목을 앞으로 보내는 stable sort 비교자.
 *  Array#sort는 ES2019+에서 stable이 보장되므로 role이 같은 항목끼리는
 *  원래(선언) 순서가 유지된다. */
function byCurrentRoleFirst(role: HelpRole) {
  return (a: { role: HelpRole }, b: { role: HelpRole }) => {
    const aFirst = a.role === role;
    const bFirst = b.role === role;
    if (aFirst === bFirst) return 0;
    return aFirst ? -1 : 1;
  };
}

/** 문서 + FAQ 전역 검색. 현재 role을 결과 상단으로 정렬한다(다른 role도 계속 보인다 —
 *  검색은 전역이라 역할은 정렬 기준일 뿐 필터가 아니다). */
export function searchHelp(query: string, role: HelpRole): HelpSearchResult {
  const q = normalize(query.trim());
  if (!q) return { articles: [], faqs: [] };

  const articles = ARTICLE_ORDER.map((id) => ARTICLES[id]).filter((article) => articleHaystack(article).includes(q));

  const faqs = ALL_FAQ.filter((faq) => faqHaystack(faq).includes(q));

  return {
    articles: [...articles].sort(byCurrentRoleFirst(role)),
    faqs: [...faqs].sort(byCurrentRoleFirst(role)),
  };
}
