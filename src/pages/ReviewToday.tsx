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
 *
 * 2026-09 개편(handoff-landing-srs/05_student_srs.md, 5a):
 *   시작 버튼을 스크롤 목록보다 먼저 보이게 하고, 목록은 접어서 한 줄로 줄였다.
 *   "어제 실적 · 연속 일수"와 주간 막대는 문서에서 요청했지만, wrong_answer_progress에는
 *   단어별 stage/due_at/last_practiced_at만 있고 날짜별 완료 이력(로그)이 없어
 *   계산할 수 없다 — last_practiced_at은 단어마다 최신 시각 하나만 덮어쓰는 값이라
 *   "그날 실제로 몇 개를 끝냈는지"·"며칠 연속 했는지"를 복원할 수 없다.
 *   그래서 문서가 명시한 축소안대로 부제를 정적 문구로 대체하고 주간 막대는 생략했다.
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, ArrowRight, BookOpen, ChevronDown, Loader2, Sparkles } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SRS_STAGE_LABELS } from "@/lib/korean/srsStageLabels";

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
  const [listOpen, setListOpen] = useState(false);

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
  const noSentenceCount = items.length - playable.length;

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
    // 연습 화면이 뒤로가기 라벨/링크를 "오늘의 복습"으로 맞출 수 있도록 진입점을 남긴다.
    localStorage.setItem("practice_return_to", "review");
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
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight pl-2">
            오늘의 복습
          </h1>
          {items.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2 pl-2">
              {items.length}개 준비됐어요 · {playable.length}개를 풀 수 있어요
            </p>
          )}
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

            {/* 스크롤 목록보다 시작 버튼을 먼저 — 매일 오는 화면에서 목록을 지나칠 필요가 없게 */}
            <Button size="lg" className="w-full gap-2 mt-5" onClick={startPractice} disabled={playable.length === 0}>
              복습 시작하기 ({playable.length}개)
              <ArrowRight className="w-4 h-4" />
            </Button>

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

            <Collapsible open={listOpen} onOpenChange={setListOpen} className="mt-5 pt-5 border-t border-border/60">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-sm text-left group">
                <span className="font-medium text-foreground">오늘 나올 단어 보기</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {items.length}개
                  {noSentenceCount > 0 && ` · ${noSentenceCount}개는 문장이 없어 빠져요`}
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${listOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
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
                        {SRS_STAGE_LABELS[i.stage] ?? `${i.stage}단계`}
                      </span>
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <div className="mt-5 text-center">
          <Link
            to="/vocabulary"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            나만의 단어장에서 전체 단어 보기
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
