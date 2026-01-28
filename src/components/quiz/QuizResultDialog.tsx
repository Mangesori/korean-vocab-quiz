import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCircle } from "lucide-react";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";

interface QuizResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    score: number;
    total_questions: number;
    completed_at: string;
    answers: any[];
  } | null;
  studentName: string;
  isAnonymous?: boolean;
}

export function QuizResultDialog({
  isOpen,
  onClose,
  result,
  studentName,
  isAnonymous = false,
}: QuizResultDialogProps) {
  if (!result) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>퀴즈 결과 상세</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isAnonymous ? (
                <UserCircle className="h-10 w-10 text-muted-foreground" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {(studentName || "?")[0]}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold text-lg">{studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(result.completed_at), "yyyy년 M월 d일 a h:mm", {
                    locale: ko,
                  })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {result.score} / {result.total_questions}
              </p>
              <p className="text-sm text-muted-foreground">
                정답률 {Math.round((result.score / result.total_questions) * 100)}%
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-lg">문제별 상세</h3>
            <div className="grid gap-4">
              {result.answers.map((answer: any, index: number) => {
                const problemData = {
                  id: answer.problemId || String(index),
                  word: answer.word || "",
                  answer: answer.correctAnswer,
                  sentence: answer.sentence || "문제 내용 없음",
                  hint: "",
                  translation: answer.translation || "",
                  sentence_audio_url: answer.audioUrl,
                };

                return (
                  <QuizReviewCard
                    key={index}
                    problem={problemData}
                    userAnswer={answer.userAnswer}
                    isCorrect={answer.isCorrect}
                    problemNumber={index + 1}
                    isTeacherView={true}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
