import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, LayoutGrid, Loader2, MonitorPlay, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLiveSession } from "@/hooks/useLiveSession";
import { useLiveProgress } from "@/hooks/useLiveProgress";
import { STAGE_LABELS } from "@/types/quiz";
import type { LiveProgress } from "@/types/liveSession";
import { QrBlock } from "@/components/live/QrBlock";

/**
 * 선생님 라이브 세션 화면.
 *
 * 대기실(waiting) → 진행(active) 두 상태를 한 페이지에서 다룬다.
 * 진행 중에는 왼쪽 메인 + 오른쪽 학생 목록으로, 학생을 고르면 그 학생 풀이가
 * 메인에 뜬다. 진행 상황은 DB가 아니라 Realtime broadcast로 들어온다.
 */
export default function LiveSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const { session, participants, isLoading, error, startSession, endSession } = useLiveSession(id);
  const { progress, sendControl, sendCast, casting } = useLiveProgress(id, "teacher");

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const joinUrl = `${window.location.origin}/join`;

  // 세션이 끝나면 목록으로 돌려보낸다.
  useEffect(() => {
    if (session?.status === "ended") {
      toast.success("세션을 종료했습니다.");
      navigate("/quizzes");
    }
  }, [session?.status, navigate]);

  const selectedParticipant = useMemo(
    () => participants.find((p) => p.id === selected) ?? null,
    [participants, selected]
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Link to="/auth" replace />;

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="text-sm text-muted-foreground text-center break-keep">
          {error ?? "세션을 찾을 수 없어요. 이미 끝났을 수 있습니다."}
        </p>
        <Button variant="outline" onClick={() => navigate("/quizzes")}>
          퀴즈 목록으로
        </Button>
      </div>
    );
  }

  const isWaiting = session.status === "waiting";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border h-16 shrink-0">
        <div className="h-full px-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">라이브 세션</h1>
            <p className="text-xs text-muted-foreground truncate">
              {session.stages.map((s) => STAGE_LABELS[s]).join(" · ")}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold tabular-nums">
              코드 {session.join_code}
            </span>
            {!isWaiting && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                <Radio className="w-3.5 h-3.5" />
                LIVE
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setConfirmEnd(true)}
            >
              세션 종료
            </Button>
          </div>
        </div>
      </header>

      {/* 대기실 */}
      {isWaiting && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[880px] mx-auto py-2 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">아래 주소로 접속해서</p>
              <p className="text-xl font-bold text-foreground mb-5 break-all">
                {joinUrl.replace(/^https?:\/\//, "")}
              </p>

              <p className="text-sm text-muted-foreground mb-2">참여 코드를 입력하세요</p>
              <div className="flex gap-1.5 mb-6">
                {session.join_code.split("").map((d, i) => (
                  <span
                    key={i}
                    className="w-11 h-14 rounded-[10px] bg-accent border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary tabular-nums"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <QrBlock value={`${joinUrl}?code=${session.join_code}`} />
              <p className="text-[11px] text-muted-foreground mt-2">
                QR을 스캔해도 바로 들어올 수 있어요
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-sm text-foreground">
                  참가자 {participants.length}
                </span>
              </div>
              <div className="p-3 flex-1 min-h-[220px]">
                {participants.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 py-8">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs text-muted-foreground">학생을 기다리는 중…</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {participants.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                          p.is_guest
                            ? "bg-muted text-muted-foreground border border-dashed border-border"
                            : "bg-accent text-accent-foreground"
                        )}
                        title={p.is_guest ? "비회원 — 결과가 저장되지 않아요" : "클래스 학생"}
                      >
                        {p.display_name}
                        {p.is_guest && (
                          <span className="text-[10px] font-bold opacity-70">게스트</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-border">
                <Button
                  className="w-full h-11 font-bold"
                  disabled={participants.length === 0}
                  onClick={async () => {
                    await startSession();
                    sendControl({ type: "start" });
                  }}
                >
                  지금 시작 ({participants.length}명)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 진행 중 */}
      {!isWaiting && (
        <div className="flex-1 flex flex-col-reverse lg:flex-row min-h-0">
          <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
            {selectedParticipant ? (
              <StudentPanel
                name={selectedParticipant.display_name}
                p={progress[selectedParticipant.id]}
                watchScreens={session.settings.watchScreens}
              />
            ) : (
              <OverviewPanel
                participants={participants}
                progress={progress}
                onPick={setSelected}
              />
            )}
          </main>

          <aside className="shrink-0 bg-card/40 border-border border-b lg:border-b-0 lg:border-l lg:w-[280px] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <div className="px-4 py-3 flex items-center justify-between gap-2 lg:border-b lg:border-border">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Users className="w-4 h-4 text-muted-foreground" />
                학생 {participants.length}명
              </span>
              <Button
                variant={selected ? "outline" : "secondary"}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setSelected(null)}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                전체 보기
              </Button>
            </div>

            <div className="px-4 pb-3 lg:pt-3">
              <label className="flex items-center justify-between gap-2 cursor-pointer bg-card border border-border rounded-xl p-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MonitorPlay className="w-3.5 h-3.5 text-muted-foreground" />
                  학생에게 내 화면 보여주기
                </span>
                <Switch checked={casting} onCheckedChange={sendCast} />
              </label>
            </div>

            <div className="px-4 pb-4 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
              {participants.map((p) => (
                <ParticipantCard
                  key={p.id}
                  name={p.display_name}
                  isGuest={p.is_guest}
                  p={progress[p.id]}
                  selected={selected === p.id}
                  watchScreens={session.settings.watchScreens}
                  onClick={() => setSelected(p.id)}
                />
              ))}
            </div>
          </aside>
        </div>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>세션을 종료할까요?</AlertDialogTitle>
            <AlertDialogDescription className="break-keep">
              학생들의 풀이가 즉시 제출되고 세션이 닫힙니다. 참여 코드도 더 이상 쓸 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                sendControl({ type: "end" });
                await endSession();
              }}
            >
              종료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 지금 만지고 있는 문항의 입력값. 없으면 빈 문자열. */
function activeText(p?: LiveProgress) {
  if (!p || p.activeIndex < 0) return "";
  return p.answers[p.activeIndex] ?? "";
}

// ─── 진행 점 ────────────────────────────────────────────────────────────────
function Dots({ p }: { p?: LiveProgress }) {
  // 점 개수는 학생이 알려준 그 단계의 문제 수를 따른다. 아직 아무것도 안 왔으면
  // 자리만 잡아둔다. 정오답은 채점 후에만 오므로 그전엔 "지나감/현재/아직"만 표시.
  const total = Math.min(Math.max(p?.total ?? 5, 1), 12);
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: total }).map((_, i) => {
        const c = p?.correct[i];
        const passed = p ? i < p.index : false;
        const active = p ? i === p.index && !p.done : false;
        return (
          <span
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors duration-150",
              c === true
                ? "bg-success"
                : c === false
                ? "bg-destructive"
                : active
                ? "bg-primary/40 ring-2 ring-primary/25"
                : passed
                ? "bg-primary"
                : "bg-border"
            )}
          />
        );
      })}
    </div>
  );
}

