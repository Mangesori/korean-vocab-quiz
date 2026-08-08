/**
 * 오늘의 복습 — 예정일이 된 단어만 모아 바로 풀게 하는 화면.
 *
 * 오답노트(/wrong-answers)와 목적이 다르다.
 *   오답노트 = 참고 자료. "내가 뭘 틀렸었지?" 검색·필터·단어장 담기. 시점 개념 없음.
 *   오늘의 복습 = 할 일. "지금 이거 풀어라." 시작과 끝이 분명하다.
 * 한 화면에 섞으면 둘 다 흐려져서 페이지를 나눴다.
 *
 * 문항은 get_due_review_items가 골라 준다. 같은 단어라도 복습 차례마다 다른
 * 문장이 오고(원본 → 은행1 → 은행2 → 원본 ...), 레벨은 올라가지 않는다.
 * 실제 풀이는 기존 연습 화면(/wrong-answers/practice)을 그대로 쓴다.
 */
import { useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, ArrowRight, BookOpen, CalendarCheck, Loader2, Sparkles } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_STAGE, STAGE_INTERVAL_DAYS } from "@/lib/korean/reviewSchedule";

/** 하루에 내보내는 최대 개수. 밀려도 이만큼씩만 나눠서 처리하게 한다. */
const DAILY_LIMIT = 20;

/** 이 정도 밀리면 "밀린 복습" 안내를 띄운다. */
const BACKLOG_WARN = DAILY_LIMIT;

interface DueItem {
  word: string;
  stage: number;
  due_at: string;
  overdue_days: number;
  level: string | null;
  slot: number;
  sentence: string | null;
  answer: string | null;
  hint: string | null;
  translation: string | null;
  meaning: string | null;
  sentence_from: string | null;
}

export default function ReviewToday() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["due-review-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_due_review_items", { _limit: DAILY_LIMIT });
      if (error) throw error;
      return (data ?? []) as DueItem[];
    },
  });

  // 상한을 넘겨 오늘 못 받은 게 얼마나 되는지. 상한이 꽉 찼을 때만 따로 센다.
  const { data: totalDue = 0 } = useQuery({
    queryKey: ["due-review-total", user?.id],
    enabled: !!user && items.length >= DAILY_LIMIT,
    queryFn: async () => {
      const { count } = await supabase
        .from("wrong_answer_progress")
        .select("word", { count: "exact", head: true })
        .eq("student_id", user!.id)
        .is("mastered_at", null)
        .lte("due_at", new Date().toISOString());
      return count ?? 0;
    },
  });

  // 문장이 없는 단어는 풀 수가 없다. 은행에도 없고 푼 퀴즈에도 없는 경우다.
  const playable = useMemo(
    () => items.filter((i) => i.sentence && i.answer),
    [items]
  );

  const overdueCount = useMemo(
    () => items.filter((i) => i.overdue_days > 0).length,
    [items]
  );

  const backlog = Math.max(0, totalDue - items.length);

  const startPractice = () => {
    if (playable.length === 0) {
      toast.info("지금 풀 수 있는 문항이 없어요");
      return;
    }

    // 연습 화면이 기대하는 형태로 맞춘다(오답노트에서 넘길 때와 같은 모양).
    const problems = playable.map((i) => ({
      id: `review-${i.word}`,
      word: i.word,
      correct_answer: i.answer!,
      sentence: i.sentence!,
      translation: i.translation,
      // 은행 문장은 이 퀴즈에서 만든 게 아니라 음성이 없다.
      audio_url: null,
      source: "review",
    }));

    localStorage.setItem("practice_problems", JSON.stringify(problems));
    navigate("/wrong-answers/practice");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-primary" />
            오늘의 복습
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {STAGE_INTERVAL_DAYS.join("일 · ")}일 간격으로 다시 물어봐요. {MASTER_STAGE}번 맞히면 마스터예요.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-10 text-center">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="font-semibold text-foreground">오늘 복습할 단어가 없어요</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              퀴즈를 풀면 그 단어들이 복습 일정에 올라가요.
            </p>
            <Button asChild variant="outline" className="mt-5 gap-1.5">
              <Link to="/wrong-answers">
                <BookOpen className="w-4 h-4" />
                오답노트 보기
              </Link>
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 md:p-8">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-primary tabular-nums">{items.length}</span>
              <span className="text-foreground font-medium">개 준비됐어요</span>
            </div>
            {overdueCount > 0 && (
              <p className="text-sm text-muted-foreground">
                이 중 <span className="font-semibold text-foreground">{overdueCount}개</span>는 예정일이 지났어요.
              </p>
            )}

            {backlog > 0 && (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 flex gap-2">
                <AlarmClock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  밀린 복습이 <span className="font-semibold text-foreground">{backlog}개</span> 더 있어요.
                  한 번에 다 하면 힘드니까 하루 {DAILY_LIMIT}개씩 나눠서 보여드려요.
                  오늘 것을 끝내면 내일 이어서 할 수 있어요.
                </div>
              </div>
            )}

            <div className="mt-5 space-y-1.5 max-h-72 overflow-y-auto">
              {items.map((i) => (
                <div
                  key={i.word}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40"
                >
                  <span className="font-medium text-foreground">{i.word}</span>
                  {i.meaning && (
                    <span className="text-xs text-muted-foreground truncate">{i.meaning}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    {!i.sentence && (
                      <span className="text-[11px] text-muted-foreground">문장 없음</span>
                    )}
                    {i.overdue_days > 0 && (
                      <span className="text-[11px] text-warning font-medium tabular-nums">
                        {i.overdue_days}일 지남
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {i.stage}/{MASTER_STAGE}단계
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {playable.length < items.length && (
              <p className="text-xs text-muted-foreground mt-3">
                {items.length - playable.length}개는 쓸 문장이 없어 이번엔 빠져요.
              </p>
            )}

            <Button size="lg" className="w-full gap-2 mt-6" onClick={startPractice} disabled={playable.length === 0}>
              복습 시작하기 ({playable.length}개)
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
