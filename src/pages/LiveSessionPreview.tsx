import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Volume2, Lightbulb, Users, Radio, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 라이브 세션 목업 (UI 검토용, 백엔드 연결 없음)
 *
 * 레이아웃: 왼쪽 메인 + 오른쪽 학생 목록 (고정)
 *   - 오른쪽 카드를 누르면 그 학생이 메인에 크게 뜬다
 *   - "전체 보기"를 누르면 메인이 격자로 돌아온다
 *   - 모바일에서는 학생 목록이 상단 가로 스크롤 띠가 된다
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
const scoreOf = (p: Progress) => p.committed.filter((a, i) => isCorrect(i, a)).length;

// ─── 진행 점 ────────────────────────────────────────────────────────────────
function Dots({ p, size = "md" }: { p: Progress; size?: "sm" | "md" }) {
  return (
    <div className={cn("flex", size === "sm" ? "gap-[3px]" : "gap-1")}>
      {PROBLEMS.map((_, i) => {
        const given = p.committed[i];
        const active = i === p.index;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full transition-colors duration-150",
              size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5",
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

function StatusText({ p }: { p: Progress }) {
  const done = p.index >= PROBLEMS.length;
  return (
    <span
      className={cn(
        "text-[11px] font-medium",
        done ? "text-success" : p.typing ? "text-primary" : "text-muted-foreground"
      )}
    >
      {done ? `제출 완료 · ${scoreOf(p)}/${PROBLEMS.length}` : p.typing ? "입력 중…" : "생각 중"}
    </span>
  );
}

// ─── 오른쪽 학생 카드 ───────────────────────────────────────────────────────
function StudentCard({
  student,
  p,
  selected,
  onClick,
}: {
  student: Student;
  p: Progress;
  selected: boolean;
  onClick: () => void;
}) {
  const done = p.index >= PROBLEMS.length;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all duration-150 shrink-0",
        "min-w-[172px] lg:min-w-0",
        selected
          ? "border-primary bg-accent ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-sm text-foreground truncate">{student.name}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {Math.min(p.index, PROBLEMS.length)}/{PROBLEMS.length}
        </span>
      </div>

      <Dots p={p} size="sm" />

      {/* 지금 치고 있는 내용 미리보기 */}
      <div className="mt-2 h-6 flex items-center">
        {done ? (
          <StatusText p={p} />
        ) : p.typing ? (
          <span className="text-xs font-semibold text-foreground truncate">
            {p.typing}
            <span className="inline-block w-[1.5px] h-3 bg-primary align-middle ml-0.5 animate-pulse" />
          </span>
        ) : (
          <StatusText p={p} />
        )}
      </div>
    </button>
  );
}

// ─── 메인: 한 학생 미러 ─────────────────────────────────────────────────────
function MirrorPanel({ student, p }: { student: Student; p: Progress }) {
  const done = p.index >= PROBLEMS.length;
  const usedWords = new Set(
    PROBLEMS.map((prob, i) => (p.committed[i] !== undefined ? prob.word : null)).filter(Boolean) as string[]
  );

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* 누구 화면인지 */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
              {student.name[0]}
            </span>
            <span className="font-bold text-foreground truncate">{student.name}의 화면</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {Math.min(p.index + (done ? 0 : 1), PROBLEMS.length)} / {PROBLEMS.length}
          </span>
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
                      {prob.before} <span className="text-muted-foreground">( _____ )</span>
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

// ─── 메인: 전체 격자 ────────────────────────────────────────────────────────
function GridPanel({
  students,
  state,
  onPick,
}: {
  students: Student[];
  state: Record<string, Progress>;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        학생 카드를 누르면 그 학생 화면을 크게 볼 수 있어요.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {students.map((s) => {
          const p = state[s.id];
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-150"
            >
              <div className="flex items-center justify-between mb-2.5 gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{s.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {Math.min(p.index, PROBLEMS.length)}/{PROBLEMS.length}
                </span>
              </div>
              <Dots p={p} />
              <div className="mt-2.5">
                <StatusText p={p} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────────────────────────
export default function LiveSessionPreview() {
  const [count, setCount] = useState(8);
  const [selected, setSelected] = useState<string | null>("s1");
  const state = useSimulation(count);

  const visible = STUDENTS.slice(0, count);
  const selectedStudent = selected ? visible.find((s) => s.id === selected) ?? null : null;

  // 인원이 바뀌면 1명일 때는 자동 선택, 여러 명이면 첫 학생
  useEffect(() => {
    setSelected(STUDENTS[0].id);
  }, [count]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border h-16 shrink-0">
        <div className="h-full px-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">라이브 세션</h1>
            <p className="text-xs text-muted-foreground truncate">일상 어휘 · 빈칸 채우기</p>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* 목업용 인원 전환 */}
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {[1, 3, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    "px-2.5 py-1 rounded-[8px] text-xs font-semibold border transition-colors duration-100",
                    count === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  )}
                >
                  {n}명
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
              <Radio className="w-3.5 h-3.5" />
              LIVE
            </span>
          </div>
        </div>
      </header>

      {/* 본문: 모바일은 학생 띠가 위로, 데스크톱은 오른쪽 사이드바 */}
      <div className="flex-1 flex flex-col-reverse lg:flex-row min-h-0">
        {/* 메인 */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
          {selectedStudent ? (
            <MirrorPanel student={selectedStudent} p={state[selectedStudent.id]} />
          ) : (
            <GridPanel students={visible} state={state} onPick={setSelected} />
          )}
        </main>

        {/* 학생 목록 */}
        <aside
          className={cn(
            "shrink-0 bg-card/40 border-border",
            "border-b lg:border-b-0 lg:border-l",
            "lg:w-[280px] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto"
          )}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-2 lg:border-b lg:border-border">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Users className="w-4 h-4 text-muted-foreground" />
              학생 {visible.length}명
            </span>
            <Button
              variant={selectedStudent ? "outline" : "secondary"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setSelected(null)}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              전체 보기
            </Button>
          </div>

          <div className="px-4 pb-4 lg:pt-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
            {visible.map((s) => (
              <StudentCard
                key={s.id}
                student={s}
                p={state[s.id]}
                selected={selected === s.id}
                onClick={() => setSelected(s.id)}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
