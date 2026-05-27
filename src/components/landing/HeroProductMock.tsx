import { useState, useEffect } from "react";

const TABS = [
  { id: "create", label: "만들기", role: "선생님", subtitle: "선생님 화면 / 새 퀴즈 만들기" },
  { id: "blank", label: "빈칸", role: "학생", subtitle: "학생 화면 / 빈칸 채우기 퀴즈" },
  { id: "sentence", label: "문장", role: "학생", subtitle: "학생 화면 / 문장 만들기 퀴즈" },
  { id: "speak", label: "말하기", role: "학생", subtitle: "학생 화면 / 말하기 연습 퀴즈" },
  { id: "result", label: "결과", role: "학생", subtitle: "학생 화면 / 퀴즈 결과" },
] as const;

type TabId = typeof TABS[number]["id"];

const ROTATE_MS = 4500;

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

function PaneCreate({ isActive }: { isActive: boolean }) {
  const FULL_TEXT = "자다, 연습하다, 혼자, 가깝다, 걸리다";
  const WORDS = ["자다", "연습하다", "혼자", "가깝다", "걸리다"];
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
    tid = setTimeout(tick, 600);
    return () => clearTimeout(tid);
  }, [isActive]);

  const wordCount = WORDS.filter(w => typed.includes(w)).length;

  return (
    <div style={{ padding: "14px 18px 16px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#1A1714" }}>새 퀴즈 만들기</div>

      {/* ① 단어 입력 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={1} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1714" }}>단어 입력</span>
        </div>
        <div style={{ border: "1.5px solid #1E6B47", background: "#FCFBF9", borderRadius: 8, padding: "8px 11px", boxShadow: "0 0 0 3px #E8F5EE", fontSize: 12, color: "#1A1714", lineHeight: 1.6, minHeight: 36 }}>
          {typed}
          <span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 2, animation: "blink 1.1s infinite" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 1 }}>
          <span style={{ fontSize: 10, color: "#6B6460" }}>입력된 단어: <strong style={{ color: "#1A1714" }}>{wordCount}</strong>개</span>
          <span style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "#9E9894" }}>쉼표(,) 또는 줄바꿈으로 구분</span>
        </div>
      </div>

      {/* ② 난이도 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={2} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1714" }}>난이도 (CEFR)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
          {CEFR_LEVELS.map((c) => (
            <div key={c.l} style={{
              padding: "5px 0", borderRadius: 9999, fontSize: 10.5, fontWeight: 700,
              textAlign: "center",
              border: c.l === "B1" ? `2px solid ${c.border}` : "2px solid transparent",
              background: c.bg, color: c.text,
              opacity: c.l === "B1" ? 1 : 0.45,
              boxShadow: c.l === "B1" ? `0 0 0 2px ${c.border}` : "none",
            }}>{c.l}</div>
          ))}
        </div>
      </div>

      {/* ③ 퀴즈 유형 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StepBadge n={3} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1714" }}>퀴즈 유형</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
          {[
            { icon: "type", label: "빈칸 채우기", sub: "필수 포함", on: true },
            { icon: "pen", label: "문장 만들기", sub: "선택됨", on: true },
            { icon: "mic", label: "말하기 연습", sub: "발음 평가", on: false },
          ].map((q, i) => (
            <div key={i} style={{
              padding: "8px 10px", borderRadius: 10,
              border: `1.5px solid ${q.on ? "#1E6B47" : "#E2DDD8"}`,
              background: q.on ? "#E8F5EE" : "#fff",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                {q.icon === "type" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={q.on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>}
                {q.icon === "pen" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={q.on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>}
                {q.icon === "mic" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={q.on ? "#1E6B47" : "#9E9894"} strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" /><line x1="12" y1="19" x2="12" y2="22" /></svg>}
                <span style={{ fontSize: 10.5, fontWeight: 700, color: q.on ? "#1A1714" : "#6B6460" }}>{q.label}</span>
              </div>
              <div style={{ fontSize: 9.5, color: q.on ? "#1E6B47" : "#9E9894" }}>{q.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "#1E6B47", color: "#fff", padding: "10px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: "auto" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8L4.3 10.7l5.8-1.9z" /><path d="M5 3l.9 2.6L8.4 6.5 5.9 7.4 5 10l-.9-2.6L1.6 6.5 4.1 5.6z" /><path d="M19 12l.9 2.6 2.5.9-2.5.9L19 19l-.9-2.6-2.5-.9 2.5-.9z" /></svg>
        AI로 퀴즈 생성
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, opacity: 0.7, padding: "2px 5px", background: "rgba(255,255,255,0.18)", borderRadius: 4 }}>⌘ ↵</span>
      </div>

    </div>
  );
}

// ─── Pane: 빈칸 채우기 ───────────────────────────────────────────────────────
function PaneBlank() {
  const PROBLEMS = [
    { n: 1, sentBefore: "피곤할 때는 일찍", sentAfter: "", hint: "-아/어요", answer: "자요", state: "done" as const },
    { n: 2, sentBefore: "집에서도 한국어를", sentAfter: "", hint: "-았/었어요", answer: "연습했어요", state: "done" as const },
    { n: 3, sentBefore: "오늘은", sentAfter: "밥을 먹었어요", hint: "", answer: "혼자", state: "done" as const },
    { n: 4, sentBefore: "여기서 역까지", sentAfter: "", hint: "-아/어요", answer: "", state: "active" as const },
    { n: 5, sentBefore: "집에서 학교까지 10분이", sentAfter: "", hint: "-아/어요", answer: "", state: "empty" as const },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Fixed header */}
      <div style={{ padding: "14px 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: "#1A1714" }}>빈칸 채우기</div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: "#6B6460" }}>세트 1 / 3</div>
        </div>
        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "7px 12px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textAlign: "center", marginBottom: 5, letterSpacing: "0.04em" }}>보기</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {[
              { w: "자다", used: true },
              { w: "연습하다", used: true },
              { w: "혼자", used: true },
              { w: "가깝다", used: false },
              { w: "걸리다", used: false },
            ].map((p, i) => (
              <span key={i} style={{
                padding: "2px 9px", borderRadius: 9999, fontSize: 10.5, fontWeight: 500,
                background: p.used ? "#F1F5F9" : "#fff",
                border: "1px solid #E2E8F0",
                color: p.used ? "#94A3B8" : "#334155",
                textDecoration: p.used ? "line-through" : "none",
                opacity: p.used ? 0.6 : 1,
              }}>{p.w}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable questions */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 0" }}>
        {PROBLEMS.map((p, idx) => (
          <div key={p.n} style={{
            paddingBottom: 10,
            borderBottom: idx < PROBLEMS.length - 1 ? "1px solid #F1F5F9" : "none",
            marginBottom: idx < PROBLEMS.length - 1 ? 10 : 0,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E6B47", minWidth: 16, flexShrink: 0 }}>{p.n}.</span>
              <p style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.65, margin: 0 }}>
                {p.sentBefore}{" "}
                <span style={{ background: "#F1F5F9", border: "1px dashed #CBD5E1", borderRadius: 5, padding: "1px 8px", fontSize: 11, color: "#94A3B8" }}>___</span>
                {p.hint && <span style={{ fontSize: 10, color: "#6B6460", marginLeft: 3 }}>{p.hint}</span>}
                {p.sentAfter && <span> {p.sentAfter}</span>}
              </p>
            </div>
            <div style={{
              width: "100%", boxSizing: "border-box" as const,
              border: p.state === "active" ? "1.5px solid #1E6B47" : p.state === "done" ? "1.5px solid #B6DFC8" : "1.5px solid #E2E8F0",
              borderRadius: 9, padding: "8px 12px",
              background: p.state === "done" ? "#F0FAF4" : "#fff",
              boxShadow: p.state === "active" ? "0 0 0 3px #E8F5EE" : "none",
              fontSize: 12.5, fontWeight: p.state === "done" ? 600 : 400,
              color: p.state === "done" ? "#1E6B47" : "#94A3B8",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 7,
            }}>
              {p.state === "done" ? p.answer : p.state === "active" ? (
                <>정답을 입력하세요<span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 3, animation: "blink 1.1s infinite" }} /></>
              ) : "정답을 입력하세요"}
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button style={{ flex: 1, padding: "6px", borderRadius: 8, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                듣기
              </button>
              <button style={{ flex: 1, padding: "6px", borderRadius: 8, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
                힌트
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed footer nav */}
      <div style={{ padding: "10px 16px 14px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ padding: "7px 12px", borderRadius: 9, background: "#fff", border: "1px solid #E2E8F0", fontSize: 11.5, fontWeight: 600, color: "#64748B" }}>‹ 이전 세트</div>
        <div style={{ padding: "7px 14px", borderRadius: 9, background: "#1E6B47", color: "#fff", fontSize: 11.5, fontWeight: 600 }}>다음 세트 ›</div>
      </div>
    </div>
  );
}

// ─── Pane: 문장 만들기 ───────────────────────────────────────────────────────
function PaneSentence({ isActive }: { isActive: boolean }) {
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
    <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#1A1714" }}>문장 만들기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6460" }}>7 / 20</div>
      </div>

      <div style={{ background: "#F8F5F0", borderRadius: 14, padding: "14px 20px 20px", display: "flex", flexDirection: "column", minHeight: 158 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ padding: "4px 9px", borderRadius: 7, background: "#fff", border: "1px solid #E2DDD8", fontSize: 11, fontWeight: 600, color: "#6B6460" }}>힌트</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#6B6460", fontWeight: 500, marginBottom: 12 }}>이 단어를 사용하여 문장을 만드세요</div>
          <div style={{ display: "inline-flex", alignItems: "center", padding: "10px 28px", background: "#fff", border: "1px solid #E2DDD8", borderRadius: 14, fontSize: 22, fontWeight: 700, color: "#1A1714" }}>걸리다</div>
          <div style={{ fontSize: 12, color: "#6B6460", marginTop: 12, fontFamily: "'Geist', system-ui" }}>take time / catch</div>
        </div>
      </div>

      <div style={{ padding: "12px 14px", minHeight: 80, border: "1.5px solid #1E6B47", borderRadius: 10, background: "#fff", boxShadow: "0 0 0 4px #E8F5EE", fontSize: 13, color: "#1A1714", lineHeight: 1.65 }}>
        {beforeH}
        {inH && <strong style={{ color: "#1E6B47" }}>{inH}</strong>}
        {afterH}
        <span style={{ display: "inline-block", width: 1.5, height: 13, background: "#1E6B47", verticalAlign: "middle", marginLeft: 1, animation: "blink 1.1s infinite" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: "8px 14px", borderRadius: 9, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12, fontWeight: 600, color: "#6B6460" }}>← 이전</div>
        <div style={{ padding: "8px 16px", borderRadius: 9, background: "#1E6B47", color: "#fff", fontSize: 12, fontWeight: 600 }}>다음 문제 →</div>
      </div>
    </div>
  );
}

// ─── Pane: 듣고 말하기 ───────────────────────────────────────────────────────
function PaneSpeak() {
  return (
    <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#1A1714" }}>듣고 말하기</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6460" }}>4 / 12</div>
      </div>

      {/* 상단 콘텐츠 영역 */}
      <div style={{ background: "#F8F5F0", borderRadius: 14, padding: "14px 20px 20px", display: "flex", flexDirection: "column", minHeight: 185 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#8B5CF6", background: "rgba(139,92,246,0.10)", padding: "4px 11px", borderRadius: 9999 }}>듣고 말하기</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: "#fff", border: "1px solid #E2DDD8", fontSize: 10.5, color: "#6B6460" }}>힌트</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 8, paddingBottom: 4 }}>
          <p style={{ fontSize: 13, color: "#6B6460", fontWeight: 500, textAlign: "center" }}>음성을 듣고 따라 녹음하세요</p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, width: "100%" }}>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              보통 속도로 듣기
            </button>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>🐢</span>
              천천히 듣기
            </button>
          </div>
        </div>
      </div>

      {/* 녹음 컨트롤 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button style={{ width: 64, height: 64, borderRadius: "50%", background: "#1E6B47", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(30,107,71,0.28)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
        </button>
        <span style={{ fontSize: 11, color: "#9E9894", fontFamily: "'Geist', system-ui" }}>마이크 버튼을 눌러 녹음을 시작하세요</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ padding: "8px 14px", borderRadius: 10, background: "#fff", border: "1px solid #E2DDD8", fontSize: 12, fontWeight: 600, color: "#6B6460" }}>↺ 다시 시도하기</div>
        <div style={{ padding: "8px 16px", borderRadius: 10, background: "#1E6B47", color: "#fff", fontSize: 12, fontWeight: 600 }}>다음 문제 ›</div>
      </div>
    </div>
  );
}

// ─── Pane: 결과 ──────────────────────────────────────────────────────────────
const WAVEFORM_HEIGHTS = [6, 10, 14, 8, 12, 6, 14, 10, 8, 12];
const NATIVE_WAVEFORM_HEIGHTS = [4, 8, 12, 10, 14, 8, 5, 12, 10, 8];

function PaneResult() {
  const [tab, setTab] = useState<"blank" | "sentence" | "speak">("blank");

  const RESULT_TABS = [
    { id: "blank" as const, label: "빈칸 채우기", pct: "80%", color: "#1E6B47" },
    { id: "sentence" as const, label: "문장 만들기", pct: "60%", color: "#6D28D9" },
    { id: "speak" as const, label: "말하기 연습", pct: "60%", color: "#D97706" },
  ];

  // 듣기/번역 보기 버튼 (빈칸 카드용)
  const SmallBtn = ({ label }: { label: string }) => (
    <button style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", height: 22, borderRadius: 5, background: "#fff", border: "1px solid #E2E8F0", fontSize: 9.5, fontWeight: 600, color: "#475569", cursor: "pointer", flexShrink: 0 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10, height: "100%", overflowY: "auto" }}>
      {/* 점수 헤더 */}
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 11, color: "#9E9894", marginBottom: 4 }}>일상 어휘 퀴즈</div>
        <div style={{ fontSize: 44, fontWeight: 900, color: "#1E6B47", lineHeight: 1, letterSpacing: "-0.02em" }}>67%</div>
        <div style={{ display: "inline-block", marginTop: 7, padding: "4px 14px", borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid #E2DDD8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontSize: 11, fontWeight: 700, color: "#1A1714" }}>
          15문제 중 10문제를 맞혔어요!
        </div>
        <div style={{ fontSize: 10.5, color: "#9E9894", marginTop: 5 }}>잘했어요! 조금만 더 연습해볼까요? 💪</div>
      </div>

      {/* 탭 */}
      <div style={{ background: "rgba(241,245,249,0.7)", borderRadius: 12, padding: 3, display: "flex", gap: 3 }}>
        {RESULT_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "6px 3px", borderRadius: 9, border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
            cursor: "pointer", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 500, color: tab === t.id ? "#1A1714" : "#6B6460" }}>{t.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.color, fontFamily: "'Geist Mono', monospace", lineHeight: 1 }}>{t.pct}</div>
          </button>
        ))}
      </div>

      {/* 카드 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {tab === "blank" && [
          { ok: true, n: 1, word: "자다", sentence: "피곤할 때는 일찍 ", answer: "자요", rest: "." },
          { ok: true, n: 2, word: "연습하다", sentence: "집에서도 한국어를 ", answer: "연습했어요", rest: "." },
          { ok: true, n: 3, word: "혼자", sentence: "오늘은 ", answer: "혼자", rest: " 밥을 먹었어요." },
          { ok: false, n: 4, word: "가깝다", sentence: "여기서 역까지 ", answer: "가까워요", rest: ".", mine: "걸려요" },
          { ok: true, n: 5, word: "걸리다", sentence: "집에서 학교까지 10분이 ", answer: "걸려요", rest: "." },
        ].map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더: [번호][단어] ... [듣기][번역 보기] */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#C13B2E", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: "2px 8px", borderRadius: 9999, background: "#F8F5F0", border: "1px solid #E2DDD8", fontSize: 10.5, fontWeight: 600, color: "#1A1714" }}>{c.word}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <SmallBtn label="듣기" />
                <SmallBtn label="번역 보기" />
              </div>
            </div>
            {/* 문장 */}
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.6 }}>
              <span style={{ color: "#1E293B" }}>{c.sentence}</span>
              <span style={{ color: c.ok ? "#2D7D52" : "#C13B2E" }}>{c.answer}</span>
              <span style={{ color: "#1E293B" }}>{c.rest}</span>
            </div>
            {/* 오답: 내 답변 */}
            {!c.ok && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "#F1F5F9", color: "#64748B", minWidth: 38, textAlign: "center" }}>내 답변</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94A3B8" }}>{c.mine}</span>
              </div>
            )}
          </div>
        ))}

        {tab === "sentence" && [
          { ok: true, n: 1, word: "자다", mine: "오늘 너무 피곤해서 일찍 잤어요.", mineColors: [] as string[], recommend: "", feedback: "" },
          { ok: false, n: 2, word: "연습하다", mine: "어제 한국어가 연습해요.", mineColors: ["한국어가", "연습해요."] as string[], recommend: "어제 한국어를 연습했어요.", feedback: 'Use "를" not "가" after 한국어, and use past tense "-었어요".' },
          { ok: true, n: 3, word: "혼자", mine: "저는 주말마다 혼자 운동해요.", mineColors: [] as string[], recommend: "", feedback: "" },
          { ok: true, n: 4, word: "가깝다", mine: "학교가 집에서 가까워요.", mineColors: [] as string[], recommend: "", feedback: "" },
          { ok: false, n: 5, word: "걸리다", mine: "10분을 걸려요.", mineColors: ["10분을", "걸려요."] as string[], recommend: "집에서 도서관까지 10분이 걸려요.", feedback: 'Use "이" not "을" as the particle before 걸리다.' },
        ].map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", background: c.ok ? "#2D7D52" : "#1E6B47", flexShrink: 0 }}>{c.n}</span>
                <span style={{ padding: "2px 8px", borderRadius: 9999, background: "#F8F5F0", border: "1px solid #E2DDD8", fontSize: 10.5, fontWeight: 600, color: "#1A1714" }}>{c.word}</span>
              </div>
              {c.ok
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              }
            </div>
            {/* 내 답변 */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: c.recommend ? 6 : 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: c.ok ? "rgba(45,125,82,0.1)" : "#F1F5F9", color: c.ok ? "#2D7D52" : "#64748B", minWidth: 38, textAlign: "center", flexShrink: 0, marginTop: 1 }}>내 답변</span>
              <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, color: "#1E293B" }}>
                {c.mine.split(" ").map((w, i, arr) => (
                  <span key={i} style={{ color: c.mineColors.includes(w) ? "#C13B2E" : "#1E293B" }}>{w}{i < arr.length - 1 ? " " : ""}</span>
                ))}
              </div>
            </div>
            {/* 추천 문장 */}
            {c.recommend && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "rgba(30,107,71,0.1)", color: "#1E6B47", minWidth: 38, textAlign: "center", flexShrink: 0, marginTop: 1 }}>추천 문장</span>
                <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, color: "#1E6B47" }}>{c.recommend}</div>
              </div>
            )}
            {/* 피드백 */}
            {c.feedback && (
              <div style={{ padding: "6px 8px", borderRadius: 7, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>{c.feedback}</div>
            )}
          </div>
        ))}

        {tab === "speak" && [
          { n: 1, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "오늘 일찍 잘 거예요.", wrongWords: [] as string[], feedback: "Pronunciation is very natural!" },
          { n: 2, type: "듣고 말하기", typeColor: "#C2410C", typeBg: "rgba(255,237,213,0.8)", sentence: "매일 조금씩 연습해요.", wrongWords: ["연습해요"] as string[], feedback: "Pay attention to the pronunciation of '연습해요'." },
          { n: 3, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "혼자 공부하는 게 좋아요.", wrongWords: [] as string[], feedback: "Great pronunciation!" },
          { n: 4, type: "듣고 말하기", typeColor: "#C2410C", typeBg: "rgba(255,237,213,0.8)", sentence: "여기서 가까워요.", wrongWords: [] as string[], feedback: "Accurate pronunciation!" },
          { n: 5, type: "보고 말하기", typeColor: "#1E6B47", typeBg: "rgba(30,107,71,0.1)", sentence: "거기까지 얼마나 걸려요?", wrongWords: ["걸려요"] as string[], feedback: "Pay attention to the pronunciation of '걸려요'." },
        ].map((c) => (
          <div key={c.n} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.typeColor, background: c.typeBg, padding: "3px 9px", borderRadius: 9999 }}>{c.type}</span>
              <SmallBtn label="번역 보기" />
            </div>
            {/* 문장 */}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1E293B", marginBottom: 8, lineHeight: 1.5 }}>{c.sentence}</div>
            {/* 원어민 파동 (듣고 말하기만) */}
            {c.type === "듣고 말하기" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "#ECFEFF", color: "#0891B2", minWidth: 38, textAlign: "center", flexShrink: 0 }}>원어민</span>
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
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "#F1F5F9", color: "#64748B", minWidth: 38, textAlign: "center", flexShrink: 0 }}>내 발음</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6, marginBottom: 7 }}>
              {c.sentence.split(" ").map((w, i, arr) => {
                const clean = w.replace(/[.?!]/g, "");
                const cleanWrong = c.wrongWords.map(ww => ww.replace(/[.?!]/g, ""));
                const isWrong = cleanWrong.includes(clean);
                return <span key={i} style={{ color: isWrong ? "#C13B2E" : "#2D7D52" }}>{w}{i < arr.length - 1 ? " " : ""}</span>;
              })}
            </div>
            {/* 피드백 박스 */}
            <div style={{ padding: "6px 8px", borderRadius: 7, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>{c.feedback}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroProductMock() {
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
      `}</style>

      {/* Tab bar above window */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, padding: 4, borderRadius: 10, background: "rgba(232,245,238,0.5)", border: "1px solid #E2DDD8" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            flex: 1, padding: "8px 6px", borderRadius: 7, border: "none",
            background: t.id === active ? "#fff" : "transparent",
            boxShadow: t.id === active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            cursor: "pointer", textAlign: "center", transition: "all 120ms ease",
            fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.id === active ? "#1A1714" : "#6B6460", marginBottom: 1, letterSpacing: "-0.01em" }}>{t.label}</div>
            <div style={{ fontSize: 9, fontFamily: "'Geist', system-ui", fontWeight: 600, color: t.id === active ? "#1E6B47" : "#9E9894", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.role}</div>
          </button>
        ))}
      </div>

      {/* Window frame */}
      <div style={{ background: "#fff", border: "1px solid #E2DDD8", borderRadius: 16, boxShadow: "0 24px 48px -16px rgba(30,107,71,0.18), 0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif", position: "relative" }}>
        {/* Window chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderBottom: "1px solid #E2DDD8", background: "#FAFAF8" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#E2DDD8", "#E2DDD8", "#E2DDD8"].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9E9894", fontFamily: "'Geist', system-ui" }}>
            {activeTab.subtitle}
          </div>
        </div>

        {/* Pane body */}
        <div style={{ height: 440, position: "relative", background: "#fff" }}>
          {TABS.map((t) => (
            <div key={t.id} style={{ position: "absolute", inset: 0, opacity: t.id === active ? 1 : 0, transition: "opacity 280ms ease", pointerEvents: t.id === active ? "auto" : "none" }}>
              {t.id === "create" && <PaneCreate isActive={active === "create"} />}
              {t.id === "blank" && <PaneBlank />}
              {t.id === "sentence" && <PaneSentence isActive={active === "sentence"} />}
              {t.id === "speak" && <PaneSpeak />}
              {t.id === "result" && <PaneResult />}
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
