import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
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
}

export function FillBlankResultStage({
  answers,
  onNext,
  nextLabel,
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

      {/* 다음 단계 버튼 */}
      <div className="text-center space-y-4 mt-8">
        <Button
          onClick={onNext}
          className="w-full sm:w-auto min-w-[200px] h-12 text-lg shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          {nextLabel}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
