// landing-c.jsx
// 시안 C — 메타포 시각화
// 히어로 중앙에 "단어 → 가지 3개(빈칸/문장/말하기)" 다이어그램이 주인공.
// 정체성 가장 강함. 카피는 "한 단어를 심으면, 한 그루의 수업이 자랍니다"

const LC_COLORS = {
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

const LC_FONTS = {
  kr: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
  brand: "'Paperozi', 'Pretendard Variable', sans-serif",
  ui: "'Geist', system-ui, sans-serif",
  mono: "'Geist Mono', monospace",
  serif: "'DM Serif Display', serif",
};

// 메타포 다이어그램 — 단어(루트) → 줄기 → 3 가지 퀴즈
const GrowthDiagram = () => (
  <div style={{
    position: 'relative',
    width: '100%',
    maxWidth: 760,
    height: 480,
    margin: '0 auto',
    fontFamily: LC_FONTS.kr,
  }}>
    {/* SVG 가지 라인 */}
    <svg
      viewBox="0 0 760 480"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={LC_COLORS.primary} stopOpacity="0.18" />
          <stop offset="1" stopColor={LC_COLORS.primary} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="branchGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={LC_COLORS.primary} stopOpacity="0.7" />
          <stop offset="1" stopColor={LC_COLORS.primary} stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* trunk */}
      <path d="M 380 410 C 380 320, 380 280, 380 220"
        stroke="url(#trunkGrad)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* 3 branches — fan out */}
      <path d="M 380 220 C 280 200, 200 170, 130 120"
        stroke="url(#branchGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 380 220 C 380 180, 380 150, 380 95"
        stroke="url(#branchGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 380 220 C 480 200, 560 170, 630 120"
        stroke="url(#branchGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* small leaves along trunk */}
      <circle cx="370" cy="350" r="3" fill={LC_COLORS.primary} opacity="0.35" />
      <circle cx="390" cy="310" r="2.5" fill={LC_COLORS.primary} opacity="0.4" />
      <circle cx="372" cy="270" r="3" fill={LC_COLORS.primary} opacity="0.5" />
    </svg>

    {/* 뿌리 카드 (단어 입력) */}
    <div style={{
      position: 'absolute',
      left: '50%', bottom: 12,
      transform: 'translateX(-50%)',
      background: LC_COLORS.card,
      border: `1.5px solid ${LC_COLORS.primary}`,
      boxShadow: `0 0 0 6px ${LC_COLORS.primaryLight}`,
      borderRadius: 12,
      padding: '14px 20px',
      minWidth: 280,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10, color: LC_COLORS.primary, fontFamily: LC_FONTS.ui,
        fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 6,
      }}>선생님이 심는 단어</div>
      <div style={{
        fontFamily: LC_FONTS.brand, fontSize: 22, fontWeight: 800,
        color: LC_COLORS.text, letterSpacing: '-0.01em',
      }}>
        성장 · 자라다 · 가지 · 뿌리
      </div>
    </div>

    {/* 3개 가지 = 3개 퀴즈 카드 */}
    {[
      {
        x: '17%', y: 36,
        icon: <BlankIcon />,
        type: '빈칸 채우기',
        example: '봄에 새 ___이 돋아났다.',
      },
      {
        x: '50%', y: 12,
        icon: <PenIcon />,
        type: '문장 만들기',
        example: '"성장"으로 문장 만들기',
      },
      {
        x: '83%', y: 36,
        icon: <MicIcon />,
        type: '말하기 연습',
        example: '발음 + 자연스러움',
      },
    ].map((b, i) => (
      <div key={i} style={{
        position: 'absolute',
        left: b.x, top: b.y,
        transform: 'translateX(-50%)',
        background: LC_COLORS.card,
        border: `1px solid ${LC_COLORS.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 180, maxWidth: 200,
        boxShadow: '0 8px 24px -8px rgba(30,107,71,0.18)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: LC_COLORS.primaryLight, color: LC_COLORS.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 8px',
        }}>{b.icon}</div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: LC_COLORS.text,
          marginBottom: 4, letterSpacing: '-0.01em',
        }}>{b.type}</div>
        <div style={{
          fontSize: 11, color: LC_COLORS.muted, fontFamily: LC_FONTS.mono,
          lineHeight: 1.5,
        }}>{b.example}</div>
      </div>
    ))}

    {/* AI 라벨 (가지 분기점 표시) */}
    <div style={{
      position: 'absolute',
      left: '50%', top: 218,
      transform: 'translate(-50%, -50%)',
      background: LC_COLORS.surface,
      border: `1px solid ${LC_COLORS.border}`,
      borderRadius: 9999,
      padding: '5px 11px',
      fontSize: 10, fontWeight: 700, fontFamily: LC_FONTS.ui,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: LC_COLORS.muted,
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <SparkleIcon size={11} /> AI · 3.4s
    </div>
  </div>
);

const LandingC = () => (
  <div style={{
    background: LC_COLORS.surface,
    color: LC_COLORS.text,
    fontFamily: LC_FONTS.kr,
    wordBreak: 'keep-all',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  }}>
    <TopNav accent={LC_COLORS.primary} />

    {/* ── HERO (centered + diagram) ── */}
    <section style={{
      padding: '72px 56px 24px',
      maxWidth: 1100, margin: '0 auto', width: '100%',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', borderRadius: 9999,
        background: LC_COLORS.primaryLight, color: LC_COLORS.primaryDark,
        fontSize: 12, fontWeight: 600, marginBottom: 28,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: LC_COLORS.primary,
        }} />
        AI 한국어 어휘 퀴즈 플랫폼
      </div>

      <h1 style={{
        fontFamily: LC_FONTS.brand,
        fontWeight: 800,
        fontSize: 60,
        lineHeight: 1.15,
        letterSpacing: '-0.03em',
        color: LC_COLORS.text,
        marginBottom: 18,
      }}>
        한 단어를 심으면,<br/>
        <span style={{ color: LC_COLORS.primary }}>한 그루의 수업이 자랍니다</span>
      </h1>

      <p style={{
        fontSize: 17, lineHeight: 1.65, color: LC_COLORS.muted,
        maxWidth: 540, margin: '0 auto 36px',
      }}>
        한국어 선생님과 강사를 위한 AI 어휘 퀴즈 플랫폼,<br/>
        <strong style={{ color: LC_COLORS.text, fontFamily: LC_FONTS.brand, fontWeight: 800 }}>나무</strong>.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <a href="#" style={{
          background: LC_COLORS.primary, color: '#fff',
          padding: '14px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          boxShadow: '0 1px 2px rgba(30, 107, 71, 0.18)',
        }}>선생님으로 무료 시작</a>
        <a href="#" style={{
          background: LC_COLORS.card, color: LC_COLORS.text,
          padding: '14px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          border: `1px solid ${LC_COLORS.border}`,
        }}>제품 더 알아보기</a>
      </div>

      <StudentEntry />
    </section>

    {/* ── DIAGRAM ── */}
    <section style={{
      padding: '40px 56px 80px',
      maxWidth: 1100, margin: '0 auto', width: '100%',
    }}>
      <GrowthDiagram />
      <div style={{
        marginTop: 12, textAlign: 'center',
        fontSize: 12, color: LC_COLORS.hint, fontFamily: LC_FONTS.ui,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        단어 한 줄 → 세 가지 퀴즈 → 한 클래스로 배포
      </div>
    </section>

    {/* ── HOW IT WORKS (3 step horizontal) ── */}
    <section style={{
      padding: '72px 56px 88px',
      background: '#FCFAF6',
      borderTop: `1px solid ${LC_COLORS.border}`,
      borderBottom: `1px solid ${LC_COLORS.border}`,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontSize: 11, color: LC_COLORS.primary, fontFamily: LC_FONTS.ui,
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 12,
          }}>HOW IT WORKS</div>
          <h2 style={{
            fontFamily: LC_FONTS.brand, fontSize: 32, fontWeight: 800,
            letterSpacing: '-0.02em', color: LC_COLORS.text, lineHeight: 1.3,
          }}>
            세 단계, 30초.
          </h2>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          position: 'relative',
        }}>
          {[
            {
              n: '01',
              title: '단어를 심으세요',
              desc: '오늘 가르치고 싶은 단어 5~20개를 입력. CSV·교과서 단원도 OK.',
            },
            {
              n: '02',
              title: 'AI가 자라게 합니다',
              desc: '빈칸·문장·말하기 문제가 학생 수준에 맞춰 자동 생성됩니다.',
            },
            {
              n: '03',
              title: '클래스에 배포하세요',
              desc: '초대 코드 한 줄로 학생이 가입. 결과·진척은 대시보드에서.',
            },
          ].map((s, i) => (
            <div key={i} style={{
              background: LC_COLORS.card, border: `1px solid ${LC_COLORS.border}`,
              borderRadius: 14, padding: '28px 24px',
            }}>
              <div style={{
                fontFamily: LC_FONTS.mono, fontSize: 12, color: LC_COLORS.primary,
                fontWeight: 600, letterSpacing: '0.08em', marginBottom: 12,
              }}>{s.n}</div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: LC_COLORS.text,
                marginBottom: 8, letterSpacing: '-0.01em',
              }}>{s.title}</div>
              <div style={{
                fontSize: 14, color: LC_COLORS.muted, lineHeight: 1.65,
              }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── 2-COL (선생님 / 학생) ── */}
    <section style={{
      padding: '88px 56px 88px',
      maxWidth: 1200, margin: '0 auto', width: '100%',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
      }}>
        <div style={{
          background: LC_COLORS.primaryLight,
          borderRadius: 16, padding: 32,
          border: `1px solid rgba(30,107,71,0.15)`,
        }}>
          <div style={{
            fontFamily: LC_FONTS.brand, fontSize: 22, fontWeight: 800,
            color: LC_COLORS.primaryDark, marginBottom: 6, letterSpacing: '-0.01em',
          }}>선생님을 위한 가지</div>
          <div style={{
            fontSize: 13, color: LC_COLORS.primary, marginBottom: 24,
            lineHeight: 1.6, opacity: 0.85,
          }}>
            수업 준비 30분을 30초로.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '단어 목록으로 퀴즈 자동 생성',
              '학생 수준 맞춤 예문 자동 생성',
              '클래스 생성 및 학생 초대 관리',
              '학생에게 퀴즈 배포·결과 확인',
            ].map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 14, color: LC_COLORS.primaryDark, fontWeight: 500,
              }}>
                <CheckIcon color={LC_COLORS.primaryDark} />
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: LC_COLORS.card, border: `1px solid ${LC_COLORS.border}`,
          borderRadius: 16, padding: 32,
        }}>
          <div style={{
            fontFamily: LC_FONTS.brand, fontSize: 22, fontWeight: 800,
            color: LC_COLORS.text, marginBottom: 6, letterSpacing: '-0.01em',
          }}>학생을 위한 잎</div>
          <div style={{
            fontSize: 13, color: LC_COLORS.muted, marginBottom: 24, lineHeight: 1.6,
          }}>
            한 화면 한 문제. 조용한 집중.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '초대 코드로 즉시 클래스 가입',
              '모국어 번역 힌트 (11개 언어)',
              '학습 기록 자동 저장·오답 노트',
              '한 화면 한 문제, 게임 UI 없음',
            ].map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 14, color: LC_COLORS.text,
              }}>
                <CheckIcon color={LC_COLORS.primary} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* ── CTA BAND ── */}
    <section style={{
      background: LC_COLORS.primary, color: '#fff',
      padding: '72px 56px 80px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* subtle background tree silhouette */}
      <div style={{
        position: 'absolute', right: -40, top: -40, opacity: 0.08,
        pointerEvents: 'none',
      }}>
        <NamuIcon size={320} variant="mono-light" />
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: LC_FONTS.brand, fontWeight: 800, fontSize: 36,
          letterSpacing: '-0.025em', marginBottom: 14, lineHeight: 1.25,
        }}>
          오늘, 첫 단어를 심어보세요
        </div>
        <div style={{
          fontSize: 15, color: 'rgba(255,255,255,0.78)', marginBottom: 32, lineHeight: 1.6,
        }}>
          구독 없이도 무료로 시작. 더 많이 쓰려면 유료 플랜으로.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <a href="#" style={{
            background: '#fff', color: LC_COLORS.primary,
            padding: '14px 26px', borderRadius: 10,
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}>선생님으로 무료 시작</a>
          <a href="#" style={{
            background: 'transparent', color: '#fff',
            padding: '14px 26px', borderRadius: 10,
            fontWeight: 600, fontSize: 15, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>요금 보기 →</a>
        </div>
      </div>
    </section>

    <Footer accent={LC_COLORS.primary} />
  </div>
);

window.LandingC = LandingC;
