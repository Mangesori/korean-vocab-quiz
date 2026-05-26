// landing-a.jsx
// 시안 A — 구조 보존 리스킨
// 기존 Dalkom Korean 랜딩 구조 1:1 유지, 브랜드/색/카피만 나무로 갈아끼움.
// 가장 안전한 baseline. 보라색 → 대나무 그린, 카피 톤은 차분하고 따뜻하게.

const COLORS = {
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

const FONTS = {
  kr: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
  brand: "'Paperozi', 'Pretendard Variable', sans-serif",
  ui: "'Geist', system-ui, sans-serif",
  serif: "'DM Serif Display', serif",
};

const LandingA = () => (
  <div style={{
    background: COLORS.surface,
    color: COLORS.text,
    fontFamily: FONTS.kr,
    wordBreak: 'keep-all',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  }}>
    <TopNav accent={COLORS.primary} />

    {/* ── HERO ── */}
    <section style={{
      padding: '88px 56px 96px',
      textAlign: 'center',
      maxWidth: 880,
      margin: '0 auto',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', borderRadius: 9999,
        background: COLORS.primaryLight, color: COLORS.primaryDark,
        fontSize: 12, fontWeight: 600, marginBottom: 28,
        letterSpacing: '0.01em',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: COLORS.primary,
        }} />
        AI 한국어 어휘 퀴즈 플랫폼
      </div>

      <h1 style={{
        fontFamily: FONTS.brand,
        fontWeight: 800,
        fontSize: 56,
        lineHeight: 1.18,
        letterSpacing: '-0.025em',
        color: COLORS.text,
        marginBottom: 14,
      }}>
        단어 하나로,<br/>
        한국어 수업이 자랍니다
      </h1>

      <p style={{
        fontSize: 17, lineHeight: 1.7, color: COLORS.muted,
        maxWidth: 560, margin: '0 auto 36px',
      }}>
        선생님이 단어를 심으면, 빈칸·문장·말하기 퀴즈를<br/>
        AI가 자동으로 만들어드립니다.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <a href="#" style={{
          background: COLORS.primary, color: '#fff',
          padding: '14px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          boxShadow: '0 1px 2px rgba(30, 107, 71, 0.18)',
        }}>무료로 시작하기</a>
        <a href="#" style={{
          background: COLORS.card, color: COLORS.text,
          padding: '14px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          border: `1px solid ${COLORS.border}`,
        }}>제품 더 알아보기</a>
      </div>

      <div style={{
        marginTop: 18, fontSize: 12, color: COLORS.hint, fontFamily: FONTS.ui,
      }}>
        구독 없이도 매월 일정량 퀴즈 생성 가능
      </div>

      <StudentEntry />
    </section>

    {/* ── FEATURES (3-card) ── */}
    <section style={{
      padding: '40px 56px 96px',
      maxWidth: 1200, margin: '0 auto', width: '100%',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{
          fontFamily: FONTS.brand, fontWeight: 800, fontSize: 16,
          color: COLORS.primary, letterSpacing: '-0.01em', marginBottom: 4,
        }}>나무는,</div>
        <div style={{
          fontFamily: FONTS.brand, fontWeight: 800, fontSize: 30,
          letterSpacing: '-0.02em', color: COLORS.text,
        }}>무엇이 다를까요?</div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18,
      }}>
        {[
          {
            icon: <SparkleIcon />,
            title: '단어 한 줄 → 완성된 퀴즈',
            desc: '단어 목록만 붙여넣으면 빈칸 채우기, 문장 만들기, 말하기 연습 문제를 AI가 한 번에 생성합니다.',
          },
          {
            icon: <LayersIcon />,
            title: '세 가지 퀴즈, 한 곳에서',
            desc: '읽기·쓰기·말하기를 한 클래스에서 흐름 있게. 학생 수준에 맞춰 난이도와 예문 톤까지 조정됩니다.',
          },
          {
            icon: <UsersIcon />,
            title: '클래스와 진척, 한눈에',
            desc: '학생 가입은 초대 코드 한 줄. 누가 어디서 막혔는지, 어떤 단어가 약한지 결과 화면에서 바로 확인.',
          },
        ].map((f, i) => (
          <div key={i} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 14, padding: 28,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: COLORS.primaryLight, color: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>{f.icon}</div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: COLORS.text,
              marginBottom: 10, lineHeight: 1.35,
            }}>{f.title}</div>
            <div style={{
              fontSize: 14, color: COLORS.muted, lineHeight: 1.65,
            }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>

    {/* ── 2-COL (선생님 / 학생) ── */}
    <section style={{
      padding: '48px 56px 96px',
      maxWidth: 1200, margin: '0 auto', width: '100%',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
      }}>
        {/* Teacher card */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 32,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', borderRadius: 9999,
            background: COLORS.primaryLight, color: COLORS.primary,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            fontFamily: FONTS.ui, marginBottom: 14, textTransform: 'uppercase',
          }}>For Teachers</div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: COLORS.text,
            marginBottom: 6, letterSpacing: '-0.01em',
          }}>선생님을 위해</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
            수업 준비 30분을 30초로. 학생 관리까지 한 화면에서.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '단어 목록으로 퀴즈 자동 생성',
              '학생 수준 맞춤 예문 자동 생성',
              '클래스 생성 및 학생 초대 관리',
              '학생에게 퀴즈 배포·결과 확인',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: COLORS.text }}>
                <CheckIcon color={COLORS.primary} />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Student card */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 32,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', borderRadius: 9999,
            background: '#DCFCE7', color: '#15803D',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            fontFamily: FONTS.ui, marginBottom: 14, textTransform: 'uppercase',
          }}>For Students</div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: COLORS.text,
            marginBottom: 6, letterSpacing: '-0.01em',
          }}>학생을 위해</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
            한 화면 한 문제. 조용한 집중.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '회원가입 후 초대 코드로 클래스 가입',
              '모국어 번역 힌트 (11개 언어)',
              '학습 기록 자동 저장·오답 노트',
              '한 화면 한 문제, 게임 UI 없음',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: COLORS.text }}>
                <CheckIcon color="#2D7D52" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* ── CTA BAND ── */}
    <section style={{
      background: COLORS.primary, color: '#fff',
      padding: '64px 56px 72px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONTS.brand, fontWeight: 800, fontSize: 30,
        letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.3,
      }}>
        지금 한 단어를 심어보세요
      </div>
      <div style={{
        fontSize: 15, color: 'rgba(255,255,255,0.78)', marginBottom: 28, lineHeight: 1.6,
      }}>
        구독 없이도 무료로 시작하고, 필요할 때 더 사용하세요.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <a href="#" style={{
          background: '#fff', color: COLORS.primary,
          padding: '13px 24px', borderRadius: 10,
          fontWeight: 700, fontSize: 15, textDecoration: 'none',
        }}>무료로 시작하기</a>
        <a href="#" style={{
          background: 'transparent', color: '#fff',
          padding: '13px 24px', borderRadius: 10,
          fontWeight: 600, fontSize: 15, textDecoration: 'none',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>요금 보기 →</a>
      </div>
    </section>

    <Footer accent={COLORS.primary} />
  </div>
);

window.LandingA = LandingA;
