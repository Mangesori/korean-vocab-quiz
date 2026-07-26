import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, Volume2, Lightbulb, Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 라이브 세션 목업 (UI 검토용, 백엔드 연결 없음)
 *
 * 선생님이 학생들의 풀이를 실시간으로 보는 화면.
 * 접속 인원에 따라 밀도가 3단계로 자동 전환된다.
 *   1명    → 미러 모드 (학생 화면 그대로)
 *   2~4명  → 카드 모드 (답 내용까지)
 *   5명 이상 → 격자 모드 (진행률·정오답만, 클릭하면 미러)
 */

const PROBLEMS = [
  { n: 1, before: "피곤할 때는 일찍", after: "", hint: "-아/어요", answer: "자요", word: "자다" },
  { n: 2, before: "집에서도 한국어를", after: "", hint: "-았/었어요", answer: "연습했어요", word: "연습하다" },
  { n: 3, before: "오늘은", after: "밥을 먹었어요", hint: "", answer: "혼자", word: "혼자" },
  { n: 4, before: "여기서 역까지", after: "", hint: "-아/어요", answer: "가까워요", word: "가깝다" },
  { n: 5, before: "집에서 학교까지 10분이", after: "", hint: "-아/어요", answer: "걸려요", word: "걸리다" },
];

const WORD_BANK = ["걸리다", "자다", "가깝다", "혼자", "연습하다"];

type Student = {
  id: string;
  name: string;
  /** 문제별로 학생이 실제로 칠 내용. 정답과 다르면 오답 처리된다. */
  script: string[];
  speed: number;
  offset: number;
};

const STUDENTS: Student[] = [
  { id: "s1", name: "김민수", script: ["자요", "연습했어요", "혼자", "가까와요", "걸려요"], speed: 4, offset: 0 },
  { id: "s2", name: "이지은", script: ["자요", "연습했어요", "혼자", "가까워요", "걸려요"], speed: 3, offset: 2 },
  { id: "s3", name: "박서준", script: ["자요", "연습해요", "혼자서", "가까워요", "걸려요"], speed: 6, offset: 1 },
  { id: "s4", name: "최유진", script: ["자요", "연습했어요", "혼자", "가까워요", "걸려요"], speed: 5, offset: 3 },
  { id: "s5", name: "정하늘", script: ["잤어요", "연습했어요", "혼자", "가까워요", "걸렸어요"], speed: 4, offset: 5 },
  { id: "s6", name: "강태윤", script: ["자요", "연습했어요", "혼자", "가까워요", "걸려요"], speed: 7, offset: 2 },
  { id: "s7", name: "윤서아", script: ["자요", "연습했어요", "혼자", "가까워요", "걸려요"], speed: 3, offset: 6 },
  { id: "s8", name: "임도현", script: ["자요", "연습핬어요", "혼자", "가까워요", "걸려요"], speed: 8, offset: 4 },
];

/** 시뮬레이션 상태 — 실제 구현에서는 Realtime 채널로 들어올 데이터 */
type Progress = {
  index: number;
  typing: string;
  committed: string[];
  hold: number;
};

const initProgress = (): Progress => ({ index: 0, typing: "", committed: [], hold: 0 });

function useSimulation(count: number) {
  const [state, setState] = useState<Record<string, Progress>>(() =>
    Object.fromEntries(STUDENTS.map((s) => [s.id, initProgress()]))
  );
  const tick = useRef(0);

  useEffect(() => {
    setState(Object.fromEntries(STUDENTS.map((s) => [s.id, initProgress()])));
    tick.current = 0;
  }, [count]);

  useEffect(() => {
    const id = setInterval(() => {
      tick.current += 1;
      const t = tick.current;
      setState((prev) => {
        const next = { ...prev };
        for (const s of STUDENTS.slice(0, count)) {
          const p = next[s.id];
          if (p.index >= PROBLEMS.length) continue;
          if ((t + s.offset) % s.speed !== 0) continue;

          const target = s.script[p.index];
          if (p.typing.length < target.length) {
            next[s.id] = { ...p, typing: target.slice(0, p.typing.length + 1) };
          } else if (p.hold < 2) {
            next[s.id] = { ...p, hold: p.hold + 1 };
          } else {
            next[s.id] = {
              index: p.index + 1,
              typing: "",
              committed: [...p.committed, target],
              hold: 0,
            };
          }
        }
        return next;
      });
    }, 140);
    return () => clearInterval(id);
  }, [count]);

  return state;
}

