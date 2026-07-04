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
  skipped?: boolean;
}

interface TypeAnswerStageProps {
  problems: TypeAnswerProblemData[];
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (answers: Record<string, string>, skippedIds: string[]) => void;
  onBack?: () => void;
  backLabel?: string;
}

export function TypeAnswerStage({ problems, onProgressUpdate, onComplete, onBack, backLabel }: TypeAnswerStageProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = problems.length;
  const problem = problems[currentIndex];
  const isLast = currentIndex === total - 1;
  const isSkipped = skippedIds.has(problem?.id);
  const currentFilled = !!answers[problem?.id]?.trim() || isSkipped;

  useEffect(() => {
    onProgressUpdate?.(currentIndex + 1, total, `${currentIndex + 1}/${total}`);
  }, [currentIndex, total, onProgressUpdate]);

  const finish = (finalSkipped: Set<string>) => {
    const trimmed: Record<string, string> = {};
    problems.forEach((p) => { trimmed[p.id] = finalSkipped.has(p.id) ? "" : (answers[p.id] || "").trim(); });
    onComplete(trimmed, Array.from(finalSkipped));
  };

  const goNext = () => {
    if (!currentFilled) return;
    if (isLast) {
      finish(skippedIds);
      return;
    }
    setCurrentIndex((i) => Math.min(total - 1, i + 1));
  };

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));

  const handleSkip = () => {
    const next = new Set(skippedIds);
    next.add(problem.id);
    setSkippedIds(next);
    setAnswers((prev) => ({ ...prev, [problem.id]: "" }));
    if (isLast) {
      finish(next);
      return;
    }
    setCurrentIndex((i) => Math.min(total - 1, i + 1));
  };

  if (!problem) return null;

  const skipButton = (
    <button
      type="button"
      onClick={handleSkip}
      className={`inline-block text-sm rounded px-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isSkipped
          ? "text-foreground font-semibold"
          : "text-muted-foreground font-medium hover:text-foreground hover:scale-110"
      }`}
    >
      {isSkipped ? "모르겠어요 (선택됨)" : "모르겠어요"}
    </button>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white mt-4">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-6">
        <p className="text-center text-sm sm:text-base lg:text-lg text-foreground font-bold">
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
          onChange={(e) => {
            const value = e.target.value;
            setAnswers((prev) => ({ ...prev, [problem.id]: value }));
            if (isSkipped) {
              setSkippedIds((prev) => {
                const next = new Set(prev);
                next.delete(problem.id);
                return next;
              });
            }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") goNext(); }}
          placeholder="정답 입력"
          className="h-14 text-center text-xl font-semibold rounded-xl bg-slate-50 placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/60"
        />

        {/* 모바일: 폭이 부족해 네비 줄 위에 별도로 */}
        <div className="sm:hidden flex justify-center pb-2">{skipButton}</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 items-center pt-2 gap-2">
          <div className="justify-self-start">
            {currentIndex === 0 && onBack ? (
              <Button
                variant="outline"
                onClick={onBack}
                className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> 이전
              </Button>
            )}
          </div>

          <div className="hidden sm:flex justify-center">{skipButton}</div>

          <div className="justify-self-end">
            <Button
              onClick={goNext}
              disabled={!currentFilled}
              className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
            >
              {isLast ? "결과 확인" : "다음 문제"} <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
