import { ARTICLES, type HelpArticleId, type HelpCategory } from "@/data/help";
import { HelpArticleRow } from "./HelpArticleRow";

export function HelpCategoryCard({ category }: { category: HelpCategory }) {
  const Icon = category.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-[22px] transition-shadow hover:shadow-md">
      <div className="mb-3.5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-[15px] font-bold text-foreground break-keep">{category.label}</h3>
      </div>
      <div className="flex flex-col gap-0.5">
        {category.articleIds.map((id) => (
          <HelpArticleRow key={id} article={ARTICLES[id as HelpArticleId]} variant="compact" />
        ))}
      </div>
    </div>
  );
}
