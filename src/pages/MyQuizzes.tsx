import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useMyQuizzes, MyQuizItem } from "@/hooks/useMyQuizzes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, BookOpen } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";
import { STAGE_ORDER, isStageEnabled, type BaseStage } from "@/types/quiz";

type FilterTab = "all" | "pending" | "completed";

const STAGE_SCORE_KEY: Record<BaseStage, keyof MyQuizItem> = {
  matchup: "matchup_score",
  type_answer: "type_answer_score",
  fill_blank: "fill_blank_score",
  word_magnet: "word_magnet_score",
  sentence_making: "sentence_making_score",
  recording: "recording_score",
};

const STAGE_TOTAL_KEY: Record<BaseStage, keyof MyQuizItem> = {
  matchup: "matchup_total",
  type_answer: "type_answer_total",
  fill_blank: "fill_blank_total",
  word_magnet: "word_magnet_total",
  sentence_making: "sentence_making_total",
  recording: "recording_total",
};

function shortDate(date: string) {
  return format(new Date(date), "M월 d일", { locale: ko });
}

function enabledStages(quiz: MyQuizItem) {
  return STAGE_ORDER.filter((stage) => isStageEnabled(stage, quiz as unknown as Record<string, unknown>));
}

/** 부분 진행 중인 퀴즈의 진행률 — 채점된 활성 스테이지 수 ÷ 활성 스테이지 수. */
function progressOf(quiz: MyQuizItem) {
  const stages = enabledStages(quiz);
  const completed = stages.filter((s) => typeof quiz[STAGE_SCORE_KEY[s]] === "number").length;
  return { completed, total: stages.length, percent: stages.length > 0 ? Math.round((completed / stages.length) * 100) : 0 };
}

/** 점수 미니 바 색 — 정답률 높음(#1E6B47) / 낮음(#8FBFA6) / 미제출(#E2DDD8) 3단계. */
function scoreBarColor(quiz: MyQuizItem, stage: BaseStage) {
  if (!isStageEnabled(stage, quiz as unknown as Record<string, unknown>)) return "#E2DDD8";
  const score = quiz[STAGE_SCORE_KEY[stage]] as number | null;
  const total = quiz[STAGE_TOTAL_KEY[stage]] as number | null;
  if (score === null || score === undefined || !total) return "#E2DDD8";
  return score / total >= 0.8 ? "#1E6B47" : "#8FBFA6";
}

