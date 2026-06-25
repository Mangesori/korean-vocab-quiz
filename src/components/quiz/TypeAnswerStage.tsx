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

  const filledCount = problems.filter((p) => answers[p.id]?.trim()).length;
  const total = problems.length;
  const allFilled = filledCount === total && total > 0;

  useEffect(() => {
    onProgressUpdate?.(filledCount, total, `${filledCount}/${total}`);
  }, [filledCount, total, onProgressUpdate]);

  const handleSubmit = () => {
    if (!allFilled) return;
    const trimmed: Record<string, string> = {};
    problems.forEach((p) => { trimmed[p.id] = (answers[p.id] || "").trim(); });
    onComplete(trimmed);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          뜻을 보고 알맞은 한국어 단어를 입력하세요
        </p>

        {/* 받아쓰기 라인 — 번호 · 뜻 · 밑줄 입력 */}
        <div className="divide-y divide-border">
          {problems.map((p, idx) => {
            const filled = !!answers[p.id]?.trim();
            return (
              <div key={p.id} className="flex items-center gap-3 sm:gap-5 py-3.5">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="flex-shrink-0 w-28 sm:w-44 text-sm sm:text-base text-muted-foreground break-keep">
                  {p.prompt}
                </span>
                <Input
                  value={answers[p.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="여기에 입력"
                  className={`flex-1 h-10 px-1 rounded-none border-0 border-b-2 bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/60 ${
                    filled
                      ? "border-primary text-foreground"
                      : "border-border focus-visible:border-primary"
                  }`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2">
          {onBack ? (
            <Button
              variant="outline"
              onClick={onBack}
              className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
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