const isCorrect = (i: number, given: string) => given === PROBLEMS[i].answer;

// ─── 진행 점 ────────────────────────────────────────────────────────────────
function Dots({ p }: { p: Progress }) {
  return (
    <div className="flex gap-1">
      {PROBLEMS.map((_, i) => {
        const given = p.committed[i];
        const active = i === p.index;
        return (
          <span
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors duration-150",
              given === undefined
                ? active
                  ? "bg-primary/40 ring-2 ring-primary/25"
                  : "bg-border"
                : isCorrect(i, given)
                ? "bg-success"
                : "bg-destructive"
            )}
          />
        );
      })}
    </div>
  );
}

function StatusPill({ p }: { p: Progress }) {
  const done = p.index >= PROBLEMS.length;
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0",
        done ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
      )}
    >
      {done ? "제출 완료" : `${p.index + 1}번 푸는 중`}
    </span>
  );
}

// ─── 미러 모드 ──────────────────────────────────────────────────────────────
function MirrorView({
  student,
  p,
  onBack,
}: {
  student: Student;
  p: Progress;
  onBack?: () => void;
}) {
  const done = p.index >= PROBLEMS.length;
  const usedWords = new Set(
    p.committed.map((_, i) => PROBLEMS[i].word).filter((_, i) => p.committed[i] !== undefined)
  );

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
            <ChevronLeft className="w-4 h-4" />
            전체 보기
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <StatusPill p={p} />
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.min(p.index + (done ? 0 : 1), PROBLEMS.length)} / {PROBLEMS.length}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="font-bold text-foreground">{student.name}</span>
          <span className="text-xs text-muted-foreground">학생 화면 · 빈칸 채우기</span>
        </div>

        <div className="p-5">
          {/* 보기 */}
          <div
            className="rounded-xl px-4 py-3 mb-5 border"
            style={{ background: "#F1ECE4", borderColor: "#D3CCC4" }}
          >
            <p className="text-[11px] font-bold text-muted-foreground text-center mb-2 tracking-wide">
              보기
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {WORD_BANK.map((w) => {
                const struck = usedWords.has(w);
                return (
                  <span
                    key={w}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium bg-card border border-border transition-all duration-200",
                      struck && "line-through text-muted-foreground opacity-60"
                    )}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 문제들 */}
          <div className="divide-y divide-border">
            {PROBLEMS.map((prob, i) => {
              const given = p.committed[i];
              const answered = given !== undefined;
              const active = i === p.index && !done;
              const ok = answered && isCorrect(i, given);

              return (
                <div key={prob.n} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-primary font-bold text-sm shrink-0">{prob.n}.</span>
                    <p className="text-[15px] leading-relaxed text-foreground">
                      {prob.before}{" "}
                      <span className="text-muted-foreground">( _____ )</span>
                      {prob.hint && (
                        <span className="text-primary text-sm font-medium ml-1">{prob.hint}</span>
                      )}
                      {prob.after && <span> {prob.after}</span>}
                    </p>
                  </div>

                  <div className="pl-6 space-y-2">
                    <div
                      className={cn(
                        "h-10 rounded-[10px] border flex items-center justify-center px-3 text-[15px] transition-all duration-200",
                        active
                          ? "bg-slate-50 border-border ring-2 ring-primary ring-offset-2"
                          : answered
                          ? ok
                            ? "bg-success/5 border-success/30 font-semibold text-success"
                            : "bg-destructive/5 border-destructive/30 font-semibold text-destructive"
                          : "bg-slate-50 border-border text-muted-foreground"
                      )}
                    >
                      {answered ? (
                        given
                      ) : active ? (
                        <span className="text-foreground font-medium">
                          {p.typing}
                          <span className="inline-block w-[1.5px] h-[15px] bg-primary align-middle ml-0.5 animate-pulse" />
                        </span>
                      ) : (
                        "정답을 입력하세요"
                      )}
                    </div>

                    {answered && !ok && (
                      <p className="text-xs text-muted-foreground">
                        정답: <span className="text-success font-semibold">{prob.answer}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" disabled>
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                        듣기
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" disabled>
                        <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                        힌트
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 카드 모드 (2~4명) ──────────────────────────────────────────────────────
function CardView({
  students,
  state,
  onPick,
}: {
  students: Student[];
  state: Record<string, Progress>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {students.map((s) => {
        const p = state[s.id];
        const done = p.index >= PROBLEMS.length;
        const prob = done ? null : PROBLEMS[p.index];

        return (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-foreground">{s.name}</span>
              <StatusPill p={p} />
            </div>

            <Dots p={p} />

            <div className="mt-3 pt-3 border-t border-border min-h-[72px]">
              {prob ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
                    {prob.before} ( ___ ) {prob.hint}
                  </p>
                  <div className="h-9 rounded-[10px] bg-slate-50 border border-border flex items-center px-3 text-sm">
                    {p.typing ? (
                      <span className="font-semibold text-foreground">
                        {p.typing}
                        <span className="inline-block w-[1.5px] h-[13px] bg-primary align-middle ml-0.5 animate-pulse" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">입력 대기 중…</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-sm text-success font-semibold">
                    {p.committed.filter((a, i) => isCorrect(i, a)).length} / {PROBLEMS.length} 정답
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── 격자 모드 (5명 이상) ───────────────────────────────────────────────────
function GridView({
  students,
  state,
  onPick,
}: {
  students: Student[];
  state: Record<string, Progress>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {students.map((s) => {
        const p = state[s.id];
        const done = p.index >= PROBLEMS.length;
        return (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="bg-card border border-border rounded-xl p-3.5 text-left hover:border-primary/40 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <span className="font-semibold text-sm text-foreground truncate">{s.name}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {Math.min(p.index, PROBLEMS.length)}/{PROBLEMS.length}
              </span>
            </div>
            <Dots p={p} />
            <p
              className={cn(
                "mt-2.5 text-[11px] font-medium",
                done ? "text-success" : p.typing ? "text-primary" : "text-muted-foreground"
              )}
            >
              {done ? "제출 완료" : p.typing ? "입력 중…" : "생각 중"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────────────────────────
export default function LiveSessionPreview() {
  const [count, setCount] = useState(1);
  const [focused, setFocused] = useState<string | null>(null);
  const state = useSimulation(count);

  const visible = STUDENTS.slice(0, count);
  const focusedStudent = focused ? STUDENTS.find((s) => s.id === focused) : null;

  // 인원이 바뀌면 포커스 해제
  useEffect(() => setFocused(null), [count]);

  const mode = focusedStudent || count === 1 ? "mirror" : count <= 4 ? "card" : "grid";
  const mirrorTarget = focusedStudent ?? visible[0];

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-[1120px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">라이브 세션</h1>
            <p className="text-xs text-muted-foreground truncate">일상 어휘 · 빈칸 채우기</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold shrink-0">
            <Radio className="w-3.5 h-3.5" />
            LIVE
          </span>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-4 py-6">
        {/* 목업 안내 + 인원 전환 */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-3 break-keep">
            <strong className="text-foreground">목업입니다.</strong> 접속 인원에 따라 화면 밀도가
            자동으로 바뀝니다. 아래에서 인원을 바꿔가며 확인해보세요. 카드를 누르면 그 학생만
            자세히 볼 수 있습니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
              <Users className="w-3.5 h-3.5" />
              접속 인원
            </span>
            {[
              { n: 1, label: "1명 · 미러" },
              { n: 3, label: "3명 · 카드" },
              { n: 8, label: "8명 · 격자" },
            ].map((o) => (
              <button
                key={o.n}
                onClick={() => setCount(o.n)}
                className={cn(
                  "px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-colors duration-100",
                  count === o.n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "mirror" && mirrorTarget && (
          <MirrorView
            student={mirrorTarget}
            p={state[mirrorTarget.id]}
            onBack={focused ? () => setFocused(null) : undefined}
          />
        )}
        {mode === "card" && (
          <CardView students={visible} state={state} onPick={setFocused} />
        )}
        {mode === "grid" && (
          <GridView students={visible} state={state} onPick={setFocused} />
        )}
      </main>
    </div>
  );
}