export default function MyQuizzes() {
  const { user } = useAuth();
  const { quizzes, isLoading } = useMyQuizzes(user?.id || "");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedQuiz, setSelectedQuiz] = useState<MyQuizItem | null>(null);

  const pendingCount = quizzes.filter((q) => q.status === "pending").length;
  const completedCount = quizzes.filter((q) => q.status === "completed").length;

  const filtered = quizzes.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "completed") return q.status === "completed";
    return true;
  });

  const tabClass = (tab: FilterTab) =>
    `text-[12.5px] font-bold rounded-full px-[15px] py-[6px] transition-colors ${
      filter === tab ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.4px]">전체 퀴즈</h1>
            <p className="text-[13px] text-muted-foreground mt-[5px]">배정받은 퀴즈와 지난 결과</p>
          </div>
          <div className="flex gap-1 bg-[#F0EBE5] rounded-full p-[3px] w-fit">
            <button className={tabClass("all")} onClick={() => setFilter("all")}>전체 {quizzes.length}</button>
            <button className={tabClass("pending")} onClick={() => setFilter("pending")}>미완료 {pendingCount}</button>
            <button className={tabClass("completed")} onClick={() => setFilter("completed")}>완료 {completedCount}</button>
          </div>
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
          <>
            {/* 모바일: 카드 행 */}
            <div className="sm:hidden mt-5 flex flex-col gap-2.5">
              {filtered.map((quiz) => {
                const isPending = quiz.status === "pending";
                const prog = progressOf(quiz);
                const started = prog.completed > 0;
                return (
                  <div
                    key={quiz.quiz_id}
                    className={`bg-card border rounded-2xl p-4 ${isPending && started ? 'border-[#D9E8DF]' : 'border-border'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{quiz.quiz_title}</p>
                        <p className="text-[11.5px] text-muted-foreground mt-[3px]">
                          {quiz.class_name}
                          {isPending
                            ? ` · ${started ? formatAssigned(quiz.assigned_at) : '아직 시작 안 함'}`
                            : ` · ${shortDate(quiz.completed_at!)} 완료`}
                        </p>
                      </div>
                      {!isPending && (
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold text-primary">
                            {quiz.score}<span className="text-[11px] text-muted-foreground font-semibold">/{quiz.total_questions}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {isPending ? (
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-[5px] rounded-full bg-[#F0EBE5] overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${prog.percent}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{prog.completed}/{prog.total}</span>
                      </div>
                    ) : (
                      <div className="flex gap-[3px] mt-2.5">
                        {STAGE_ORDER.map((stage) => (
                          <div key={stage} className="flex-1 h-1 rounded-sm" style={{ background: scoreBarColor(quiz, stage) }} />
                        ))}
                      </div>
                    )}

                    {isPending ? (
                      <Link to={`/quiz/${quiz.quiz_id}/take`} className="block mt-3.5">
                        <span
                          className={`block text-center rounded-[10px] py-[11px] text-[13px] font-bold ${
                            started ? 'bg-primary text-white' : 'border border-primary text-primary'
                          }`}
                        >
                          {started ? '이어서 풀기 →' : '시작하기'}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex gap-2 mt-3.5">
                        <button className="flex-1 text-center text-xs font-semibold border border-[#E2DDD8] rounded-[10px] py-2.5" onClick={() => setSelectedQuiz(quiz)}>
                          결과 확인
                        </button>
                        <Link to={`/quiz/${quiz.quiz_id}/take`} className="flex-1">
                          <span className="block text-center text-xs font-bold text-primary border border-primary rounded-[10px] py-2.5">다시 풀기</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 데스크톱: 테이블형 행 */}
            <div className="hidden sm:block mt-5 bg-card border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_150px_130px_168px] gap-3 px-[22px] py-[10px] bg-background border-b border-[#F0EBE5] text-[11px] font-semibold text-muted-foreground">
                <span>퀴즈</span><span>진행 · 점수</span><span>날짜</span><span />
              </div>
              {filtered.map((quiz, i) => {
                const isPending = quiz.status === "pending";
                const prog = progressOf(quiz);
                const started = prog.completed > 0;
                return (
                  <div
                    key={quiz.quiz_id}
                    className={`grid grid-cols-[minmax(0,1fr)_150px_130px_168px] gap-3 items-center px-[22px] py-[15px] ${
                      i < filtered.length - 1 ? 'border-b border-[#F5F1EC]' : ''
                    } ${isPending && started ? 'bg-[#FCFDFC]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isPending ? '' : 'text-muted-foreground'}`}>{quiz.quiz_title}</p>
                      <p className="text-[11.5px] text-muted-foreground mt-[3px]">{quiz.class_name}</p>
                    </div>

                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[5px] rounded-full bg-[#F0EBE5] overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${prog.percent}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground">{prog.completed}/{prog.total}</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-bold text-primary">
                          {quiz.score}<span className="text-[11px] text-muted-foreground font-semibold">/{quiz.total_questions}</span>
                        </div>
                        <div className="flex gap-[3px] mt-[5px]">
                          {STAGE_ORDER.map((stage) => (
                            <div key={stage} className="w-[13px] h-1 rounded-sm" style={{ background: scoreBarColor(quiz, stage) }} />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {isPending ? formatAssigned(quiz.assigned_at) : `${shortDate(quiz.completed_at!)} 완료`}
                    </div>

                    {isPending ? (
                      <Link to={`/quiz/${quiz.quiz_id}/take`}>
                        <span
                          className={`block text-center rounded-[9px] py-[7px] text-xs font-bold ${
                            started ? 'bg-primary text-white' : 'border border-primary text-primary'
                          }`}
                        >
                          {started ? '이어서 풀기' : '시작하기'}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          className="flex-1 text-xs font-semibold text-foreground border border-[#E2DDD8] rounded-[9px] py-[6px] hover:bg-muted/40 transition-colors"
                          onClick={() => setSelectedQuiz(quiz)}
                        >
                          결과 확인
                        </button>
                        <Link to={`/quiz/${quiz.quiz_id}/take`} className="flex-1">
                          <span className="block text-center text-xs font-bold text-primary border border-primary rounded-[9px] py-[6px] hover:bg-primary/5 transition-colors">
                            다시 풀기
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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

function formatAssigned(date: string) {
  return `${format(new Date(date), "M월 d일", { locale: ko })} 배정`;
}
