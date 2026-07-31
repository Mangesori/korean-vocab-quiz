import { Link } from "react-router-dom";
import { getCategoryOf, type HelpArticle, type HelpArticleId } from "@/data/help";

export function HelpPopularCard({ article }: { article: HelpArticle }) {
  const category = getCategoryOf(article.id as HelpArticleId);

  return (
    <Link
      to={`/help/${article.id}`}
      className="flex flex-col gap-1.5 rounded-2xl border border-border bg-background p-[18px] text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="text-[11px] font-bold text-muted-foreground">{category?.label}</span>
      <span className="text-[14.5px] font-bold leading-snug text-foreground break-keep">{article.title}</span>
      <span className="text-[12.5px] leading-relaxed text-muted-foreground break-keep">{article.summary}</span>
    </Link>
  );
}
