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
}

export function TypeAnswerStage({ problems, onProgressUpdate, onComplete, onBack }: TypeAnswerStageProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const filledCount = problems.filter((p) => answers[p.id]?.trim()).length;
  const total = problems.length;
  const allFilled = filledCount === total && total > 0;

  useEffect(() => {
    onProgressUpdate?.(filledCount, total, `${filledCount}/${total}`);
  }, [filledCount, total, onProgressUpdate]);

  const handleSubmit = () => {
    if (!allFilled) return;
    const trimmed: Record<string, string> = {};
    problems.forEach((p) => {
      trimmed[p.id] = (answers[p.id] || "").trim();
    });
    onComplete(trimmed);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          뜻을 보고 알맞은 한국어 단어를 입력하세요
        </p>

        <div className="space-y-3">
          {problems.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-border bg-white px-3 py-3 sm:px-4 sm:py-3.5"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="flex-1 text-sm sm:text-base text-foreground break-keep">{p.prompt}</span>
              <Input
                value={answers[p.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [p.id]: e.target.value }))}
                placeholder="한국어 단어"
                className="w-32 sm:w-44 rounded-xl border-slate-200 focus-visible:ring-primary/20"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
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
            onClick={handleSubmit}
            disabled={!allFilled}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            확인 <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
