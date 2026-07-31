import type { HelpArticle, HelpFaq, HelpRole } from "@/data/help";
import { HelpArticleRow } from "./HelpArticleRow";
import { HelpFaqList } from "./HelpFaqList";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

interface HelpSearchResultsProps {
  query: string;
  articles: HelpArticle[];
  faqs: (HelpFaq & { role: HelpRole })[];
}

export function HelpSearchResults({ query, articles, faqs }: HelpSearchResultsProps) {
  const total = articles.length + faqs.length;

  return (
    <section className="border-t border-border bg-background py-16 md:py-20">
      <div className="container max-w-3xl">
        <p className="mb-6 text-[15px] text-muted-foreground break-keep">
          '<strong className="text-foreground">{query}</strong>' 검색 결과{" "}
          <strong className="text-primary">{total}</strong>건
        </p>

        {total === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
            <p className="mb-1.5 text-[15px] font-bold text-foreground">검색 결과가 없어요</p>
            <p className="mb-4 text-sm text-muted-foreground break-keep">
              다른 키워드로 검색하거나 아래에서 직접 문의해 주세요.
            </p>
            <FeedbackButton
              context="help_search_empty"
              label="원하는 문서를 못 찾으셨나요? 알려주세요"
              variant="outline"
            />
          </div>
        ) : (
          <>
            {articles.length > 0 && (
              <div className={faqs.length > 0 ? "mb-7" : ""}>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">문서</p>
                <div className="flex flex-col gap-2.5">
                  {articles.map((article) => (
                    <HelpArticleRow key={article.id} article={article} variant="detailed" query={query} />
                  ))}
                </div>
              </div>
            )}
            {faqs.length > 0 && (
              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">관련 질문</p>
                <HelpFaqList faqs={faqs} query={query} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
