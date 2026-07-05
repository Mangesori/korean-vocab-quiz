import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = [
  { id: "create", label: "퀴즈 생성", role: "선생님", subtitle: "선생님 화면 / 새 퀴즈 만들기" },
  { id: "matchup", label: "매치업", role: "학생", subtitle: "학생 화면 / 짝 맞추기 퀴즈" },
  { id: "typeAnswer", label: "받아쓰기", role: "학생", subtitle: "학생 화면 / 단어 받아쓰기 퀴즈" },
  { id: "blank", label: "빈칸 채우기", role: "학생", subtitle: "학생 화면 / 빈칸 채우기 퀴즈" },
  { id: "wordMagnet", label: "순서 맞추기", role: "학생", subtitle: "학생 화면 / 문장 순서 맞추기 퀴즈" },
  { id: "sentence", label: "문장 만들기", role: "학생", subtitle: "학생 화면 / 문장 만들기 퀴즈" },
  { id: "speak", label: "말하기 연습", role: "학생", subtitle: "학생 화면 / 말하기 연습 퀴즈" },
  { id: "result", label: "결과 확인", role: "학생", subtitle: "학생 화면 / 퀴즈 결과" },
] as const;

type TabId = typeof TABS[number]["id"];

const ROTATE_MS = 5500;

// ─── Pane: 퀴즈 만들기 ───────────────────────────────────────────────────────
const CEFR_LEVELS = [
  { l: "A1", bg: "#DCFCE7", text: "#15803D", border: "#15803D" },
  { l: "A2", bg: "#CFFAFE", text: "#0E7490", border: "#0E7490" },
  { l: "B1", bg: "#DBEAFE", text: "#1D4ED8", border: "#1D4ED8" },
  { l: "B2", bg: "#EDE9FE", text: "#6D28D9", border: "#6D28D9" },
  { l: "C1", bg: "#FCE7F3", text: "#9D174D", border: "#9D174D" },
  { l: "C2", bg: "#FEF9C3", text: "#854D0E", border: "#854D0E" },
];

function StepBadge({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#1E6B47", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
  );
}

