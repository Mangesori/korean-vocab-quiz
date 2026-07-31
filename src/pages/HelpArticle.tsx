import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Footer } from "@/components/layout/Footer";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useFocusOnRouteChange } from "@/hooks/useFocusOnRouteChange";
import { ARTICLES, getArticle, getCategoryOf, getNeighbors, getRelated, type HelpArticleId } from "@/data/help";
import { HelpBreadcrumb } from "@/components/help/HelpBreadcrumb";
import { HelpStepShot } from "@/components/help/HelpStepShot";
import { HelpNotFound } from "@/components/help/HelpNotFound";
import { HelpArticleFeedback } from "@/components/help/HelpArticleFeedback";

function isHelpArticleId(id: string | undefined): id is HelpArticleId {
  return !!id && id in ARTICLES;
}

export default function HelpArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const validId = isHelpArticleId(articleId) ? articleId : undefined;
  const article = validId ? getArticle(validId) : undefined;

  // 두 훅 모두 article 존재 여부와 무관하게 매 렌더 동일한 순서로 호출해야 한다
  // (Rules of Hooks) — 문서를 못 찾은 경우의 분기는 이 아래에서 처리한다.
  const headingRef = useFocusOnRouteChange<HTMLHeadingElement>(articleId);
  useDocumentMeta({
    title: article?.title ?? "문서를 찾을 수 없어요",
    description: article?.summary,
  });

  if (!article || !validId) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader />
        <main className="flex-1">
          <HelpNotFound query={articleId} />
        </main>
        <Footer />
      </div>
    );
  }

  const category = getCategoryOf(validId);
  const related = getRelated(article);
  const { prev, next } = getNeighbors(validId);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">
        <section className="container max-w-3xl py-10 md:py-14">
          <div className="mb-5">
            <HelpBreadcrumb role={article.role} categoryLabel={category?.label ?? ""} title={article.title} />
          </div>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-3 rounded-sm text-2xl font-black leading-[1.25] tracking-tight text-foreground break-keep outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-3xl"
          >
            {article.title}
          </h1>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground break-keep">{article.intro}</p>

          <h2 className="mb-4 text-lg font-black text-foreground">따라 하기</h2>
          <div className="mb-8 flex flex-col">
            {article.steps.map((step, index) => {
              const stepNumber = index + 1;
              return (
                <div key={stepNumber} className="flex gap-4 pb-6 last:pb-0">
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                      {stepNumber}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="mb-1 text-[15px] font-bold text-foreground break-keep">{step.title}</div>
                    <p className="text-sm leading-relaxed text-muted-foreground break-keep">{step.body}</p>
                    {step.shot && (
                      <div className="mt-3">
                        <HelpStepShot articleId={validId} stepNumber={stepNumber} caption={step.shot.caption} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-accent px-4 py-3.5">
            <Lightbulb className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-accent-foreground break-keep">
              <span className="mr-1 font-black text-primary">TIP</span>
              {article.tip}
            </p>
          </div>

          {article.caution && (
            <div className="mb-8 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
              <p className="text-sm leading-relaxed text-foreground break-keep">
                <span className="mr-1 font-black text-warning">주의</span>
                {article.caution}
              </p>
            </div>
          )}

          {related.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3.5 text-base font-black text-foreground">관련 도움말</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/help/${r.id}`}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground break-keep transition-colors hover:border-primary"
                  >
                    {r.title}
                    <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <HelpArticleFeedback articleId={article.id} articleTitle={article.title} />

          {(prev || next) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {prev && (
                <Link
                  to={`/help/${prev.id}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-muted-foreground">이전 문서</span>
                    <span className="block truncate text-sm font-bold text-foreground break-keep">{prev.title}</span>
                  </span>
                </Link>
              )}
              {next && (
                <Link
                  to={`/help/${next.id}`}
                  className={`flex items-center justify-end gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-right transition-colors hover:border-primary ${
                    prev ? "sm:col-start-2" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-muted-foreground">다음 문서</span>
                    <span className="block truncate text-sm font-bold text-foreground break-keep">{next.title}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
