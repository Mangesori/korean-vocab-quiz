import { ChevronDown } from "lucide-react";
import type { HelpFaq, HelpRole } from "@/data/help";
import { highlight } from "@/lib/help/highlight";

interface HelpFaqListProps {
  faqs: (HelpFaq | (HelpFaq & { role: HelpRole }))[];
  /** 검색 결과에서 넘어올 때만 하이라이트한다. 홈 화면 FAQ는 빈 문자열. */
  query?: string;
}

export function HelpFaqList({ faqs, query = "" }: HelpFaqListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {faqs.map((faq, index) => (
        <details key={index} className="group overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3.5 px-4 py-4 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 break-keep">
              {"role" in faq && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                  {faq.role === "teacher" ? "선생님" : "학생"}
                </span>
              )}
              <span>{highlight(faq.q, query)}</span>
            </span>
            <ChevronDown className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground break-keep">
            {highlight(faq.a, query)}
          </div>
        </details>
      ))}
    </div>
  );
}
