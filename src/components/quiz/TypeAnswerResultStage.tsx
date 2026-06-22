import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, ChevronLeft } from "lucide-react";
import type { TypeAnswerGradeResult } from "./TypeAnswerStage";

interface TypeAnswerResultStageProps {
  results: TypeAnswerGradeResult[];
  onNext: () => void;
  nextLabel: string;
  onBack?: () => void;
}

export function TypeAnswerResultStage({ results, onNext, nextLabel, onBack }: TypeAnswerResultStageProps) {
  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{score}점</p>
        <p className="text-lg font-medium text-slate-600 mt-3">
          {total}문제 중 <span className="text-primary font-bold">{correctCount}</span>문제를 맞혔어요!
        </p>
      </div>

      <Card className="border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
        <CardContent className="p-0 sm:p-4 md:p-6 space-y-2.5">
          {results.map((r) => (
            <div
              key={r.problemId}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                r.isCorrect ? "border-primary/30 bg-accent/50" : "border-destructive/30 bg-destructive/5"
              }`}
            >
              {r.isCorrect ? (
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              )}
              <span className="text-muted-foreground break-keep">{r.prompt}</span>
              <span className="text-muted-foreground">→</span>
              {r.isCorrect ? (
                <span className="font-bold text-foreground break-keep">{r.correctAnswer}</span>
              ) : (
                <span className="flex flex-col sm:flex-row sm:items-center sm:gap-2 break-keep">
                  <span className="text-destructive line-through">{r.userAnswer || "—"}</span>
                  <span className="text-primary font-bold">{r.correctAnswer}</span>
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        {onBack ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> 이전
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={onNext}
          className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
        >
          {nextLabel} <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
