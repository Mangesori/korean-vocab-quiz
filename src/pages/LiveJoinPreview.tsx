import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Volume2, Lightbulb, Users, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 라이브 세션 — 학생 쪽 화면 목업 (UI 검토용, 백엔드 연결 없음)
 *
 * 코드 입력 → 이름 입력 → 대기 → 풀이 → 종료
 * 선생님 화면(/live/preview)과 짝을 이룬다.
 */

const PROBLEMS = [
  { n: 1, before: "피곤할 때는 일찍", after: "", hint: "-아/어요", answer: "자요", word: "자다" },
  { n: 2, before: "집에서도 한국어를", after: "", hint: "-았/었어요", answer: "연습했어요", word: "연습하다" },
  { n: 3, before: "오늘은", after: "밥을 먹었어요", hint: "", answer: "혼자", word: "혼자" },
  { n: 4, before: "여기서 역까지", after: "", hint: "-아/어요", answer: "가까워요", word: "가깝다" },
  { n: 5, before: "집에서 학교까지 10분이", after: "", hint: "-아/어요", answer: "걸려요", word: "걸리다" },
];

const WORD_BANK = ["걸리다", "자다", "가깝다", "혼자", "연습하다"];
const CORRECT_CODE = "157685";
const WAITING_NAMES = ["김민수", "이지은", "박서준", "최유진"];

type Step = "code" | "name" | "waiting" | "quiz" | "done";

// ─── 코드 입력 ──────────────────────────────────────────────────────────────
function CodeStep({ onNext }: { onNext: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState(false);

  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError(false);
    if (d && i < 5) document.getElementById(`d${i + 1}`)?.focus();
  };

  const code = digits.join("");

  const submit = () => {
    if (code === CORRECT_CODE) onNext();
    else setError(true);
  };

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-2xl font-bold text-foreground text-center mb-2">수업 참여하기</h1>
      <p className="text-sm text-muted-foreground text-center mb-8">
        선생님이 알려준 6자리 코드를 입력하세요
      </p>

      <div className="flex justify-center gap-1.5 mb-3">
        {digits.map((d, i) => (
          <input
            key={i}
            id={`d${i}`}
            value={d}
            inputMode="numeric"
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0)
                document.getElementById(`d${i - 1}`)?.focus();
              if (e.key === "Enter") submit();
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
          "text-xs text-center mb-6 transition-opacity duration-150",
          error ? "text-destructive opacity-100" : "opacity-0"
        )}
      >
        코드를 다시 확인해주세요
      </p>

      <Button
        size="lg"
        className="w-full h-12 font-bold"
        disabled={code.length < 6}
        onClick={submit}
      >
        참여하기
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-6">
        목업이라 <strong className="text-foreground tabular-nums">157685</strong>만 통과됩니다
      </p>
    </div>
  );
}

// ─── 이름 입력 ──────────────────────────────────────────────────────────────
function NameStep({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-2xl font-bold text-foreground text-center mb-2">이름을 알려주세요</h1>
      <p className="text-sm text-muted-foreground text-center mb-8">
        선생님 화면에 표시될 이름이에요
      </p>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onNext(name.trim())}
        placeholder="이름"
        className="h-12 text-center text-lg bg-slate-50 mb-4"
        autoFocus
      />

      <Button
        size="lg"
        className="w-full h-12 font-bold"
        disabled={!name.trim()}
        onClick={() => onNext(name.trim())}
      >
        입장하기
      </Button>

      <div className="mt-6 pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground mb-2">계정이 있나요?</p>
        <Link to="/auth" className="text-sm text-primary font-semibold hover:underline">
          로그인하고 참여하기
        </Link>
        <p className="text-[11px] text-muted-foreground mt-2 break-keep">
          로그인하면 결과가 저장되고 오답노트에 쌓여요
        </p>
      </div>
    </div>
  );
}

