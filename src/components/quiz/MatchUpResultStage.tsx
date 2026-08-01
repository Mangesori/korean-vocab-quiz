import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { WordPairResultCard } from "@/components/quiz/shared/WordPairResultCard";
import type { MatchUpProblemData, MatchUpResult } from "./MatchUpStage";

interface MatchUpResultStageProps {
  problems: MatchUpProblemData[];
  results: Record<string, MatchUpResult>;
  onNext: () => void;
  nextLabel: string;
  /** 라이브 세션에서 선생님이 학생 결과를 그대로 볼 때, 학생용 이동 버튼은 숨긴다. */
  hideActions?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export function MatchUpResultStage({ problems, results, onNext, nextLabel, hideActions, onBack, backLabel }: MatchUpResultStageProps) {
  const correctCount = problems.filter((p) => results[p.id]?.isCorrect).length;
  const total = problems.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{score}점</p>
        <p className="text-lg font-medium text-slate-600 mt-3">
          {total}문제 중 <span className="text-primary font-bold">{correctCount}</span>문제를 맞혔어요!
        </p>
      </div>

      <div className="space-y-4">
        {problems.map((p, idx) => {
          const r = results[p.id];
          return (
            <WordPairResultCard
              key={p.id}
              number={idx + 1}
              prompt={p.korean_text}
              correctAnswer={p.meaning_text}
              userAnswer={r?.selectedMeaning || ""}
              isCorrect={!!r?.isCorrect}
            />
          );
        })}
      </div>

      {!hideActions && (
      <div className="flex justify-between items-center">
        {onBack ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">{backLabel ?? "이전"}</span>
            <span className="sm:hidden">이전</span>
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
      )}
    </div>
  );
}
