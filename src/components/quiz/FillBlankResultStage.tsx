import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";

interface FillBlankAnswer {
  problemId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  sentence: string;
  word: string;
  hint?: string;
  translation?: string;
  sentence_audio_url?: string;
}

interface FillBlankResultStageProps {
  answers: FillBlankAnswer[];
  onNext: () => void;
  nextLabel: string;
  onBack?: () => void;
  backLabel?: string;
}

export function FillBlankResultStage({
  answers,
  onNext,
  nextLabel,
  onBack,
  backLabel,
}: FillBlankResultStageProps) {
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalCount = answers.length;
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* 문제별 결과 */}
      <div className="grid gap-4">
        {answers.map((answer, idx) => (
          <QuizReviewCard
            key={answer.problemId}
            problem={{
              id: answer.problemId,
              word: answer.word,
              answer: answer.correctAnswer,
              sentence: answer.sentence,
              hint: answer.hint || "",
              translation: answer.translation || "",
              sentence_audio_url: answer.sentence_audio_url,
            }}
            userAnswer={answer.userAnswer}
            isCorrect={answer.isCorrect}
            problemNumber={idx + 1}
          />
        ))}
      </div>

      {/* 이전 / 다음 버튼 */}
      <div className="flex justify-between items-center mt-8">
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
          onClick={onNext}
          className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
        >
          {nextLabel}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
