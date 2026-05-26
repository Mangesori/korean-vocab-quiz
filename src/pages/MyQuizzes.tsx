import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyQuizzes, MyQuizItem } from "@/hooks/useMyQuizzes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, CheckCircle } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";
import { formatDateShort, formatDateFull } from "@/lib/formatDate";

type FilterTab = "all" | "pending" | "completed";

export default function MyQuizzes() {
  const { user } = useAuth();
  const { quizzes, isLoading } = useMyQuizzes(user?.id || "");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedQuiz, setSelectedQuiz] = useState<MyQuizItem | null>(null);
  const navigate = useNavigate();

  const pendingCount = quizzes.filter((q) => q.status === "pending").length;
  const completedCount = quizzes.filter((q) => q.status === "completed").length;

  const filtered = quizzes.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "completed") return q.status === "completed";
    return true;
  });

  const tabClass = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
      filter === tab
        ? "bg-primary text-white"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">전체 퀴즈</h1>
            <p className="text-muted-foreground text-sm mt-1">
              가입된 모든 클래스의 퀴즈를 한 눈에
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{pendingCount}개 미완료</Badge>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{completedCount}개 완료</Badge>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-muted rounded-full p-1 w-fit">
          <button className={tabClass("all")} onClick={() => setFilter("all")}>전체 ({quizzes.length})</button>
          <button className={tabClass("pending")} onClick={() => setFilter("pending")}>미완료 ({pendingCount})</button>
          <button className={tabClass("completed")} onClick={() => setFilter("completed")}>완료 ({completedCount})</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>퀴즈가 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((quiz) => (
              <div
                key={`${quiz.quiz_id}-${quiz.class_id}`}
                className="border border-border rounded-xl p-4 bg-card flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    quiz.status === "completed" ? "bg-success/10" : "bg-primary/10"
                  }`}>
                    {quiz.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{quiz.quiz_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quiz.class_name} · 배정일: {formatDateShort(quiz.assigned_at)}
                    </p>
                    {quiz.status === "completed" && quiz.completed_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quiz.score !== null && quiz.total_questions !== null && (
                          <span className="font-semibold text-foreground mr-1.5">
                            {quiz.score}/{quiz.total_questions}점
                          </span>
                        )}
                        {formatDateFull(quiz.completed_at)} 완료
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {quiz.status === "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedQuiz(quiz)}
                    >
                      결과 확인
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white"
                      onClick={() => navigate(`/quiz/${quiz.quiz_id}/take`)}
                    >
                      퀴즈 풀기 →
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedQuiz && selectedQuiz.result_id && (
        <QuizResultDialog
          isOpen={!!selectedQuiz}
          onClose={() => setSelectedQuiz(null)}
          result={{
            id: selectedQuiz.result_id,
            score: selectedQuiz.score ?? 0,
            total_questions: selectedQuiz.total_questions ?? 0,
            completed_at: selectedQuiz.completed_at ?? "",
            answers: selectedQuiz.answers ?? [],
            fill_blank_score: selectedQuiz.fill_blank_score,
            fill_blank_total: selectedQuiz.fill_blank_total,
            sentence_making_score: selectedQuiz.sentence_making_score,
            sentence_making_total: selectedQuiz.sentence_making_total,
            recording_score: selectedQuiz.recording_score,
            recording_total: selectedQuiz.recording_total,
          }}
          studentName={user?.email || ""}
          quizId={selectedQuiz.quiz_id}
        />
      )}
    </AppLayout>
  );
}
