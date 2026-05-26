// landing-b.jsx
// 시안 B — 도구 강조 split hero (Linear style)
// 좌측 카피 + CTA, 우측 실제 hero-input UI 미니어처
// "퀴즈 만드는 데 30분 쓰지 마세요" 톤

const LB_COLORS = {
  primary: '#1E6B47',
  primaryDark: '#155237',
  primaryLight: '#E8F5EE',
  surface: '#F8F5F0',
  card: '#FFFFFF',
  border: '#E2DDD8',
  text: '#1A1714',
  muted: '#6B6460',
  hint: '#9E9894',
};

const LB_FONTS = {
  kr: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
  brand: "'Paperozi', 'Pretendard Variable', sans-serif",
  ui: "'Geist', system-ui, sans-serif",
  mono: "'Geist Mono', monospace",
  serif: "'DM Serif Display', serif",
};

// ─────────────────────────────────────────────────────────────────────
// 우측 히어로: 5개 화면 탭형 미니어처
// 1) 퀴즈 만들기 (선생님 대시보드 hero-input)
// 2) 빈칸 채우기 (학생 퀴즈 — 단어뱅크 + 문장형 빈칸)
// 3) 문장 만들기 (학생 퀴즈 — 단어 카드 + textarea)
// 4) 말하기 연습 (학생 퀴즈 — 녹음 + 단어별 색상 채점)
// 5) 결과 화면 (빈칸 결과 — ✓/✗ 카드 리스트)
// ─────────────────────────────────────────────────────────────────────

const HERO_TABS = [
  { id: 'create',   label: '퀴즈 만들기',   role: '선생님',   subtitle: '단어 → 자동 생성' },
  { id: 'blank',    label: '빈칸 채우기',   role: '학생',     subtitle: '맥락 속 단어' },
  { id: 'sentence', label: '문장 만들기',   role: '학생',     subtitle: 'AI 채점' },
  { id: 'speak',    label: '말하기 연습',   role: '학생',     subtitle: '발음·자연스러움' },
  { id: 'result',   label: '결과',          role: '학생',     subtitle: '3가지 퀴즈 종합' },
];

// 모든 탭 공통: 동일한 윈도우 프레임. 내부 본문 영역만 갈아끼움.
const MOCK_BODY_HEIGHT = 580; // 본문 고정 — 탭 전환 시 점프 방지