// ─── 대기 ───────────────────────────────────────────────────────────────────
function WaitingStep({ name }: { name: string }) {
  const [others, setOthers] = useState(1);

  useEffect(() => {
    const id = setInterval(
      () => setOthers((n) => (n >= WAITING_NAMES.length ? n : n + 1)),
      1400
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-[380px] text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">들어왔어요, {name}님</h1>
      <p className="text-sm text-muted-foreground mb-8">
        선생님이 시작하면 문제가 나타납니다
      </p>

      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">
            함께 기다리는 중 {others + 1}명
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {name}
          </span>
          {WAITING_NAMES.slice(0, others).map((n) => (
            <span
              key={n}
              className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold"
            >
              {n}
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

// ─── 풀이 ───────────────────────────────────────────────────────────────────
function QuizStep({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const filled = PROBLEMS.filter((_, i) => (answers[i] ?? "").trim()).length;
  const usedWords = new Set(
    PROBLEMS.map((p, i) => ((answers[i] ?? "").trim() ? p.word : null)).filter(Boolean) as string[]
  );

  return (
    <div className="w-full max-w-[560px]">
      {/* 진행 바 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-foreground">빈칸 채우기</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filled} / {PROBLEMS.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(filled / PROBLEMS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        {/* 보기 */}
        <div
          className="rounded-xl px-4 py-3 mb-5 border"
          style={{ background: "#F1ECE4", borderColor: "#D3CCC4" }}
        >
          <p className="text-[11px] font-bold text-muted-foreground text-center mb-2 tracking-wide">
            보기
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {WORD_BANK.map((w) => (
              <span
                key={w}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium bg-card border border-border transition-all duration-200",
                  usedWords.has(w) && "line-through text-muted-foreground opacity-60"
                )}
              >
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {PROBLEMS.map((prob, i) => (
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
                <Input
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  placeholder="정답을 입력하세요"
                  className="h-10 text-center text-[15px] bg-slate-50"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                    <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                    듣기
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                    <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                    힌트
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full h-12 font-bold mt-4"
        disabled={filled < PROBLEMS.length}
        onClick={onDone}
      >
        {filled < PROBLEMS.length ? `${PROBLEMS.length - filled}문제 남았어요` : "제출하기"}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-3 break-keep">
        선생님이 푸는 과정을 보고 있어요
      </p>
    </div>
  );
}

// ─── 종료 ───────────────────────────────────────────────────────────────────
function DoneStep() {
  return (
    <div className="w-full max-w-[380px] text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-success" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">제출했어요</h1>
      <p className="text-sm text-muted-foreground mb-8 break-keep">
        선생님이 다음 문제를 열어줄 때까지 기다려주세요
      </p>
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        기다리는 중…
      </div>
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────────────────────────
export default function LiveJoinPreview() {
  const [step, setStep] = useState<Step>("code");
  const [name, setName] = useState("");

  const STEPS: { id: Step; label: string }[] = [
    { id: "code", label: "코드" },
    { id: "name", label: "이름" },
    { id: "waiting", label: "대기" },
    { id: "quiz", label: "풀이" },
    { id: "done", label: "완료" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border h-16 shrink-0">
        <div className="h-full px-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">학생 참여 화면</h1>
            <p className="text-xs text-muted-foreground truncate">라이브 세션 목업</p>
          </div>

          {/* 목업용 단계 이동 */}
          <div className="ml-auto hidden sm:flex items-center gap-1 shrink-0">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "px-2.5 py-1 rounded-[8px] text-xs font-semibold border transition-colors duration-100",
                  step === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 py-10 overflow-y-auto">
        {step === "code" && <CodeStep onNext={() => setStep("name")} />}
        {step === "name" && (
          <NameStep
            onNext={(n) => {
              setName(n);
              setStep("waiting");
            }}
          />
        )}
        {step === "waiting" && (
          <div className="w-full flex flex-col items-center gap-6">
            <WaitingStep name={name || "학생"} />
            <Button variant="outline" size="sm" onClick={() => setStep("quiz")}>
              (목업) 선생님이 시작함 →
            </Button>
          </div>
        )}
        {step === "quiz" && <QuizStep onDone={() => setStep("done")} />}
        {step === "done" && <DoneStep />}
      </main>
    </div>
  );
}
