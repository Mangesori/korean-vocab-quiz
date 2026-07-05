import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import type { WordMagnetGradeResult } from "@/components/quiz/WordMagnetResultStage";

interface WordMagnetResultCardProps {
  result: WordMagnetGradeResult;
  index: number;
}

/**
 * 문장 순서 맞추기 결과 카드 — WordPairResultCard와 동일한 패턴으로 통일:
 * 번호 배지(정답=success/오답=destructive) + 영문 번역 배지 + 우측 상태 아이콘,
 * 아래 '내 답변 / 정답' 라벨 행. WordMagnetResultStage와 결과 페이지들이 공유한다.
 */
export function WordMagnetResultCard({ result: r, index }: WordMagnetResultCardProps) {
  return (
    <Card className="overflow-hidden border bg-white rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0 ${
                r.skipped ? "bg-muted-foreground" : r.isCorrect ? "bg-success" : "bg-destructive"
              }`}
            >
              {index + 1}
            </span>
            <span className="text-base font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-md break-keep">
              {r.translation}
            </span>
          </div>
          {r.skipped ? (
            <HelpCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          ) : r.isCorrect ? (
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
        </div>

        {r.skipped ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-muted text-muted-foreground">
                모름
              </span>
              <p className="text-lg font-bold leading-relaxed text-muted-foreground break-keep">
                문제를 건너뛰었어요
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">{r.correctSentence}</p>
            </div>
          </div>
        ) : r.isCorrect ? (
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
              정답
            </span>
            <p className="text-lg font-bold leading-relaxed text-foreground break-keep">{r.correctSentence}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-destructive/10 text-destructive">
                내 답변
              </span>
              <p className="text-lg font-bold leading-relaxed text-destructive line-through break-keep">
                {r.userSentence || "—"}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">{r.correctSentence}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