function PaneCreate({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const FULL_TEXT = "자다, 연습하다, 혼자, 가깝다, 걸리다";
  const WORDS = ["자다", "연습하다", "혼자", "가깝다", "걸리다"];
  const [typed, setTyped] = useState("");
  const [cefrSelected, setCefrSelected] = useState("A1");
  const [typesSelected, setTypesSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isActive) { setTyped(""); setCefrSelected("A1"); setTypesSelected(new Set()); return; }
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;
    const extraTids: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      if (i < FULL_TEXT.length) {
        setTyped(FULL_TEXT.slice(0, i + 1));
        i++;
        tid = setTimeout(tick, 70);
      } else {
        // typing done — jump A1 → B1, then 퀴즈 유형이 하나씩 선택됨
        extraTids.push(setTimeout(() => setCefrSelected("B1"), 300));
        extraTids.push(setTimeout(() => setTypesSelected(new Set(["blank"])), 700));
        extraTids.push(setTimeout(() => setTypesSelected(new Set(["blank", "sentence"])), 1050));
        tid = setTimeout(() => {
          setTyped(""); i = 0;
          setCefrSelected("A1");
          setTypesSelected(new Set());
          tid = setTimeout(tick, 300);
        }, 2200);
      }
    };
    tid = setTimeout(tick, 600);
    return () => { clearTimeout(tid); extraTids.forEach(clearTimeout); };
  }, [isActive]);

  const wordCount = WORDS.filter(w => typed.includes(w)).length;

  return (
    <div style={{ padding: `${14 * S}px ${18 * S}px ${16 * S}px`, display: "flex", flexDirection: "column", gap: 14 * S, height: "100%" }}>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>퀴즈 만들기</div>

      {/* ① 단어 입력 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={1} />
          <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#1A1714" }}>단어 입력</span>
        </div>
        <div style={{ border: "1.5px solid #1E6B47", background: "#FCFBF9", borderRadius: 8, padding: `${8 * S}px ${11 * S}px`, boxShadow: "0 0 0 3px #E8F5EE", fontSize: 12 * S, color: "#1A1714", lineHeight: 1.6, minHeight: 36 * S }}>
          {typed}
          <span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 2, animation: "blink 1.1s infinite" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 1 }}>
          <span style={{ fontSize: 10 * S, color: "#6B6460" }}>입력된 단어: <strong style={{ color: "#1A1714" }}>{wordCount}</strong>개</span>
          <span style={{ fontSize: 9.5 * S, fontFamily: "'Geist Mono', monospace", color: "#9E9894" }}>쉼표(,) 또는 줄바꿈으로 구분</span>
        </div>
      </div>

      {/* ② 난이도 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={2} />
          <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#1A1714" }}>난이도</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
          {CEFR_LEVELS.map((c) => (
            <div key={c.l} style={{
              padding: "5px 0", borderRadius: 9999, fontSize: 10.5 * S, fontWeight: 700,
              textAlign: "center",
              border: c.l === cefrSelected ? `2px solid ${c.border}` : "2px solid transparent",
              background: c.bg, color: c.text,
              opacity: c.l === cefrSelected ? 1 : 0.45,
              boxShadow: c.l === cefrSelected ? `0 0 0 2px ${c.border}` : "none",
              transition: "opacity 180ms ease, border 180ms ease, box-shadow 180ms ease",
              animation: c.l === "B1" && cefrSelected === "B1" ? "cefr-pop 300ms ease" : "none",
            }}>{c.l}</div>
          ))}
        </div>
      </div>

      {/* ③ 퀴즈 유형 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={3} />
          <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#1A1714" }}>퀴즈 유형</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
          {[
            { id: "matchup", icon: "link", label: "짝 맞추기", subOff: "단어 매칭" },
            { id: "typeAnswer", icon: "keyboard", label: "단어 받아쓰기", subOff: "뜻 보고 단어 쓰기" },
            { id: "blank", icon: "type", label: "빈칸 채우기", subOff: "문장 완성하기" },
            { id: "wordMagnet", icon: "magnet", label: "문장 순서 맞추기", subOff: "순서대로 단어 배치" },
            { id: "sentence", icon: "pen", label: "문장 만들기", subOff: "단어 보고 문장 쓰기" },
            { id: "speak", icon: "mic", label: "말하기 연습", subOff: "읽거나 듣고 따라 말하기" },
          ].map((q) => {
            const on = typesSelected.has(q.id);
            return (
            <div key={q.id} style={{
              padding: `${6 * S}px ${10 * S}px`, borderRadius: 10,
              border: `1.5px solid ${on ? "#1E6B47" : "#E2DDD8"}`,
              background: on ? "#E8F5EE" : "#fff",
              transition: "border 200ms ease, background 200ms ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                {q.icon === "link" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7a5 5 0 0 1 0-10h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
                {q.icon === "keyboard" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="9" x2="6" y2="9.01" /><line x1="10" y1="9" x2="10" y2="9.01" /><line x1="14" y1="9" x2="14" y2="9.01" /><line x1="18" y1="9" x2="18" y2="9.01" /><line x1="7" y1="15" x2="17" y2="15" /></svg>}
                {q.icon === "type" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>}
                {q.icon === "magnet" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15 3 12l6-6a6 6 0 0 1 8.49 8.49L12 20l-3-3 5-5a2 2 0 1 0-2.83-2.83L6 14" /><path d="m5 8 3 3" /><path d="m11 14 3 3" /></svg>}
                {q.icon === "pen" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>}
                {q.icon === "mic" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" /><line x1="12" y1="19" x2="12" y2="22" /></svg>}
                <span style={{ fontSize: 10.5 * S, fontWeight: 700, color: on ? "#1A1714" : "#6B6460", transition: "color 200ms ease" }}>{q.label}</span>
              </div>
              <div style={{ fontSize: 9.5 * S, color: on ? "#1E6B47" : "#9E9894", transition: "color 200ms ease" }}>{on ? "선택됨" : q.subOff}</div>
            </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "#1E6B47", color: "#fff", padding: `${10 * S}px ${14 * S}px`, borderRadius: 9, fontSize: 12.5 * S, fontWeight: 600, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: "auto" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8L4.3 10.7l5.8-1.9z" /><path d="M5 3l.9 2.6L8.4 6.5 5.9 7.4 5 10l-.9-2.6L1.6 6.5 4.1 5.6z" /><path d="M19 12l.9 2.6 2.5.9-2.5.9L19 19l-.9-2.6-2.5-.9 2.5-.9z" /></svg>
        AI로 퀴즈 생성
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10 * S, opacity: 0.7, padding: "2px 5px", background: "rgba(255,255,255,0.18)", borderRadius: 4 }}>⌘ ↵</span>
      </div>

    </div>
  );
}

// ─── Pane: 짝 맞추기 ─────────────────────────────────────────────────────────
const MU_PAIRS = [
  { k: "자다", m: "to sleep" },
  { k: "연습하다", m: "to practice" },
  { k: "혼자", m: "alone" },
  { k: "가깝다", m: "close by" },
  { k: "걸리다", m: "to take (time)" },
];
const MU_LEFT_ORDER = [0, 1, 2, 3, 4];
const MU_RIGHT_ORDER = [3, 0, 4, 1, 2];

function PaneMatchup({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [selRight, setSelRight] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) { setMatched(new Set()); setSelLeft(null); setSelRight(null); return; }
    let cancelled = false;
    const tids: ReturnType<typeof setTimeout>[] = [];
    const T = (fn: () => void, ms: number) => { const id = setTimeout(() => { if (!cancelled) fn(); }, ms); tids.push(id); };

    const runCycle = () => {
      setMatched(new Set());
      setSelLeft(null);
      setSelRight(null);
      let t = 500;
      MU_PAIRS.forEach((_, i) => {
        T(() => setSelLeft(i), t); t += 550;
        T(() => setSelRight(i), t); t += 550;
        T(() => {
          setMatched((prev) => new Set(prev).add(i));
          setSelLeft(null);
          setSelRight(null);
        }, t); t += 450;
      });
      T(runCycle, t + 1200);
    };
    runCycle();
    return () => { cancelled = true; tids.forEach(clearTimeout); };
  }, [isActive]);

  const tileStyle = (state: "matched" | "selected" | "idle", isLeft: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 14, padding: `${11 * S}px ${10 * S}px`, textAlign: "center",
      transition: "all 200ms ease", fontWeight: 700, fontSize: 12 * S,
    };
    if (state === "matched") return { ...base, border: "2px solid #2D7D52", background: "rgba(45,125,82,0.1)", color: "#1A1714" };
    if (state === "selected") return { ...base, border: "2px solid #1E6B47", background: "rgba(30,107,71,0.1)", boxShadow: "0 0 0 3px rgba(30,107,71,0.15)", color: "#1A1714" };
    return isLeft
      ? { ...base, border: "2px solid rgba(30,107,71,0.2)", background: "rgba(30,107,71,0.04)", color: "#1A1714" }
      : { ...base, border: "2px solid #E2E8F0", background: "#F8FAFC", color: "#1E293B", fontWeight: 500 };
  };

  return (
    <div style={{ padding: `${18 * S}px ${20 * S}px ${22 * S}px`, display: "flex", flexDirection: "column", gap: 14 * S, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>짝 맞추기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 * S, color: "#6B6460" }}>{matched.size} / {MU_PAIRS.length}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 * S, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MU_LEFT_ORDER.map((i) => (
            <div key={i} style={tileStyle(matched.has(i) ? "matched" : selLeft === i ? "selected" : "idle", true)}>{MU_PAIRS[i].k}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MU_RIGHT_ORDER.map((i) => (
            <div key={i} style={tileStyle(matched.has(i) ? "matched" : selRight === i ? "selected" : "idle", false)}>{MU_PAIRS[i].m}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: `${8 * S}px ${14 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#6B6460" }}>← 이전</div>
        <div style={{
          padding: `${8 * S}px ${16 * S}px`, borderRadius: 9, fontSize: 12 * S, fontWeight: 600,
          background: matched.size === MU_PAIRS.length ? "#1E6B47" : "#E2DDD8",
          color: matched.size === MU_PAIRS.length ? "#fff" : "#9E9894",
          transition: "all 200ms ease",
        }}>결과 확인 →</div>
      </div>
    </div>
  );
}

// ─── Pane: 단어 받아쓰기 ─────────────────────────────────────────────────────
function PaneTypeAnswer({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const PROMPT = "alone";
  const ANSWER = "혼자";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!isActive) { setTyped(""); return; }
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i < ANSWER.length) {
        setTyped(ANSWER.slice(0, i + 1));
        i++;
        tid = setTimeout(tick, 220);
      } else {
        tid = setTimeout(() => { setTyped(""); i = 0; tid = setTimeout(tick, 500); }, 2200);
      }
    };
    tid = setTimeout(tick, 600);
    return () => clearTimeout(tid);
  }, [isActive]);

  const done = typed === ANSWER;

  return (
    <div style={{ padding: `${18 * S}px ${22 * S}px ${22 * S}px`, display: "flex", flexDirection: "column", gap: 16 * S, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>단어 받아쓰기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 * S, color: "#6B6460" }}>3 / 15</div>
      </div>

      <div style={{ padding: `${22 * S}px ${20 * S}px`, background: "#F8FAFC", borderRadius: 14, minHeight: 90 * S, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 17 * S, fontWeight: 700, color: "#1A1714", textAlign: "center", margin: 0 }}>{PROMPT}</p>
      </div>

      <div style={{
        height: 46 * S, borderRadius: 12, background: "#F8FAFC",
        border: typed ? "1.5px solid #1E6B47" : "1.5px solid #E2E8F0",
        boxShadow: typed ? "0 0 0 3px rgba(30,107,71,0.12)" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15 * S, fontWeight: 700, color: done ? "#1E6B47" : "#1A1714",
        transition: "all 200ms ease",
      }}>
        {typed
          ? <>{typed}<span style={{ display: "inline-block", width: 1.5, height: 14, background: "#1E6B47", verticalAlign: "middle", marginLeft: 2, animation: "blink 1.1s infinite" }} /></>
          : <span style={{ fontSize: 12 * S, fontWeight: 400, color: "#94A3B8" }}>정답 입력</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: `${8 * S}px ${14 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#6B6460" }}>← 이전</div>
        <div style={{ padding: `${8 * S}px ${16 * S}px`, borderRadius: 9, background: "#1E6B47", color: "#fff", fontSize: 12 * S, fontWeight: 600 }}>다음 문제 →</div>
      </div>
    </div>
  );
}

// ─── Pane: 빈칸 채우기 ───────────────────────────────────────────────────────
function PaneBlank({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const Q1_ANS = "자요";
  const Q2_ANS = "연습했어요";
  const [q1typed, setQ1typed] = useState("");
  const [q2typed, setQ2typed] = useState("");

  useEffect(() => {
    if (!isActive) { setQ1typed(""); setQ2typed(""); return; }
    let cancelled = false;
    const tids: ReturnType<typeof setTimeout>[] = [];
    const T = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      tids.push(id);
    };
    const cycle = () => {
      let t = 700;
      for (let i = 1; i <= Q1_ANS.length; i++) {
        const s = Q1_ANS.slice(0, i);
        T(() => setQ1typed(s), t); t += 500;
      }
      t += 700;
      for (let i = 1; i <= Q2_ANS.length; i++) {
        const s = Q2_ANS.slice(0, i);
        T(() => setQ2typed(s), t); t += 500;
      }
      // stop after 2s hold — no reset, no loop
    };
    cycle();
    return () => { cancelled = true; tids.forEach(clearTimeout); };
  }, [isActive]);

  type QS = "done" | "typing" | "active" | "empty";
  const q1s: QS = q1typed === Q1_ANS ? "done" : q1typed ? "typing" : "empty";
  const q2s: QS = q2typed === Q2_ANS ? "done" : q2typed ? "typing" : "empty";

  const PROBLEMS: { n: number; sentBefore: string; sentAfter: string; hint: string; answer: string; qs: QS }[] = [
    { n: 1, sentBefore: "피곤할 때는 일찍", sentAfter: "", hint: "-아/어요", answer: q1typed, qs: q1s },
    { n: 2, sentBefore: "집에서도 한국어를", sentAfter: "", hint: "-았/었어요", answer: q2typed, qs: q2s },
    { n: 3, sentBefore: "오늘은", sentAfter: "밥을 먹었어요", hint: "", answer: "", qs: "empty" },
    { n: 4, sentBefore: "여기서 역까지", sentAfter: "", hint: "-아/어요", answer: "", qs: "empty" },
    { n: 5, sentBefore: "집에서 학교까지 10분이", sentAfter: "", hint: "-아/어요", answer: "", qs: "empty" },
  ];

  const bankWords = [
    { w: "걸리다", struck: false },
    { w: "자다", struck: q1typed === Q1_ANS },
    { w: "가깝다", struck: false },
    { w: "혼자", struck: false },
    { w: "연습하다", struck: q2typed === Q2_ANS },
  ];

  const isGlow = (s: QS) => s === "active" || s === "typing";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Fixed header */}
      {isMobile ? (
        /* 모바일: 안내 문구 + 보기 박스가 이어진 하나의 베이지 블록(실제 FillBlankStage 스타일) */
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: 0, background: "#F1ECE4", padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, color: "#1A1714", textAlign: "center" }}>
            빈칸에 알맞은 단어를 입력하세요
          </p>
          <div style={{ background: "#F1ECE4", borderBottom: "1px solid #D3CCC4", padding: "0 16px 10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textAlign: "center", marginBottom: 6, letterSpacing: "0.05em" }}>보기</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
              {bankWords.map((p, i) => (
                <span key={i} style={{
                  padding: "4px 11px", borderRadius: 9999, fontSize: 10.5, fontWeight: 500,
                  background: p.struck ? "#F1F5F9" : "#fff",
                  border: "1px solid #E2E8F0",
                  boxShadow: p.struck ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
                  color: p.struck ? "#94A3B8" : "#334155",
                  textDecoration: p.struck ? "line-through" : "none",
                  opacity: p.struck ? 0.6 : 1,
                  transition: "all 250ms ease",
                }}>{p.w}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 데스크톱: 안내 문구 + 보기 박스가 이어진 하나의 베이지 블록(실제 FillBlankStage 스타일) */
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: 0, background: "#F1ECE4", padding: `${10 * S}px ${18 * S}px 6px`, fontSize: 11.5 * S, fontWeight: 700, color: "#1A1714", textAlign: "center" }}>
            빈칸에 알맞은 단어를 입력하세요
          </p>
          <div style={{ background: "#F1ECE4", borderBottom: "1px solid #D3CCC4", padding: `0 ${18 * S}px ${10 * S}px`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 10 * S, fontWeight: 700, color: "#64748B", textAlign: "center", marginBottom: 7, letterSpacing: "0.05em" }}>보기</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
              {bankWords.map((p, i) => (
                <span key={i} style={{
                  padding: `${4 * S}px ${11 * S}px`, borderRadius: 9999, fontSize: 10.5 * S, fontWeight: 500,
                  background: p.struck ? "#F1F5F9" : "#fff",
                  border: "1px solid #E2E8F0",
                  boxShadow: p.struck ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
                  color: p.struck ? "#94A3B8" : "#334155",
                  textDecoration: p.struck ? "line-through" : "none",
                  opacity: p.struck ? 0.6 : 1,
                  transition: "all 250ms ease",
                }}>{p.w}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable questions */}
      <div style={{ flex: 1, overflowY: "auto", padding: `4px ${16 * S}px 0` }}>
        {PROBLEMS.map((p, idx) => isMobile ? (
          // ── 모바일: 세로 스택 레이아웃 ──
          <div key={p.n} style={{
            paddingBottom: 12,
            borderBottom: idx < PROBLEMS.length - 1 ? "1px solid #F1F5F9" : "none",
            marginBottom: idx < PROBLEMS.length - 1 ? 12 : 0,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E6B47", minWidth: 16, flexShrink: 0 }}>{p.n}.</span>
              <p style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.65, margin: 0 }}>
                {p.sentBefore}{" "}
                <span style={{ color: "#94A3B8", fontWeight: 500 }}>( ____ )</span>
                {p.hint && <span style={{ fontSize: 10, color: "rgba(30, 107, 71, 0.7)", marginLeft: 3, fontWeight: 500 }}>{p.hint}</span>}
                {p.sentAfter && <span> {p.sentAfter}</span>}
              </p>
            </div>
            <div style={{
              width: "100%", boxSizing: "border-box" as const,
              border: p.qs === "done" ? "1.5px solid #B6DFC8" : "1.5px solid #E2E8F0",
              borderRadius: 11, padding: "9px 12px",
              background: "#F3F4F6",
              fontSize: 12.5,
              fontWeight: p.qs === "done" || p.qs === "typing" ? 600 : 400,
              color: p.qs === "done" ? "#1E6B47" : p.qs === "typing" ? "#1A1714" : "#94A3B8",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 7,
              transition: "border 200ms ease",
            }}>
              {p.qs === "done" ? p.answer
                : p.qs === "typing" ? (
                  <>{p.answer}<span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 2, animation: "blink 1.1s infinite" }} /></>
                ) : "정답 입력"
              }
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button style={{ flex: 1, padding: "6px", borderRadius: 8, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11, fontWeight: 600, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                듣기
              </button>
              <button style={{ flex: 1, padding: "6px", borderRadius: 8, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11, fontWeight: 600, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
                힌트
              </button>
            </div>
          </div>
        ) : (
          // ── 데스크톱: 가로 행 레이아웃 (실제 FillBlankStage 스타일) ──
          <div key={p.n} style={{
            display: "flex", alignItems: "center", gap: 8 * S,
            paddingTop: 16 * S, paddingBottom: 16 * S,
            borderBottom: idx < PROBLEMS.length - 1 ? "1px solid #F1F5F9" : "none",
          }}>
            {/* 번호 */}
            <span style={{ fontSize: 11 * S, fontWeight: 700, color: "#1E6B47", minWidth: 18, flexShrink: 0 }}>
              {p.n}.
            </span>

            {/* 문장 + 인라인 입력 박스 */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, lineHeight: 1.9 }}>
              {p.sentBefore && (
                <span style={{ fontSize: 12 * S, color: "#1E293B" }}>{p.sentBefore}</span>
              )}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 140 * S, height: 28 * S, padding: `0 ${10 * S}px`,
                border: isGlow(p.qs) ? "1.5px solid #1E6B47"
                      : p.qs === "done" ? "1.5px solid #B6DFC8"
                      : "1.5px solid #E2E8F0",
                borderRadius: 9,
                background: p.qs === "done" ? "#F0FAF4" : "#F8F9FA",
                boxShadow: isGlow(p.qs) ? "0 0 0 3px #E8F5EE" : "none",
                fontSize: 12 * S,
                fontWeight: p.qs === "done" || p.qs === "typing" ? 600 : 400,
                color: p.qs === "done" ? "#1E6B47" : p.qs === "typing" ? "#1A1714" : "#94A3B8",
                transition: "border 200ms ease, background 200ms ease, box-shadow 200ms ease",
              }}>
                {p.qs === "done" ? p.answer
                  : p.qs === "typing" ? (
                    <>{p.answer}<span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 2, animation: "blink 1.1s infinite" }} /></>
                  ) : <span style={{ fontSize: 11 * S, color: "#94A3B8" }}>정답 입력</span>}
              </span>
              {p.hint && (
                <span style={{ fontSize: 10.5 * S, color: "rgba(30, 107, 71, 0.7)", fontWeight: 500 }}>{p.hint}</span>
              )}
              {p.sentAfter && (
                <span style={{ fontSize: 12 * S, color: "#1E293B" }}>{p.sentAfter}</span>
              )}
            </div>

            {/* 듣기/힌트 버튼 — 오른쪽 고정 */}
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              <button style={{ padding: `${5 * S}px ${9 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                듣기
              </button>
              <button style={{ padding: `${5 * S}px ${9 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
                힌트
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed footer nav */}
      <div style={{ padding: `${10 * S}px ${16 * S}px ${14 * S}px`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {isMobile ? (
          <>
            <div style={{ padding: `${7 * S}px ${12 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11.5 * S, fontWeight: 600, color: "#64748B" }}>‹ 이전 세트</div>
            <div style={{ padding: `${7 * S}px ${14 * S}px`, borderRadius: 9, background: "#1E6B47", color: "#fff", fontSize: 11.5 * S, fontWeight: 600 }}>다음 세트 ›</div>
          </>
        ) : (
          <>
            <div style={{ padding: `${11 * S}px ${18 * S}px`, borderRadius: 11, background: "rgba(255,255,255,0.6)", border: "1px solid #E2E8F0", fontSize: 12 * S, fontWeight: 600, color: "#64748B", display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              이전 세트
            </div>
            <div style={{ padding: `${11 * S}px ${20 * S}px`, borderRadius: 11, background: "#1E6B47", color: "#fff", fontSize: 12 * S, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, boxShadow: "0 4px 12px rgba(30,107,71,0.25)" }}>
              다음 세트
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pane: 문장 순서 맞추기 ───────────────────────────────────────────────────
const WM_TILES: { content: string; isParticle: boolean }[] = [
  { content: "집", isParticle: false },
  { content: "에서", isParticle: true },
  { content: "학교", isParticle: false },
  { content: "까지", isParticle: true },
  { content: "10분", isParticle: false },
  { content: "이", isParticle: true },
  { content: "걸려요.", isParticle: false },
];
const WM_BANK_ORDER = [4, 1, 6, 0, 5, 3, 2];

function WMTile({ content, isParticle, S, hidden, marginLeft }: { content: string; isParticle: boolean; S: number; hidden?: boolean; marginLeft?: number }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 10, padding: `${6 * S}px ${11 * S}px`, fontSize: 12.5 * S, fontWeight: 600,
      whiteSpace: "nowrap",
      marginLeft: marginLeft ?? 0,
      background: hidden || isParticle ? "#F1F5F9" : "#fff",
      color: hidden ? "transparent" : isParticle ? "#64748B" : "#1A1714",
      border: "1px solid #E2E8F0",
      boxShadow: !hidden && !isParticle ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
      transition: "opacity 200ms ease",
    }}>{content}</div>
  );
}

function PaneWordMagnet({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const [placedCount, setPlacedCount] = useState(0);

  useEffect(() => {
    if (!isActive) { setPlacedCount(0); return; }
    let cancelled = false;
    const tids: ReturnType<typeof setTimeout>[] = [];
    const T = (fn: () => void, ms: number) => { const id = setTimeout(() => { if (!cancelled) fn(); }, ms); tids.push(id); };
    const runCycle = () => {
      setPlacedCount(0);
      let t = 600;
      for (let i = 1; i <= WM_TILES.length; i++) {
        T(() => setPlacedCount(i), t);
        t += 480;
      }
      T(runCycle, t + 1800);
    };
    runCycle();
    return () => { cancelled = true; tids.forEach(clearTimeout); };
  }, [isActive]);

  return (
    <div style={{ padding: `${18 * S}px ${20 * S}px ${20 * S}px`, display: "flex", flexDirection: "column", gap: 12 * S, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>문장 순서 맞추기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 * S, color: "#6B6460" }}>5 / 10</div>
      </div>

      <div style={{ padding: `${14 * S}px ${16 * S}px`, background: "#F8FAFC", borderRadius: 12, textAlign: "center" }}>
        <p style={{ fontSize: 12.5 * S, fontWeight: 600, color: "#1A1714", margin: 0 }}>It takes 10 minutes from home to school.</p>
      </div>

      {/* 답 영역 — 실제 WordMagnetStage처럼 하나의 연속된 밑줄(ruled-line) 영역에 타일이
          자연스럽게 줄바꿈되는 구조(고정 2단으로 나누지 않음) */}
      <div style={{
        minHeight: 100 * S,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${49 * S}px, #E2DDD8 ${49 * S}px, #E2DDD8 ${50 * S}px)`,
        display: "flex", flexWrap: "wrap", alignContent: "flex-start", alignItems: "flex-end", rowGap: 12, padding: `2px 2px ${5 * S}px`,
      }}>
        {WM_TILES.slice(0, placedCount).map((t, i) => (
          <WMTile
            key={i}
            content={t.content}
            isParticle={t.isParticle}
            S={S}
            marginLeft={i > 0 ? (t.isParticle ? 4 * S : 12 * S) : 0}
          />
        ))}
      </div>

      {/* 단어 은행 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: `${8 * S}px`, marginTop: 6 }}>
        {WM_BANK_ORDER.map((idx) => (
          <WMTile key={idx} content={WM_TILES[idx].content} isParticle={WM_TILES[idx].isParticle} S={S} hidden={idx < placedCount} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: `${8 * S}px ${14 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#6B6460" }}>← 이전</div>
        <div style={{
          padding: `${8 * S}px ${16 * S}px`, borderRadius: 9, fontSize: 12 * S, fontWeight: 600,
          background: placedCount === WM_TILES.length ? "#1E6B47" : "#E2DDD8",
          color: placedCount === WM_TILES.length ? "#fff" : "#9E9894",
          transition: "all 200ms ease",
        }}>다음 문제 →</div>
      </div>
    </div>
  );
}

// ─── Pane: 문장 만들기 ───────────────────────────────────────────────────────
function PaneSentence({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const FULL_TEXT = "집에서 학교까지 10분이 걸려요.";
  const H_START = "집에서 학교까지 10분이 ".length;
  const H_END = H_START + "걸려요".length;
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!isActive) { setTyped(""); return; }
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i < FULL_TEXT.length) {
        setTyped(FULL_TEXT.slice(0, i + 1));
        i++;
        tid = setTimeout(tick, 70);
      } else {
        tid = setTimeout(() => { setTyped(""); i = 0; tid = setTimeout(tick, 300); }, 2200);
      }
    };
    tid = setTimeout(tick, 400);
    return () => clearTimeout(tid);
  }, [isActive]);

  const beforeH = typed.slice(0, Math.min(typed.length, H_START));
  const inH = typed.length > H_START ? typed.slice(H_START, Math.min(typed.length, H_END)) : "";
  const afterH = typed.length > H_END ? typed.slice(H_END) : "";

  return (
    <div style={{ padding: `${18 * S}px ${22 * S}px ${22 * S}px`, display: "flex", flexDirection: "column", gap: 14 * S, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>문장 만들기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 * S, color: "#6B6460" }}>7 / 20</div>
      </div>

      <div style={{ background: "#F8FAFC", borderRadius: 14, padding: `${14 * S}px ${20 * S}px ${20 * S}px`, display: "flex", flexDirection: "column", minHeight: 158 * S }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: `${6 * S}px ${11 * S}px`, borderRadius: 11, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", fontSize: 11 * S, fontWeight: 600, color: "#6B6460" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
            힌트
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12 * S, color: "#6B6460", fontWeight: 500, marginBottom: 12 }}>이 단어를 사용하여 문장을 만드세요</div>
          <div style={{ display: "inline-flex", alignItems: "center", padding: `${8 * S}px ${22 * S}px`, background: "#fff", border: "1px solid #E2DDD8", borderRadius: 14, fontSize: 17 * S, fontWeight: 700, color: "#1A1714" }}>걸리다</div>
          <div style={{ fontSize: 12 * S, color: "#6B6460", marginTop: 12, fontFamily: "'Geist', system-ui" }}>take time</div>
        </div>
      </div>

      <div style={{ padding: `${12 * S}px ${14 * S}px`, minHeight: 80 * S, border: "1.5px solid #1E6B47", borderRadius: 10, background: "#fff", boxShadow: "0 0 0 4px #E8F5EE", fontSize: 13 * S, color: "#1A1714", lineHeight: 1.65 }}>
        {beforeH}
        {inH && <strong style={{ color: "#1E6B47" }}>{inH}</strong>}
        {afterH}
        <span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 1, animation: "blink 1.1s infinite" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: `${8 * S}px ${14 * S}px`, borderRadius: 9, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#6B6460" }}>← 이전</div>
        <div style={{ padding: `${8 * S}px ${16 * S}px`, borderRadius: 9, background: "#1E6B47", color: "#fff", fontSize: 12 * S, fontWeight: 600 }}>다음 문제 →</div>
      </div>
    </div>
  );
}

// ─── Pane: 듣고 말하기 ───────────────────────────────────────────────────────
function PaneSpeak({ isActive, isMobile = false }: { isActive: boolean; isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!isActive) { setRecording(false); return; }
    const tid = setTimeout(() => setRecording(true), 1200);
    return () => clearTimeout(tid);
  }, [isActive]);

  return (
    <div style={{ padding: `${18 * S}px ${22 * S}px ${22 * S}px`, display: "flex", flexDirection: "column", gap: 14 * S, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16 * S, color: "#1A1714" }}>듣고 말하기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 * S, color: "#6B6460" }}>4 / 12</div>
      </div>

      {/* 상단 콘텐츠 영역 */}
      <div style={{ background: "#F8FAFC", borderRadius: 14, padding: `${14 * S}px ${20 * S}px ${20 * S}px`, display: "flex", flexDirection: "column", minHeight: 185 * S }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontSize: 11 * S, fontWeight: 600, color: "#8B5CF6", background: "rgba(139,92,246,0.10)", padding: `4px ${11 * S}px`, borderRadius: 9999 }}>듣고 말하기</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: `${6 * S}px ${11 * S}px`, borderRadius: 11, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", fontSize: 10.5 * S, fontWeight: 600, color: "#6B6460" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
            힌트
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 8, paddingBottom: 4 }}>
          <p style={{ fontSize: 13 * S, color: "#6B6460", fontWeight: 500, textAlign: "center" }}>음성을 듣고 따라 녹음하세요</p>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: `${7 * S}px ${14 * S}px`, borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              보통 속도로 듣기
            </button>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: `${7 * S}px ${14 * S}px`, borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>🐢</span>
              천천히 듣기
            </button>
          </div>
        </div>
      </div>

      {/* 녹음 컨트롤 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button style={{
            width: 64 * S, height: 64 * S, borderRadius: "50%", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: recording ? "#DC2626" : "#1E6B47",
            boxShadow: recording
              ? "0 4px 16px rgba(220,38,38,0.4), 0 0 0 0px rgba(220,38,38,0.2)"
              : "0 4px 16px rgba(30,107,71,0.28)",
            animation: recording ? "pulse-red 1.4s ease-in-out infinite" : "none",
            transition: "background 200ms ease, box-shadow 200ms ease",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
        </button>
        <span style={{ fontSize: 11 * S, color: recording ? "#DC2626" : "#9E9894", fontFamily: "'Geist', system-ui", transition: "color 200ms ease" }}>
          {recording ? "녹음 중" : "마이크 버튼을 눌러 녹음을 시작하세요"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: `${8 * S}px ${14 * S}px`, borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12 * S, fontWeight: 600, color: "#6B6460" }}>↺ 다시 시도하기</div>
        <div style={{ padding: `${8 * S}px ${16 * S}px`, borderRadius: 10, background: "#1E6B47", color: "#fff", fontSize: 12 * S, fontWeight: 600 }}>다음 문제 ›</div>
      </div>
    </div>
  );
}

// ─── Pane: 결과 ──────────────────────────────────────────────────────────────
const WAVEFORM_HEIGHTS = [6, 10, 14, 8, 12, 6, 14, 10, 8, 12];
const NATIVE_WAVEFORM_HEIGHTS = [4, 8, 12, 10, 14, 8, 5, 12, 10, 8];

const MATCHUP_RESULTS = [
  { ok: true, n: 1, word: "자다", mine: "to sleep" },
  { ok: true, n: 2, word: "연습하다", mine: "to practice" },
  { ok: true, n: 3, word: "혼자", mine: "alone" },
  { ok: false, n: 4, word: "가깝다", mine: "to take (time)", correct: "close by" },
  { ok: true, n: 5, word: "걸리다", mine: "to take (time)" },
];

const TYPE_ANSWER_RESULTS = [
  { ok: true, n: 1, prompt: "to sleep", mine: "자다" },
  { ok: true, n: 2, prompt: "to practice", mine: "연습하다" },
  { ok: false, n: 3, prompt: "alone", mine: "혹자", correct: "혼자" },
  { ok: true, n: 4, prompt: "close by", mine: "가깝다" },
  { ok: true, n: 5, prompt: "to take (time)", mine: "걸리다" },
];

const BLANK_RESULTS = [
  { ok: true, n: 1, word: "자다", sentence: "피곤할 때는 일찍 ", answer: "자요", rest: "." },
  { ok: true, n: 2, word: "연습하다", sentence: "집에서도 한국어를 ", answer: "연습했어요", rest: "." },
  { ok: true, n: 3, word: "혼자", sentence: "오늘은 ", answer: "혼자", rest: " 밥을 먹었어요." },
  { ok: false, n: 4, word: "가깝다", sentence: "여기서 역까지 ", answer: "가까워요", rest: ".", mine: "걸려요" },
  { ok: true, n: 5, word: "걸리다", sentence: "집에서 학교까지 10분이 ", answer: "걸려요", rest: "." },
];

const WORD_MAGNET_RESULTS = [
  { ok: true, n: 1, translation: "I sleep early because I'm tired today.", mine: "오늘 너무 피곤해서 일찍 자요." },
  { ok: true, n: 2, translation: "I practice Korean at home too.", mine: "집에서도 한국어를 연습해요." },
  { ok: false, n: 3, translation: "It takes 10 minutes from home to school.", mine: "학교에서 집이 10분 걸려요.", correct: "집에서 학교까지 10분이 걸려요." },
  { ok: true, n: 4, translation: "The school is close from here.", mine: "여기서 학교까지 가까워요." },
  { ok: true, n: 5, translation: "I studied alone at the library.", mine: "저는 도서관에서 혼자 공부했어요." },
];

const SENTENCE_RESULTS = [
  { ok: true, n: 1, word: "자다", mine: "오늘 너무 피곤해서 일찍 잤어요.", mineColors: [] as string[], recommend: "", feedback: "Accurate and natural! Your tense and sentence ending are both used correctly." },
  { ok: false, n: 2, word: "연습하다", mine: "어제 한국어가 연습해요.", mineColors: ["한국어가", "연습해요."] as string[], recommend: "어제 한국어를 연습했어요.", feedback: 'Since 한국어 is the object being practiced, it should take the object marker "를", not "가". Also, since this happened yesterday, use the past tense "-었어요" instead of "-해요".' },
  { ok: true, n: 3, word: "혼자", mine: "저는 주말마다 혼자 운동해요.", mineColors: [] as string[], recommend: "", feedback: "Great grammar and natural phrasing. Well done!" },
  { ok: true, n: 4, word: "가깝다", mine: "학교가 집에서 가까워요.", mineColors: [] as string[], recommend: "", feedback: "A clean, correct sentence." },
  { ok: false, n: 5, word: "걸리다", mine: "10분을 걸려요.", mineColors: ["10분을", "걸려요."] as string[], recommend: "집에서 도서관까지 10분이 걸려요.", feedback: 'The particle before 걸리다 should be the subject marker "이", not the object marker "을" — "시간이 걸리다" is the natural pattern here.' },
];

const SPEAK_RESULTS = [
  { n: 1, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "오늘 일찍 잘 거예요.", wrongWords: [] as string[], feedback: "Excellent pronunciation! You sound very natural and clear." },
  { n: 2, type: "듣고 말하기", typeColor: "#C2410C", typeBg: "rgba(255,237,213,0.8)", sentence: "매일 조금씩 연습해요.", wrongWords: ["연습해요"] as string[], feedback: "Pay closer attention to the pronunciation of '연습해요'. Listen to the native speaker and try again!" },
  { n: 3, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "혼자 공부하는 게 좋아요.", wrongWords: [] as string[], feedback: "Good job! Keep practicing to make it even more natural." },
  { n: 4, type: "듣고 말하기", typeColor: "#C2410C", typeBg: "rgba(255,237,213,0.8)", sentence: "여기서 가까워요.", wrongWords: [] as string[], feedback: "Excellent pronunciation! You sound very natural and clear." },
  { n: 5, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "거기까지 얼마나 걸려요?", wrongWords: ["걸려요"] as string[], feedback: "Pay closer attention to the pronunciation of '걸려요'. Listen to the native speaker and try again!" },
];

function pctLabel(correct: number, total: number) {
  return `${Math.round((correct / total) * 100)}%`;
}
const MATCHUP_CORRECT = MATCHUP_RESULTS.filter((r) => r.ok).length;
const TYPE_ANSWER_CORRECT = TYPE_ANSWER_RESULTS.filter((r) => r.ok).length;
const BLANK_CORRECT = BLANK_RESULTS.filter((r) => r.ok).length;
const WORD_MAGNET_CORRECT = WORD_MAGNET_RESULTS.filter((r) => r.ok).length;
const SENTENCE_CORRECT = SENTENCE_RESULTS.filter((r) => r.ok).length;
const SPEAK_CORRECT = SPEAK_RESULTS.filter((r) => r.wrongWords.length === 0).length;
const TOTAL_CORRECT = MATCHUP_CORRECT + TYPE_ANSWER_CORRECT + BLANK_CORRECT + WORD_MAGNET_CORRECT + SENTENCE_CORRECT + SPEAK_CORRECT;
const TOTAL_PROBLEMS = MATCHUP_RESULTS.length + TYPE_ANSWER_RESULTS.length + BLANK_RESULTS.length + WORD_MAGNET_RESULTS.length + SENTENCE_RESULTS.length + SPEAK_RESULTS.length;

// 결과 탭 아이콘 — 실제 QuizResult.tsx가 쓰는 Lucide 아이콘(Link2/Keyboard/FileText/Magnet/Pencil/Mic)과 동일한 모양
function ResultTabIcon({ icon, color }: { icon: string; color: string }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (icon === "link") return <svg {...common}><path d="M9 17H7a5 5 0 0 1 0-10h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
  if (icon === "keyboard") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="9" x2="6" y2="9.01" /><line x1="10" y1="9" x2="10" y2="9.01" /><line x1="14" y1="9" x2="14" y2="9.01" /><line x1="18" y1="9" x2="18" y2="9.01" /><line x1="7" y1="15" x2="17" y2="15" /></svg>;
  if (icon === "filetext") return <svg {...common}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>;
  if (icon === "magnet") return <svg {...common}><path d="M6 15 3 12l6-6a6 6 0 0 1 8.49 8.49L12 20l-3-3 5-5a2 2 0 1 0-2.83-2.83L6 14" /><path d="m5 8 3 3" /><path d="m11 14 3 3" /></svg>;
  if (icon === "pencil") return <svg {...common}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>;
  if (icon === "mic") return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
  return null;
}

function PaneResult({ isMobile = false }: { isMobile?: boolean }) {
  const S = isMobile ? 1 : 1.3;
  const [tab, setTab] = useState<"matchup" | "typeAnswer" | "blank" | "wordMagnet" | "sentence" | "speak">("matchup");

  const RESULT_TABS = [
    { id: "matchup" as const, label: "짝 맞추기", icon: "link", pct: pctLabel(MATCHUP_CORRECT, MATCHUP_RESULTS.length), color: "#F59E0B" },
    { id: "typeAnswer" as const, label: "단어 받아쓰기", icon: "keyboard", pct: pctLabel(TYPE_ANSWER_CORRECT, TYPE_ANSWER_RESULTS.length), color: "#EC4899" },
    { id: "blank" as const, label: "빈칸 채우기", icon: "filetext", pct: pctLabel(BLANK_CORRECT, BLANK_RESULTS.length), color: "#3B82F6" },
    { id: "wordMagnet" as const, label: "문장 순서 맞추기", icon: "magnet", pct: pctLabel(WORD_MAGNET_CORRECT, WORD_MAGNET_RESULTS.length), color: "#06B6D4" },
    { id: "sentence" as const, label: "문장 만들기", icon: "pencil", pct: pctLabel(SENTENCE_CORRECT, SENTENCE_RESULTS.length), color: "#22C55E" },
    { id: "speak" as const, label: "말하기 연습", icon: "mic", pct: pctLabel(SPEAK_CORRECT, SPEAK_RESULTS.length), color: "#A855F7" },
  ];

  // 듣기/번역 보기 버튼 (빈칸 카드용)
  const SmallBtn = ({ label }: { label: string }) => (
    <button style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: `2px ${7 * S}px`, height: 22 * S, borderRadius: 10, background: "#fff", border: "1px solid #E2E8F0", fontSize: 9.5 * S, fontWeight: 600, color: "#475569", cursor: "pointer", flexShrink: 0 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: `${14 * S}px ${18 * S}px ${18 * S}px`, display: "flex", flexDirection: "column", gap: 10 * S, height: "100%", overflowY: "auto" }}>
      {/* 점수 헤더 */}
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 11 * S, color: "#9E9894", marginBottom: 4 }}>일상 어휘 퀴즈</div>
        <div style={{ fontSize: 44 * S, fontWeight: 900, color: "#1E6B47", lineHeight: 1, letterSpacing: "-0.02em" }}>{pctLabel(TOTAL_CORRECT, TOTAL_PROBLEMS)}</div>
        <div style={{ display: "inline-block", marginTop: 7, padding: `4px ${14 * S}px`, borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid #E2DDD8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontSize: 11 * S, fontWeight: 700, color: "#1A1714" }}>
          {TOTAL_PROBLEMS}문제 중 {TOTAL_CORRECT}문제를 맞혔어요!
        </div>
        <div style={{ fontSize: 10.5 * S, color: "#9E9894", marginTop: 5 }}>잘했어요! 조금만 더 연습해볼까요? 💪</div>
      </div>

      {/* 탭 */}
      <div style={{ background: "rgba(241,245,249,0.7)", borderRadius: 12, padding: 3, display: "flex", gap: 3 }}>
        {RESULT_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: `6px 3px`, borderRadius: 9, border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
            cursor: "pointer", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <ResultTabIcon icon={t.icon} color={tab === t.id ? t.color : "#9E9894"} />
            <div style={{ fontSize: 8.5 * S, fontWeight: 500, color: tab === t.id ? "#1A1714" : "#6B6460", lineHeight: 1.2 }}>{t.label}</div>
            <div style={{ fontSize: 13 * S, fontWeight: 700, color: t.color, fontFamily: "'Geist Mono', monospace", lineHeight: 1 }}>{t.pct}</div>
          </button>
        ))}
      </div>

      {/* 카드 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {tab === "matchup" && MATCHUP_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9 * S, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#C13B2E", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: `2px ${8 * S}px`, borderRadius: 9999, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#334155" }}>{c.word}</span>
              </div>
              {c.ok
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C13B2E" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              }
            </div>
            {c.ok ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#1E293B" }}>{c.mine}</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(193,59,46,0.1)", color: "#C13B2E", width: 46, textAlign: "center", flexShrink: 0 }}>내 답변</span>
                  <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#C13B2E", textDecoration: "line-through" }}>{c.mine}</span>
                </div>
                {c.correct && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                    <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#1E6B47" }}>{c.correct}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {tab === "typeAnswer" && TYPE_ANSWER_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9 * S, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#C13B2E", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: `2px ${8 * S}px`, borderRadius: 9999, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#334155" }}>{c.prompt}</span>
              </div>
              {c.ok
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C13B2E" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              }
            </div>
            {c.ok ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#1E293B" }}>{c.mine}</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(193,59,46,0.1)", color: "#C13B2E", width: 46, textAlign: "center", flexShrink: 0 }}>내 답변</span>
                  <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#C13B2E", textDecoration: "line-through" }}>{c.mine}</span>
                </div>
                {c.correct && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                    <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#1E6B47" }}>{c.correct}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {tab === "blank" && BLANK_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더: [번호][단어] ... [듣기][번역 보기] */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9 * S, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#C13B2E", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: `2px ${8 * S}px`, borderRadius: 9999, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#334155" }}>{c.word}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <SmallBtn label="듣기" />
                <SmallBtn label="번역 보기" />
              </div>
            </div>
            {/* 문장 */}
            <div style={{ fontSize: 12 * S, fontWeight: 600, lineHeight: 1.6 }}>
              <span style={{ color: "#1E293B" }}>{c.sentence}</span>
              <span style={{ color: c.ok ? "#2D7D52" : "#C13B2E" }}>{c.answer}</span>
              <span style={{ color: "#1E293B" }}>{c.rest}</span>
            </div>
            {/* 오답: 내 답변 */}
            {!c.ok && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "#F1F5F9", color: "#64748B", width: 46, textAlign: "center" }}>내 답변</span>
                <span style={{ fontSize: 11.5 * S, fontWeight: 700, color: "#94A3B8" }}>{c.mine}</span>
              </div>
            )}
          </div>
        ))}

        {tab === "wordMagnet" && WORD_MAGNET_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9 * S, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#C13B2E", flexShrink: 0, marginTop: 1 }}>{c.n}</span>
                <span style={{ fontSize: 10 * S, color: "#334155", fontWeight: 600, lineHeight: 1.4, padding: `2px ${8 * S}px`, borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>{c.translation}</span>
              </div>
              <div style={{ flexShrink: 0 }}>
                {c.ok
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C13B2E" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                }
              </div>
            </div>
            {c.ok ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#1E293B" }}>{c.mine}</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(193,59,46,0.1)", color: "#C13B2E", width: 46, textAlign: "center", flexShrink: 0 }}>내 답변</span>
                  <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#C13B2E", textDecoration: "line-through" }}>{c.mine}</span>
                </div>
                {c.correct && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0 }}>정답</span>
                    <span style={{ fontSize: 12 * S, fontWeight: 600, color: "#1E6B47" }}>{c.correct}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {tab === "sentence" && SENTENCE_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9 * S, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#1E6B47", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: `2px ${8 * S}px`, borderRadius: 9999, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10.5 * S, fontWeight: 600, color: "#334155" }}>{c.word}</span>
              </div>
              {c.ok
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              }
            </div>
            {/* 내 답변 */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: c.recommend ? 6 : 0 }}>
              <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: c.ok ? "rgba(45,125,82,0.1)" : "#F1F5F9", color: c.ok ? "#2D7D52" : "#64748B", width: 46, textAlign: "center", flexShrink: 0, marginTop: 1 }}>내 답변</span>
              <div style={{ fontSize: 11.5 * S, fontWeight: 600, lineHeight: 1.55, color: "#1E293B" }}>
                {c.mine.split(" ").map((w, i, arr) => (
                  <span key={i} style={{ color: c.mineColors.includes(w) ? "#C13B2E" : "#1E293B" }}>{w}{i < arr.length - 1 ? " " : ""}</span>
                ))}
              </div>
            </div>
            {/* 추천 문장 */}
            {c.recommend && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 700, padding: "4px 0", borderRadius: 10, background: "rgba(30,107,71,0.1)", color: "#1E6B47", width: 46, textAlign: "center", flexShrink: 0, marginTop: 1 }}>추천 문장</span>
                <div style={{ fontSize: 11.5 * S, fontWeight: 600, lineHeight: 1.55, color: "#1E6B47" }}>{c.recommend}</div>
              </div>
            )}
            {/* 피드백 */}
            {c.feedback && (
              <div style={{ padding: `${10 * S}px ${12 * S}px`, borderRadius: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", fontSize: 10.5 * S, color: "#64748B", lineHeight: 1.6 }}>{c.feedback}</div>
            )}
          </div>
        ))}

        {tab === "speak" && SPEAK_RESULTS.map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: `${10 * S}px ${12 * S}px`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10 * S, fontWeight: 600, color: c.typeColor, background: c.typeBg, padding: `3px ${9 * S}px`, borderRadius: 9999 }}>{c.type}</span>
              <SmallBtn label="번역 보기" />
            </div>
            {/* 문장 */}
            <div style={{ fontSize: 12.5 * S, fontWeight: 700, color: "#1E293B", marginBottom: 8, lineHeight: 1.5 }}>{c.sentence}</div>
            {/* 원어민 파동 (듣고 말하기만) */}
            {c.type === "듣고 말하기" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 9.5 * S, fontWeight: 600, color: "#64748B", whiteSpace: "nowrap", flexShrink: 0 }}>원어민 음성</span>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#ECFEFF", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {NATIVE_WAVEFORM_HEIGHTS.map((h, i) => (
                      <div key={i} style={{ width: 2, height: h, borderRadius: 2, background: "#67E8F9" }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* 내 발음 row */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <span style={{ fontSize: 9.5 * S, fontWeight: 600, color: "#64748B", whiteSpace: "nowrap", flexShrink: 0 }}>내 발음</span>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBEB", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {WAVEFORM_HEIGHTS.map((h, i) => (
                    <div key={i} style={{ width: 2, height: h, borderRadius: 2, background: "#FCD34D" }} />
                  ))}
                </div>
              </div>
            </div>
            {/* 단어별 색상 피드백 문장 */}
            <div style={{ fontSize: 12 * S, fontWeight: 700, lineHeight: 1.6, marginBottom: 7 }}>
              {c.sentence.split(" ").map((w, i, arr) => {
                const clean = w.replace(/[.?!]/g, "");
                const cleanWrong = c.wrongWords.map(ww => ww.replace(/[.?!]/g, ""));
                const isWrong = cleanWrong.includes(clean);
                return <span key={i} style={{ color: isWrong ? "#C13B2E" : "#2D7D52" }}>{w}{i < arr.length - 1 ? " " : ""}</span>;
              })}
            </div>
            {/* 피드백 박스 */}
            <div style={{ padding: `${10 * S}px ${12 * S}px`, borderRadius: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", fontSize: 10.5 * S, color: "#64748B", lineHeight: 1.6 }}>{c.feedback}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroProductMock() {
  const isMobile = useIsMobile();
  const S = isMobile ? 1 : 1.3;
  const [active, setActive] = useState<TabId>("create");
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      const idx = TABS.findIndex((t) => t.id === active);
      setActive(TABS[(idx + 1) % TABS.length].id);
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: "relative" }}
    >
      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
        @keyframes hero-progress { from { width: 0% } to { width: 100% } }
        @keyframes pulse-red { 0%, 100% { box-shadow: 0 4px 16px rgba(220,38,38,0.4), 0 0 0 0px rgba(220,38,38,0.25) } 50% { box-shadow: 0 4px 16px rgba(220,38,38,0.4), 0 0 0 10px rgba(220,38,38,0.0) } }
        @keyframes cefr-pop { 0% { transform: scale(1) } 30% { transform: scale(0.82) } 65% { transform: scale(1.12) } 100% { transform: scale(1) } }
      `}</style>

      {/* Tab bar above window */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <div
          style={{
            display: "flex", gap: 4, padding: 4, borderRadius: 10,
            background: "rgba(232,245,238,0.5)", border: "1px solid #E2DDD8",
            overflowX: "auto",
            scrollSnapType: "x proximity",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              data-tab-id={t.id}
              onClick={(e) => {
                setActive(t.id);
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              style={{
              flex: "0 0 auto",
              minWidth: Math.round(76 * S),
              scrollSnapAlign: "start",
              padding: `${8 * S}px 6px`, borderRadius: 7, border: "none",
              background: t.id === active ? "#fff" : "transparent",
              boxShadow: t.id === active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer", textAlign: "center", transition: "all 120ms ease",
              fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}>
              <div style={{ fontSize: 12 * S, fontWeight: 600, color: t.id === active ? "#1A1714" : "#6B6460", marginBottom: 1, letterSpacing: "-0.01em" }}>{t.label}</div>
              <div style={{ fontSize: 9 * S, fontFamily: "'Geist', system-ui", fontWeight: 600, color: t.id === active ? "#1E6B47" : "#9E9894", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.role}</div>
            </button>
          ))}
        </div>
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 28,
          background: "linear-gradient(to right, rgba(232,245,238,0), rgba(232,245,238,0.95))",
          borderRadius: "0 10px 10px 0",
          pointerEvents: "none",
        }} />
      </div>

      {/* Window frame */}
      <div style={{ background: "#fff", border: "1px solid #E2DDD8", borderRadius: 16, boxShadow: "0 24px 48px -16px rgba(30,107,71,0.18), 0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif", position: "relative" }}>
        {/* Window chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `${11 * S}px ${16 * S}px`, borderBottom: "1px solid #E2DDD8", background: "#FAFAF8" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#E2DDD8", "#E2DDD8", "#E2DDD8"].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, textAlign: "center", fontSize: 11 * S, color: "#9E9894", fontFamily: "'Geist', system-ui" }}>
            {activeTab.subtitle}
          </div>
        </div>

        {/* Pane body */}
        <div style={{ height: 440 * S, position: "relative", background: "#fff" }}>
          {TABS.map((t) => (
            <div key={t.id} style={{ position: "absolute", inset: 0, opacity: t.id === active ? 1 : 0, transition: "opacity 280ms ease", pointerEvents: t.id === active ? "auto" : "none" }}>
              {t.id === "create" && <PaneCreate isActive={active === "create"} isMobile={isMobile} />}
              {t.id === "matchup" && <PaneMatchup isActive={active === "matchup"} isMobile={isMobile} />}
              {t.id === "typeAnswer" && <PaneTypeAnswer isActive={active === "typeAnswer"} isMobile={isMobile} />}
              {t.id === "blank" && <PaneBlank isActive={active === "blank"} isMobile={isMobile} />}
              {t.id === "wordMagnet" && <PaneWordMagnet isActive={active === "wordMagnet"} isMobile={isMobile} />}
              {t.id === "sentence" && <PaneSentence isActive={active === "sentence"} isMobile={isMobile} />}
              {t.id === "speak" && <PaneSpeak isActive={active === "speak"} isMobile={isMobile} />}
              {t.id === "result" && <PaneResult isMobile={isMobile} />}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: "#E2DDD8", position: "relative" }}>
          <div
            key={active + (paused ? "-p" : "")}
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              background: "#1E6B47",
              animation: paused ? "none" : `hero-progress ${ROTATE_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
