import { useState } from "react";
import { shotPath, type HelpArticleId } from "@/data/help";

interface HelpStepShotProps {
  articleId: HelpArticleId;
  stepNumber: number;
  caption: string;
}

/** 캡처 실패(파일 없음) 시 자리표시자 없이 블록 전체를 숨긴다 — 계획서 정책. */
export function HelpStepShot({ articleId, stepNumber, caption }: HelpStepShotProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border bg-background px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 truncate text-xs text-muted-foreground break-keep">{caption}</span>
      </div>
      <img
        src={shotPath(articleId, stepNumber)}
        alt={caption}
        loading="lazy"
        className="aspect-video w-full object-cover"
        onError={() => setHidden(true)}
      />
    </div>
  );
}
