import { useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';

interface FeedbackPromptCardProps {
  context: string;
  /** 카드 상단 문구 */
  title?: string;
  className?: string;
}

/**
 * 퀴즈 종료 화면용 별점 피드백 카드.
 * 별을 누르면 그 점수로 모달이 열리고, "의견 남기기"는 점수 없이 연다.
 * 검증 단계의 수요 센서 — 주 CTA보다 약하되 분명히 눈에 띄게.
 */
export function FeedbackPromptCard({ context, title = '이 퀴즈, 어땠나요?', className }: FeedbackPromptCardProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const openWith = (rating: number | null) => {
    setPreset(rating);
    setOpen(true);
  };

  return (
    <div
      className={`mx-auto w-full max-w-md rounded-xl border border-border bg-card px-5 py-4 text-center ${className ?? ''}`}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2.5 flex items-center justify-center gap-1.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => openWith(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5"
              aria-label={`${n}점`}
            >
              <Star className={`h-7 w-7 transition-colors ${active ? 'fill-warning text-warning' : 'text-muted-foreground/40 hover:text-warning/60'}`} />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => openWith(null)}
        className="mt-2.5 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
      >
        의견 남기기 <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <FeedbackDialog open={open} onOpenChange={setOpen} context={context} initialRating={preset} />
    </div>
  );
}
