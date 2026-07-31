import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getCategoryOf, type HelpArticle, type HelpArticleId } from "@/data/help";
import { highlight } from "@/lib/help/highlight";

interface HelpArticleRowProps {
  article: HelpArticle;
  /** compact: 카테고리 카드 안의 목록 줄. detailed: 검색 결과의 풍부한 카드형 줄. */
  variant?: "compact" | "detailed";
  query?: string;
}

export function HelpArticleRow({ article, variant = "compact", query = "" }: HelpArticleRowProps) {
  if (variant === "compact") {
    return (
      <Link
        to={`/help/${article.id}`}
        className="group flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        <span className="flex-1 break-keep">{article.title}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    );
  }

  const category = getCategoryOf(article.id as HelpArticleId);

  return (
    <Link
      to={`/help/${article.id}`}
      className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4.5 py-4 transition-colors hover:bg-accent/40"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            {article.role === "teacher" ? "선생님" : "학생"}
          </span>
          <span className="text-xs text-muted-foreground">{category?.label}</span>
        </div>
        <div className="mb-0.5 text-[15px] font-bold text-foreground break-keep">{highlight(article.title, query)}</div>
        <div className="text-[13px] leading-relaxed text-muted-foreground break-keep">
          {highlight(article.summary, query)}
        </div>
      </div>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