// ── Pane 1: 퀴즈 만들기 (선생님 대시보드) ─────────────────────────────
const PaneCreate = () => (
  <div style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <div style={{
        fontFamily: LB_FONTS.serif, fontSize: 20, color: LB_COLORS.text,
        letterSpacing: '-0.01em',
      }}>새 퀴즈 만들기</div>
      <div style={{
        fontFamily: LB_FONTS.ui, fontSize: 11, color: LB_COLORS.hint,
      }}>3B · INTERMEDIATE</div>
    </div>

    <div style={{
      border: `1.5px solid ${LB_COLORS.primary}`,
      background: '#FCFBF9',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 14,
      boxShadow: `0 0 0 4px ${LB_COLORS.primaryLight}`,
    }}>
      <div style={{
        fontSize: 13, color: LB_COLORS.text, lineHeight: 1.6,
        minHeight: 60,
      }}>
        성장, 자라다, 가지, 뿌리, 잎, 새싹, 줄기, 햇빛<span style={{
          display: 'inline-block', width: 1.5, height: 14, background: LB_COLORS.primary,
          verticalAlign: 'middle', marginLeft: 2, animation: 'blink 1.1s infinite',
        }} />
      </div>
    </div>

    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {[
        { l: '빈칸 채우기', on: true },
        { l: '문장 만들기', on: true },
        { l: '말하기', on: true },
        { l: '시간 제한', on: false },
      ].map((p, i) => (
        <div key={i} style={{
          padding: '5px 11px', borderRadius: 9999,
          fontSize: 11, fontWeight: 600,
          border: `1.5px solid ${p.on ? LB_COLORS.primary : LB_COLORS.border}`,
          background: p.on ? LB_COLORS.primaryLight : LB_COLORS.card,
          color: p.on ? LB_COLORS.primary : LB_COLORS.muted,
        }}>{p.l}</div>
      ))}
    </div>

    <div style={{
      background: LB_COLORS.primary, color: '#fff',
      padding: '11px 14px', borderRadius: 9,
      fontSize: 13, fontWeight: 600, textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginBottom: 18,
    }}>
      <SparkleIcon size={14} />
      AI로 퀴즈 생성
      <span style={{
        fontFamily: LB_FONTS.mono, fontSize: 10, opacity: 0.7,
        padding: '2px 5px', background: 'rgba(255,255,255,0.18)', borderRadius: 4,
      }}>⌘ ↵</span>
    </div>

    {/* 생성된 결과 미리보기 */}
    <div style={{
      borderTop: `1px dashed ${LB_COLORS.border}`,
      paddingTop: 16,
      flex: 1, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        fontSize: 10, color: LB_COLORS.hint, fontFamily: LB_FONTS.ui,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: 10, fontWeight: 600,
      }}>생성됨 · 20문항 · 3.4초</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          { icon: <BlankIcon />, label: '빈칸 채우기', tag: '8문항' },
          { icon: <PenIcon />, label: '문장 만들기', tag: '8문항' },
          { icon: <MicIcon />, label: '말하기 연습', tag: '4문항' },
        ].map((q, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 11px', borderRadius: 8,
            background: LB_COLORS.surface,
            border: `1px solid ${LB_COLORS.border}`,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: LB_COLORS.primaryLight, color: LB_COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{React.cloneElement(q.icon, { size: 13 })}</div>
            <div style={{
              flex: 1, fontSize: 12, color: LB_COLORS.text, fontWeight: 500,
            }}>{q.label}</div>
            <div style={{
              fontSize: 10, fontFamily: LB_FONTS.mono, color: LB_COLORS.muted,
              padding: '2px 6px', borderRadius: 4,
              background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
            }}>{q.tag}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Pane 2: 빈칸 채우기 (학생 화면) — 5문제 + 이전/다음 세트 ─────────
const PaneBlank = () => {
  const slateBorder = '#E2E8F0';
  const slateText = '#1E293B';
  const slateMuted = '#64748B';
  const slateLight = '#F8FAFC';

  const IconSpeaker = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
  const IconBulb = ({ color = '#475569' }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
    </svg>
  );

  const ListenBtn = () => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2.5px 7px', borderRadius: 7,
      background: LB_COLORS.card, border: `1px solid ${slateBorder}`,
      fontSize: 9.5, color: '#475569', fontWeight: 500,
    }}><IconSpeaker /> 듣기</span>
  );
  const HintBtn = ({ active = false }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2.5px 7px', borderRadius: 7,
      background: active ? '#FFFBEB' : LB_COLORS.card,
      border: `1px solid ${active ? '#FDE68A' : slateBorder}`,
      fontSize: 9.5, color: active ? '#D97706' : '#475569', fontWeight: 500,
    }}><IconBulb color={active ? '#D97706' : '#475569'} /> 힌트</span>
  );

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: LB_FONTS.serif, fontSize: 16, color: LB_COLORS.text,
          letterSpacing: '-0.01em',
        }}>빈칸 채우기</div>
        <div style={{
          fontFamily: LB_FONTS.mono, fontSize: 11, color: LB_COLORS.muted,
        }}>세트 1 / 3</div>
      </div>

      {/* 단어뱅크 */}
      <div style={{
        background: slateLight,
        borderRadius: 10,
        padding: '9px 14px',
        border: `1px solid ${slateBorder}`,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: slateMuted,
          fontFamily: LB_FONTS.ui, textAlign: 'center', marginBottom: 6,
          letterSpacing: '0.04em',
        }}>보기</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
          {[
            { w: '자다', used: true },
            { w: '연습하다', used: true },
            { w: '혼자', used: true },
            { w: '가깝다', used: false },
            { w: '10분이 걸리다', used: false },
          ].map((p, i) => (
            <span key={i} style={{
              padding: '2px 10px', borderRadius: 9999,
              fontSize: 10.5, fontWeight: 500,
              background: p.used ? '#F1F5F9' : LB_COLORS.card,
              border: `1px solid ${slateBorder}`,
              color: p.used ? '#94A3B8' : '#334155',
              textDecoration: p.used ? 'line-through' : 'none',
              opacity: p.used ? 0.65 : 1,
              boxShadow: p.used ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
            }}>{p.w}</span>
          ))}
        </div>
      </div>

      {/* 문제 리스트 (5문제) */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: 11.5 }}>
        {[
          { n: 1, before: '피곤할 때는 일찍', input: '자요', grammar: '-아요/어요', after: '.' },
          { n: 2, before: '집에서도 발음을', input: '연습할 수 있어요', grammar: '-(으)ㄹ 수 있다', after: '.', hint: 'You can practice pronunciation at home too.' },
          { n: 3, before: '오늘은', input: '혼자', grammar: '', after: '밥을 먹었어요.' },
          { n: 4, before: '집에서 학교까지', input: '', grammar: '-아요/어요', after: '.' },
          { n: 5, before: '여기서 역까지', input: '', grammar: '-아요/어요', after: '.' },
        ].map((row, idx) => (
          <div key={row.n} style={{
            padding: '7px 0',
            borderTop: idx === 0 ? `1px solid ${slateBorder}` : 'none',
            borderBottom: `1px solid ${slateBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: LB_COLORS.primary,
                minWidth: 12,
              }}>{row.n}.</span>
              <div style={{ flex: 1, color: slateText, lineHeight: 1.6 }}>
                {row.before}{' '}
                <span style={{
                  display: 'inline-block', minWidth: 70, padding: '2px 6px',
                  background: LB_COLORS.card,
                  border: `1px solid ${slateBorder}`,
                  borderRadius: 7,
                  fontSize: 10.5, fontWeight: 600, textAlign: 'center',
                  color: row.input ? slateText : '#94A3B8',
                  margin: '0 2px',
                }}>{row.input || '정답 입력'}</span>{' '}
                {row.grammar && <span style={{ color: LB_COLORS.primary, fontWeight: 500 }}>{row.grammar}</span>}
                {row.after}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <ListenBtn />
                <HintBtn active={!!row.hint} />
              </div>
            </div>
            {row.hint && (
              <div style={{
                marginLeft: 19, marginTop: 5,
                padding: '6px 10px', borderRadius: 7,
                background: '#F0F9FF', border: '1px solid #E0F2FE',
                fontSize: 10, color: '#1E293B', lineHeight: 1.45,
              }}>{row.hint}</div>
            )}
          </div>
        ))}
      </div>

      {/* 세트 네비 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4,
      }}>
        <div style={{
          padding: '7px 12px', borderRadius: 9,
          background: LB_COLORS.card, border: `1px solid ${slateBorder}`,
          fontSize: 11.5, fontWeight: 600, color: slateMuted,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>‹ 이전 세트</div>
        <div style={{
          padding: '7px 14px', borderRadius: 9,
          background: LB_COLORS.primary, color: '#fff',
          fontSize: 11.5, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>다음 세트 ›</div>
      </div>
    </div>
  );
};

// ── Pane 3: 문장 만들기 (학생 화면) — 실제 mockups 기준 ──────────
const PaneSentence = () => (
  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{
        fontFamily: LB_FONTS.serif, fontSize: 16, color: LB_COLORS.text,
        letterSpacing: '-0.01em',
      }}>문장 만들기</div>
      <div style={{
        fontFamily: LB_FONTS.mono, fontSize: 11, color: LB_COLORS.muted,
      }}>7 / 20</div>
    </div>

    {/* word display area */}
    <div style={{
      background: LB_COLORS.surface,
      borderRadius: 14,
      padding: '32px 24px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 12, right: 14,
        padding: '4px 9px', borderRadius: 7,
        background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
        fontSize: 11, fontWeight: 600, color: LB_COLORS.muted,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>힌트</div>

      <div style={{
        fontSize: 12, color: LB_COLORS.muted, fontWeight: 500, marginBottom: 14,
      }}>이 단어를 사용하여 문장을 만드세요</div>

      <div style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '10px 28px',
        background: LB_COLORS.card,
        border: `1px solid ${LB_COLORS.border}`,
        borderRadius: 14,
        fontSize: 22, fontWeight: 700, color: LB_COLORS.text,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>날씨</div>

      <div style={{
        fontSize: 12, color: LB_COLORS.muted, marginTop: 14,
        fontFamily: LB_FONTS.ui,
      }}>weather</div>
    </div>

    {/* textarea */}
    <div style={{
      padding: '12px 14px', minHeight: 90,
      border: `1.5px solid ${LB_COLORS.primary}`,
      borderRadius: 10,
      background: LB_COLORS.card,
      boxShadow: `0 0 0 4px ${LB_COLORS.primaryLight}`,
      fontSize: 13, color: LB_COLORS.text, lineHeight: 1.65,
    }}>
      오늘 <strong style={{ color: LB_COLORS.primary }}>날씨</strong>가 너무 좋아서 공원에서 산책했어요.<span style={{
        display: 'inline-block', width: 1.5, height: 13, background: LB_COLORS.primary,
        verticalAlign: 'middle', marginLeft: 1, animation: 'blink 1.1s infinite',
      }} />
    </div>

    {/* nav */}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 'auto',
    }}>
      <div style={{
        padding: '8px 14px', borderRadius: 9,
        background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
        fontSize: 12, fontWeight: 600, color: LB_COLORS.muted,
      }}>← 이전</div>
      <div style={{
        padding: '8px 16px', borderRadius: 9,
        background: LB_COLORS.primary, color: '#fff',
        fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>다음 문제 →</div>
    </div>
  </div>
);

// ── Pane 4: 말하기 연습 (한 문제 채점 통과 상태) — 스크린샷 기준 ───
const PaneSpeak = () => (
  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{
        fontFamily: LB_FONTS.serif, fontSize: 16, color: LB_COLORS.text,
        letterSpacing: '-0.01em',
      }}>말하기 연습</div>
      <div style={{
        fontFamily: LB_FONTS.mono, fontSize: 11, color: LB_COLORS.muted,
      }}>4 / 12</div>
    </div>

    {/* 문장 카드 (surface, 보고 말하기 badge + 힌트) */}
    <div style={{
      background: LB_COLORS.surface,
      borderRadius: 14,
      padding: '16px 22px 22px',
      minHeight: 150,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: '#8B5CF6',
          background: 'rgba(139,92,246,0.12)',
          padding: '4px 11px', borderRadius: 9999,
          fontFamily: LB_FONTS.kr,
        }}>보고 말하기</span>
        <span style={{
          padding: '4px 10px', borderRadius: 8,
          background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
          fontSize: 10.5, color: LB_COLORS.muted,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>힌트</span>
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 24, fontWeight: 700, color: LB_COLORS.text,
          textAlign: 'center', lineHeight: 1.4,
        }}>머리가 아파요.</div>
      </div>
    </div>

    {/* 통과 결과 패널 (녹색 보더) */}
    <div style={{
      background: 'rgba(45,125,82,0.06)',
      border: '1px solid rgba(45,125,82,0.35)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
      }}>
        <span style={{
          padding: '4px 10px', borderRadius: 8,
          background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
          fontSize: 11, color: LB_COLORS.muted,
          display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
          재생
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D7D52" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div style={{
        textAlign: 'center', padding: '6px 0',
        fontSize: 19, fontWeight: 700, color: '#2D7D52',
      }}>머리가 아파요.</div>
    </div>

    {/* nav */}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto',
    }}>
      <div style={{
        padding: '8px 14px', borderRadius: 10,
        background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
        fontSize: 12, fontWeight: 600, color: LB_COLORS.muted,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>↺ 다시 시도하기</div>
      <div style={{
        padding: '8px 16px', borderRadius: 10,
        background: LB_COLORS.primary, color: '#fff',
        fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>다음 문제 ›</div>
    </div>
  </div>
);

// ── Pane 5: 최종 결과 (3 퀴즈 모두) — mockups 최종 결과 화면 기준 ─────
const PaneResult = () => {
  const slateBorder = '#E2E8F0';
  const slateText = '#1E293B';
  const slateMuted = '#64748B';
  const [tab, setTab] = React.useState('blank');

  const TABS = [
    { id: 'blank',    label: '빈칸 채우기', score: 80, color: '#1E6B47' },
    { id: 'sentence', label: '문장 만들기', score: 82, color: '#2D7D52' },
    { id: 'speak',    label: '말하기 연습', score: 75, color: '#D97706' },
  ];

  // 탭별 대표 카드 (각 1~2개)
  const CARDS = {
    blank: [
      { ok: true,  word: '사과', before: '저는 ', after: ' 를 좋아해요.' },
      { ok: false, word: '김치', before: '', after: ' 는 한국 사람들이 자주 먹는 음식이에요.', mine: '깍두기' },
    ],
    sentence: [
      { ok: true,  word: '날씨', text: '오늘 ', textHi: '날씨', textAfter: '가 너무 좋아서 공원에서 산책했어요.' },
      { ok: false, word: '여행', text: '저는 ', textHi: '여행', textAfter: '을 가고 싶어요.', tip: '"여행을 더 자주 가고 싶어요"처럼 빈도 표현을 추가하면 자연스러워요.' },
    ],
    speak: [
      { ok: true,  text: '오늘 날씨가 정말 좋아요.', isAllGreen: true },
      { ok: true,  text: '이 음식은 너무 맛있어요.', wrongWords: ['너무'] },
    ],
  };

  return (
    <div style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* 최상단 헤더 */}
      <div style={{ textAlign: 'center', paddingTop: 2 }}>
        <div style={{
          fontFamily: LB_FONTS.serif, fontSize: 14, color: slateMuted,
          letterSpacing: '-0.01em', marginBottom: 4,
        }}>봄 단어 어휘 퀴즈</div>
        <div style={{
          fontFamily: LB_FONTS.serif, fontSize: 42, fontWeight: 400,
          color: LB_COLORS.primary, lineHeight: 1, letterSpacing: '-0.02em',
        }}>79%</div>
        <div style={{
          fontSize: 11.5, color: slateMuted, marginTop: 7,
        }}>15문제 중 <strong style={{ color: LB_COLORS.primary }}>12</strong>문제 정답</div>
      </div>

      {/* 3 퀴즈 탭 바 */}
      <div style={{
        background: 'rgba(241,245,249,0.7)',
        borderRadius: 14, padding: 4,
        display: 'flex', gap: 3,
      }}>
        {TABS.map((t) => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '8px 4px',
              borderRadius: 10, border: 'none',
              background: isActive ? LB_COLORS.card : 'transparent',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
              cursor: 'pointer', textAlign: 'center',
              fontFamily: LB_FONTS.kr,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 500,
                color: isActive ? slateText : slateMuted,
              }}>{t.label}</div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: t.color,
                fontFamily: LB_FONTS.mono, lineHeight: 1,
              }}>{t.score}%</div>
            </button>
          );
        })}
      </div>

      {/* 탭별 결과 카드 (대표 2개) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
        {tab === 'blank' && CARDS.blank.map((c, i) => (
          <div key={i} style={{
            background: LB_COLORS.card, border: `1px solid ${slateBorder}`,
            borderRadius: 11, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: c.ok ? '#2D7D52' : '#C13B2E',
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: LB_FONTS.mono,
              }}>{i + 1}</span>
              <span style={{
                padding: '2px 9px', borderRadius: 9999,
                background: '#F8FAFC', border: `1px solid ${slateBorder}`,
                fontSize: 11, fontWeight: 600, color: '#334155',
              }}>{c.word}</span>
              {!c.ok && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, color: '#94A3B8', fontFamily: LB_FONTS.ui,
                }}>내 답변: <span style={{ color: '#C13B2E', fontWeight: 600 }}>{c.mine}</span></span>
              )}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.6, color: slateText }}>
              {c.before}
              <span style={{ color: c.ok ? '#2D7D52' : '#C13B2E', fontWeight: 700 }}>{c.word}</span>
              {c.after}
            </div>
          </div>
        ))}

        {tab === 'sentence' && CARDS.sentence.map((c, i) => (
          <div key={i} style={{
            background: LB_COLORS.card, border: `1px solid ${slateBorder}`,
            borderRadius: 11, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: c.ok ? '#2D7D52' : '#D97706',
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: LB_FONTS.mono,
              }}>{i + 1}</span>
              <span style={{
                padding: '2px 9px', borderRadius: 9999,
                background: '#F8FAFC', border: `1px solid ${slateBorder}`,
                fontSize: 11, fontWeight: 600, color: '#334155',
              }}>{c.word}</span>
            </div>
            <div style={{
              fontSize: 11.5, fontWeight: 600, lineHeight: 1.6,
              color: c.ok ? '#2D7D52' : slateText,
            }}>
              {c.text}<span style={{ fontWeight: 700 }}>{c.textHi}</span>{c.textAfter}
            </div>
            {c.tip && (
              <div style={{
                marginTop: 6, padding: '6px 9px', borderRadius: 7,
                background: '#F8FAFC', border: '1px solid #F1F5F9',
                fontSize: 10, color: slateMuted, lineHeight: 1.45,
              }}>{c.tip}</div>
            )}
          </div>
        ))}

        {tab === 'speak' && CARDS.speak.map((c, i) => (
          <div key={i} style={{
            background: LB_COLORS.card, border: `1px solid ${slateBorder}`,
            borderRadius: 11, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: '#2D7D52',
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: LB_FONTS.mono,
              }}>{i + 1}</span>
              <span style={{
                padding: '2px 9px', borderRadius: 9999,
                fontSize: 10, fontWeight: 600,
                color: i === 0 ? '#8B5CF6' : '#C2410C',
                background: i === 0 ? 'rgba(139,92,246,0.1)' : '#FFF7ED',
              }}>{i === 0 ? '보고 말하기' : '듣고 말하기'}</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.6 }}>
              {c.isAllGreen ? (
                <span style={{ color: '#2D7D52' }}>{c.text}</span>
              ) : (
                // 단어별 색칠
                c.text.split(' ').map((word, wi, arr) => {
                  const cleanWord = word.replace(/\./g, '');
                  const isWrong = c.wrongWords && c.wrongWords.includes(cleanWord);
                  return (
                    <React.Fragment key={wi}>
                      <span style={{ color: isWrong ? '#C13B2E' : '#2D7D52' }}>{word}</span>
                      {wi < arr.length - 1 && ' '}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const HERO_PANES = {
  create: <PaneCreate />,
  blank: <PaneBlank />,
  sentence: <PaneSentence />,
  speak: <PaneSpeak />,
  result: <PaneResult />,
};

const HeroProductMock = () => {
  const [active, setActive] = React.useState('create');
  const [paused, setPaused] = React.useState(false);
  const ROTATE_MS = 4500;

  // auto-rotate
  React.useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      const idx = HERO_TABS.findIndex(t => t.id === active);
      const next = HERO_TABS[(idx + 1) % HERO_TABS.length].id;
      setActive(next);
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  const activeTab = HERO_TABS.find(t => t.id === active);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: 'relative' }}
    >
      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>

      {/* Tabs above window */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 10,
        padding: '4px', borderRadius: 10,
        background: 'rgba(232, 245, 238, 0.5)',
        border: `1px solid ${LB_COLORS.border}`,
      }}>
        {HERO_TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                flex: 1, padding: '8px 6px',
                borderRadius: 7, border: 'none',
                background: isActive ? LB_COLORS.card : 'transparent',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 120ms ease',
                fontFamily: LB_FONTS.kr,
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: isActive ? LB_COLORS.text : LB_COLORS.muted,
                marginBottom: 1, letterSpacing: '-0.01em',
              }}>{t.label}</div>
              <div style={{
                fontSize: 9, fontFamily: LB_FONTS.ui, fontWeight: 600,
                color: isActive ? LB_COLORS.primary : LB_COLORS.hint,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{t.role}</div>
            </button>
          );
        })}
      </div>

      {/* Window frame */}
      <div style={{
        background: LB_COLORS.card,
        border: `1px solid ${LB_COLORS.border}`,
        borderRadius: 16,
        boxShadow: '0 24px 48px -16px rgba(30,107,71,0.18), 0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        fontFamily: LB_FONTS.kr,
        position: 'relative',
      }}>
        {/* window bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 16px', borderBottom: `1px solid ${LB_COLORS.border}`,
          background: '#FAFAF8',
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#E2DDD8', '#E2DDD8', '#E2DDD8'].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{
            flex: 1, textAlign: 'center', fontSize: 11, color: LB_COLORS.hint,
            fontFamily: LB_FONTS.ui,
          }}>
            NAMU Korean · {activeTab.role === '선생님' ? '선생님 대시보드' : '학생 화면'} · {activeTab.subtitle}
          </div>
        </div>

        {/* body (fixed height) */}
        <div style={{ height: MOCK_BODY_HEIGHT, position: 'relative', background: LB_COLORS.card }}>
          {HERO_TABS.map((t) => (
            <div key={t.id} style={{
              position: 'absolute', inset: 0,
              opacity: t.id === active ? 1 : 0,
              transition: 'opacity 280ms ease',
              pointerEvents: t.id === active ? 'auto' : 'none',
            }}>
              {HERO_PANES[t.id]}
            </div>
          ))}
        </div>

        {/* progress bar */}
        <div style={{
          height: 2, background: LB_COLORS.border, position: 'relative',
        }}>
          <div
            key={active + (paused ? '-p' : '')}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              background: LB_COLORS.primary,
              animation: paused ? 'none' : `progress ${ROTATE_MS}ms linear forwards`,
            }} />
        </div>
        <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    </div>
  );
};

const LandingB = () => (
  <div style={{
    background: LB_COLORS.surface,
    color: LB_COLORS.text,
    fontFamily: LB_FONTS.kr,
    wordBreak: 'keep-all',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  }}>
    <TopNav accent={LB_COLORS.primary} />

    {/* ── HERO (split) ── */}
    <section style={{
      padding: '72px 56px 88px',
      maxWidth: 1280, margin: '0 auto', width: '100%',
      display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 64,
      alignItems: 'center',
    }}>
      {/* Left — copy + CTA */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 9999,
          background: LB_COLORS.primaryLight, color: LB_COLORS.primaryDark,
          fontSize: 12, fontWeight: 600, marginBottom: 24,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: LB_COLORS.primary,
          }} />
          한국어 선생님과 강사를 위해
        </div>

        <h1 style={{
          fontFamily: LB_FONTS.brand,
          fontWeight: 800,
          fontSize: 54,
          lineHeight: 1.15,
          letterSpacing: '-0.028em',
          color: LB_COLORS.text,
          marginBottom: 20,
        }}>
          퀴즈 만드는 데<br/>
          <span style={{ color: LB_COLORS.primary }}>30분 쓰지 마세요.</span>
        </h1>

        <p style={{
          fontSize: 17, lineHeight: 1.65, color: LB_COLORS.muted,
          marginBottom: 32, maxWidth: 460,
        }}>
          단어 목록을 붙여넣으면 빈칸·문장·말하기 퀴즈가 <strong style={{ color: LB_COLORS.text, fontWeight: 600 }}>30초 안에</strong> 만들어집니다. 클래스에 바로 배포하고 결과까지 한눈에.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <a href="#" style={{
            background: LB_COLORS.primary, color: '#fff',
            padding: '14px 22px', borderRadius: 10,
            fontWeight: 600, fontSize: 15, textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(30, 107, 71, 0.18)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            무료로 시작하기 <ArrowRightIcon size={14} />
          </a>
          <a href="#" style={{
            background: LB_COLORS.card, color: LB_COLORS.text,
            padding: '14px 22px', borderRadius: 10,
            fontWeight: 600, fontSize: 15, textDecoration: 'none',
            border: `1px solid ${LB_COLORS.border}`,
          }}>제품 더 알아보기</a>
        </div>

        {/* trust line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 12, color: LB_COLORS.hint, fontFamily: LB_FONTS.ui,
        }}>
          <span>✓ 회원가입만 하면 무료</span>
          <span>✓ 매월 일정량 퀴즈 생성</span>
          <span>✓ 학생 무제한</span>
        </div>

        <StudentEntry align="left" />
      </div>

      {/* Right — product mock */}
      <div>
        <HeroProductMock />
      </div>
    </section>

    {/* ── FEATURES (compact) ── */}
    <section style={{
      padding: '88px 56px 88px',
      maxWidth: 1200, margin: '0 auto', width: '100%',
    }}>
      <div style={{ marginBottom: 48, maxWidth: 640 }}>
        <div style={{
          fontSize: 11, color: LB_COLORS.primary, fontFamily: LB_FONTS.ui,
          fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 12,
        }}>FEATURES</div>
        <h2 style={{
          fontFamily: LB_FONTS.brand, fontSize: 36, fontWeight: 800,
          letterSpacing: '-0.02em', color: LB_COLORS.text, lineHeight: 1.25,
        }}>
          수업 준비에서 채점까지,<br/>한 도구로.
        </h2>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18,
      }}>
        {[
          {
            icon: <SparkleIcon />,
            title: 'AI가 문제를 만듭니다',
            desc: '단어만 입력하면 끝. 빈칸·문장·말하기 세 가지 유형을 동시에 생성합니다.',
            stat: '평균 3.4초',
          },
          {
            icon: <LayersIcon />,
            title: '한 곳에서 모든 유형',
            desc: '읽기·쓰기·말하기를 한 클래스 안에서. 학생 수준과 관심사에 맞춘 예문 톤.',
            stat: '3가지 퀴즈',
          },
          {
            icon: <UsersIcon />,
            title: '클래스와 진척, 자동 정리',
            desc: '학생은 회원가입 후 초대 코드로 클래스 가입. 누가 어디서 막혔는지, 약점 단어가 무엇인지 즉시 확인.',
            stat: '학생 무제한',
          },
        ].map((f, i) => (
          <div key={i} style={{
            background: LB_COLORS.card, border: `1px solid ${LB_COLORS.border}`,
            borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: LB_COLORS.primaryLight, color: LB_COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>{f.icon}</div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: LB_COLORS.text,
              marginBottom: 8, lineHeight: 1.35,
            }}>{f.title}</div>
            <div style={{
              fontSize: 14, color: LB_COLORS.muted, lineHeight: 1.65, flex: 1,
              marginBottom: 16,
            }}>{f.desc}</div>
            <div style={{
              fontSize: 12, fontFamily: LB_FONTS.mono, color: LB_COLORS.primary,
              fontWeight: 600, paddingTop: 12,
              borderTop: `1px dashed ${LB_COLORS.border}`,
            }}>{f.stat}</div>
          </div>
        ))}
      </div>
    </section>

    {/* ── CTA BAND ── */}
    <section style={{
      background: LB_COLORS.primary, color: '#fff',
      padding: '64px 56px 72px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: LB_FONTS.brand, fontWeight: 800, fontSize: 32,
        letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.3,
      }}>
        오늘 수업, 30초 만에 준비하세요
      </div>
      <div style={{
        fontSize: 15, color: 'rgba(255,255,255,0.78)', marginBottom: 28, lineHeight: 1.6,
      }}>
        구독 없이도 매월 일정량까지 무료. 필요할 때 더 쓰세요.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <a href="#" style={{
          background: '#fff', color: LB_COLORS.primary,
          padding: '13px 24px', borderRadius: 10,
          fontWeight: 700, fontSize: 15, textDecoration: 'none',
        }}>지금 무료 시작</a>
        <a href="#" style={{
          background: 'transparent', color: '#fff',
          padding: '13px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>요금 보기 →</a>
      </div>
    </section>

    <Footer accent={LB_COLORS.primary} />
  </div>
);

window.LandingB = LandingB;
