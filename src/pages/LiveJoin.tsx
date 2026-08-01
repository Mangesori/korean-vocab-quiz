import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useJoinLiveSession, type FoundSession } from "@/hooks/useJoinLiveSession";
import { useLiveProgress } from "@/hooks/useLiveProgress";
import { supabase } from "@/integrations/supabase/client";
import type { LiveParticipant } from "@/types/liveSession";

/**
 * 학생 참여 화면. 코드 → 이름 → 대기 → (선생님이 시작하면) 퀴즈로 이동.
 *
 * 대기 중에는 선생님의 start 신호를 broadcast로 기다린다. 신호가 오면
 * 기존 퀴즈 화면(/quiz/:id/take)에 ?live= 파라미터를 붙여 넘긴다.
 */
export default function LiveJoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { found, participant, isBusy, error, lookup, join } = useJoinLiveSession();

  const [step, setStep] = useState<"code" | "name" | "waiting">("code");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [name, setName] = useState("");

  // QR로 들어오면 ?code=157685 가 붙어 있다 — 자동으로 채워준다.
  useEffect(() => {
    const c = params.get("code");
    if (c && /^\d{6}$/.test(c)) setDigits(c.split(""));
  }, [params]);

  // 로그인한 학생은 프로필 이름을 기본값으로.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data?.name && setName(data.name));
  }, [user]);

  const code = digits.join("");

  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) document.getElementById(`live-d${i + 1}`)?.focus();
  };

  const submitCode = async () => {
    const s = await lookup(code);
    if (s) setStep("name");
  };

  const submitName = async () => {
    if (!found) return;
    const p = await join(found, name.trim());
    if (p) setStep("waiting");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border h-16 shrink-0">
        <div className="h-full px-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg leading-tight truncate">수업 참여</h1>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 py-10 overflow-y-auto">
        {step === "code" && (
          <div className="w-full max-w-[380px]">
            <h2 className="text-2xl font-bold text-foreground text-center mb-2">수업 참여하기</h2>
            <p className="text-sm text-muted-foreground text-center mb-8">
              선생님이 알려준 6자리 코드를 입력하세요
            </p>

            <div className="flex justify-center gap-1.5 mb-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  id={`live-d${i}`}
                  value={d}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0)
                      document.getElementById(`live-d${i - 1}`)?.focus();
                    if (e.key === "Enter" && code.length === 6) submitCode();
                  }}
                  className={cn(
                    "w-12 h-14 rounded-[10px] border text-center text-2xl font-bold tabular-nums",
                    "bg-slate-50 text-foreground outline-none transition-all duration-150",
                    "focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    error ? "border-destructive" : "border-border"
                  )}
                />
              ))}
            </div>

            <p
              className={cn(
                "text-xs text-center mb-6 transition-opacity duration-150 text-destructive",
                error ? "opacity-100" : "opacity-0"
              )}
            >
              {error || " "}
            </p>

            <Button
              size="lg"
              className="w-full h-12 font-bold"
              disabled={code.length < 6 || isBusy}
              onClick={submitCode}
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "참여하기"}
            </Button>
          </div>
        )}

        {step === "name" && found && (
          <div className="w-full max-w-[380px]">
            <h2 className="text-2xl font-bold text-foreground text-center mb-2">
              {found.quiz_title}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-8">
              선생님 화면에 표시될 이름이에요
            </p>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && submitName()}
              placeholder="이름"
              className="h-12 text-center text-lg bg-slate-50 mb-3"
              autoFocus
            />

            {error && <p className="text-xs text-destructive text-center mb-3">{error}</p>}

            <Button
              size="lg"
              className="w-full h-12 font-bold"
              disabled={!name.trim() || isBusy}
              onClick={submitName}
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "입장하기"}
            </Button>

            {!user && (
              <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-xs text-muted-foreground mb-2">계정이 있나요?</p>
                <Link
                  to={`/auth?redirect=${encodeURIComponent(`/join?code=${code}`)}`}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  로그인하고 참여하기
                </Link>
                <p className="text-[11px] text-muted-foreground mt-2 break-keep">
                  로그인하면 결과가 저장되고 오답노트에 쌓여요
                </p>
              </div>
            )}
          </div>
        )}

        {step === "waiting" && found && participant && (
          <WaitingRoom
            session={found}
            participant={participant}
            onStart={() =>
              navigate(
                `/quiz/${found.quiz_id}/take?live=${found.id}&participant=${participant.id}`
              )
            }
          />
        )}
      </main>
    </div>
  );
}

// ─── 대기실 ─────────────────────────────────────────────────────────────────
function WaitingRoom({
  session,
  participant,
  onStart,
}: {
  session: FoundSession;
  participant: LiveParticipant;
  onStart: () => void;
}) {
  const { control } = useLiveProgress(session.id, "student");
  const [roster, setRoster] = useState<LiveParticipant[]>([]);
  const started = useRef(false);

  // 선생님의 시작 신호
  useEffect(() => {
    if (control?.type === "start" && !started.current) {
      started.current = true;
      onStart();
    }
  }, [control, onStart]);

  // 신호를 놓쳤을 때를 대비해 세션 상태도 같이 본다 (늦게 들어온 학생 등).
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("status")
        .eq("id", session.id)
        .maybeSingle();
      if (data?.status === "active" && !started.current) {
        started.current = true;
        onStart();
      }
    };
    check();
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [session.id, onStart]);

  // 같은 세션 참가자 명단
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("live_participants")
        .select("*")
        .eq("session_id", session.id)
        .is("left_at", null)
        .order("joined_at");
      setRoster((data ?? []) as unknown as LiveParticipant[]);
    };
    load();
    const ch = supabase
      .channel(`live_lobby:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_participants",
          filter: `session_id=eq.${session.id}`,
        },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session.id]);

  return (
    <div className="w-full max-w-[380px] text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        들어왔어요, {participant.display_name}님
      </h2>
      <p className="text-sm text-muted-foreground mb-8">선생님이 시작하면 문제가 나타납니다</p>

      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">
            함께 기다리는 중 {roster.length || 1}명
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {(roster.length ? roster : [participant]).map((p) => (
            <span
              key={p.id}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold",
                p.id === participant.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground"
              )}
            >
              {p.display_name}
            </span>
          ))}
        </div>
      </div>

      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        기다리는 중…
      </div>
    </div>
  );
}
