import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft } from "lucide-react";

export interface TypeAnswerProblemData {
  id: string; // problem_id
  prompt: string; // 뜻
}

export interface TypeAnswerGradeResult {
  problemId: string;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

interface TypeAnswerStageProps {
  problems: TypeAnswerProblemData[];
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (answers: Record<string, string>) => void;
  onBack?: () => void;
  backLabel?: string;
}

export function TypeAnswerStage({ problems, onProgressUpdate, onComplete, onBack, backLabel }: TypeAnswerStageProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = problems.length;
  const problem = problems[currentIndex];
  const isLast = currentIndex === total - 1;
  const currentFilled = !!answers[problem?.id]?.trim();

  useEffect(() => {
    onProgressUpdate?.(currentIndex + 1, total, `${currentIndex + 1}/${total}`);
  }, [currentIndex, total, onProgressUpdate]);

  const goNext = () => {
    if (!currentFilled) return;
    if (isLast) {
      const trimmed: Record<string, string> = {};
      problems.forEach((p) => { trimmed[p.id] = (answers[p.id] || "").trim(); });
      onComplete(trimmed);
      return;
    }
    setCurrentIndex((i) => Math.min(total - 1, i + 1));
  };

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));

  if (!problem) return null;

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-6">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          뜻을 보고 알맞은 한국어 단어를 입력하세요
        </p>

        {/* 프롬프트(뜻) */}
        <div className="p-6 sm:p-8 bg-slate-50 rounded-2xl text-center min-h-[110px] flex items-center justify-center">
          <p className="text-xl sm:text-2xl font-bold text-foreground break-keep">{problem.prompt}</p>
        </div>

        {/* 입력 */}
        <Input
          key={problem.id}
          autoFocus
          value={answers[problem.id] || ""}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [problem.id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") goNext(); }}
          placeholder="한국어 단어 입력"
          className="h-14 text-center text-xl font-semibold rounded-2xl border-2 border-border bg-white focus-visible:border-primary focus-visible:ring-primary/20 placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/60"
        />

        <div className="flex justify-between items-center pt-2">
          {currentIndex === 0 ? (
            onBack ? (
              <Button
                variant="outline"
                onClick={onBack}
                className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
              </Button>
            ) : (
              <span />
            )
          ) : (
            <Button
              variant="outline"
              onClick={goPrev}
              className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> 이전
            </Button>
          )}

          <Button
            onClick={goNext}
            disabled={!currentFilled}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            {isLast ? "결과 확인" : "다음 문제"} <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