function ParticipantCard({
  name,
  isGuest,
  p,
  selected,
  watchScreens,
  onClick,
}: {
  name: string;
  isGuest: boolean;
  p?: LiveProgress;
  selected: boolean;
  watchScreens: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all duration-150 shrink-0 min-w-[172px] lg:min-w-0",
        selected
          ? "border-primary bg-accent ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-sm text-foreground truncate">
          {name}
          {isGuest && <span className="ml-1 text-[10px] text-muted-foreground">게스트</span>}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {p ? `${p.index}/${p.total}` : "-"}
        </span>
      </div>
      <Dots p={p} />
      <div className="mt-2 h-6 flex items-center">
        {p?.done ? (
          <span className="text-[11px] font-medium text-success">제출 완료</span>
        ) : watchScreens && activeText(p) ? (
          <span className="text-xs font-semibold text-foreground truncate">
            {activeText(p)}
            <span className="inline-block w-[1.5px] h-3 bg-primary align-middle ml-0.5 animate-pulse" />
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {p ? "푸는 중" : "아직 시작 안 함"}
          </span>
        )}
      </div>
    </button>
  );
}

function StudentPanel({
  name,
  p,
  watchScreens,
}: {
  name: string;
  p?: LiveProgress;
  watchScreens: boolean;
}) {
  return (
    <div className="max-w-[640px] mx-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="font-bold text-foreground truncate">{name}의 화면</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {p ? `${p.index} / ${p.total}` : "대기 중"}
          </span>
        </div>

        <div className="p-5">
          {!p ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              아직 풀기 시작하지 않았어요.
            </p>
          ) : !watchScreens ? (
            <div className="text-center py-10 space-y-3">
              <Dots p={p} />
              <p className="text-sm text-muted-foreground break-keep">
                이 세션은 화면 보기가 꺼져 있어 진행률만 보여요.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {p.answers.map((ans, i) => {
                const active = i === p.activeIndex && !p.done;
                const filled = ans.trim().length > 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-[10px] border px-3 py-2 text-[15px] flex items-center gap-2 transition-all duration-150",
                      p.correct[i] === true
                        ? "bg-success/5 border-success/30 text-success font-semibold"
                        : p.correct[i] === false
                        ? "bg-destructive/5 border-destructive/30 text-destructive font-semibold"
                        : active
                        ? "bg-slate-50 border-border ring-2 ring-primary ring-offset-2 text-foreground font-medium"
                        : filled
                        ? "bg-slate-50 border-border text-foreground"
                        : "bg-slate-50 border-border text-muted-foreground"
                    )}
                  >
                    <span className="text-primary font-bold text-sm shrink-0">{i + 1}.</span>
                    <span className="truncate">
                      {ans || (active ? "" : "—")}
                      {active && (
                        <span className="inline-block w-[1.5px] h-[15px] bg-primary align-middle ml-0.5 animate-pulse" />
                      )}
                    </span>
                  </div>
                );
              })}
              {p.answers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 break-keep">
                  이 유형은 답을 글자로 보여줄 수 없어요. 위 진행 점으로 확인하세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({
  participants,
  progress,
  onPick,
}: {
  participants: { id: string; display_name: string }[];
  progress: Record<string, LiveProgress>;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        학생 카드를 누르면 그 학생 화면을 크게 볼 수 있어요.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {participants.map((s) => {
          const p = progress[s.id];
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-150"
            >
              <div className="flex items-center justify-between mb-2.5 gap-2">
                <span className="font-semibold text-sm text-foreground truncate">
                  {s.display_name}
                </span>
              </div>
              <Dots p={p} />
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                {p?.done ? "제출 완료" : p ? "푸는 중" : "대기 중"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
