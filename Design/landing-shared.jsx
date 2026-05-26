// landing-shared.jsx
// 공용 컴포넌트: 나무 아이콘 (옵션 L · 사용자 스케치 기반), 공통 UI

// 공식 로고 — 잎 + 내부 나무 (NAMU Korean v4 기반)
// variant: 'color' (기본, 라이트그린 잎 + 다크그린 나무)
//          'mono-dark' (단색 다크), 'mono-light' (단색 화이트, 다크 배경용)
const NAMU_LEAF = '#8FC85A';
const NAMU_TREE = '#155237';

const NamuIcon = ({ size = 24, variant = 'color' }) => {
  const leafFill = variant === 'mono-light' ? '#FFFFFF'
    : variant === 'mono-dark' ? NAMU_TREE
    : NAMU_LEAF;
  const treeFill = variant === 'mono-light' ? '#FFFFFF'
    : variant === 'mono-dark' ? NAMU_TREE
    : NAMU_TREE;
  const treeOpacity = variant === 'mono-light' ? 0.32
    : variant === 'mono-dark' ? 1
    : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {/* 잎 (leaf body) — teardrop */}
      <path
        d="M16 3 Q25.5 7 24 16.5 Q22.6 25 16 26.5 Q9.4 25 8 16.5 Q6.5 7 16 3 Z"
        fill={leafFill}
      />
      {/* 나무 (trunk + 3 branches) */}
      <g fill={treeFill} opacity={treeOpacity}>
        {/* trunk */}
        <rect x="15.25" y="9" width="1.5" height="19" rx="0.7" />
        {/* upper-right branch */}
        <rect x="16" y="12.8" width="0.5" height="3.6" rx="0.25"
          transform="rotate(-38 16 12.8)" />
        <rect x="15.6" y="12.5" width="1.3" height="3.9" rx="0.55"
          transform="rotate(-38 16 12.5)" />
        {/* mid-left branch */}
        <rect x="15.6" y="15.6" width="1.3" height="4.6" rx="0.55"
          transform="rotate(38 16 15.6)" />
        {/* lower-right branch */}
        <rect x="15.6" y="18.6" width="1.3" height="3.6" rx="0.55"
          transform="rotate(-38 16 18.6)" />
      </g>
    </svg>
  );
};

// Sparkle (AI 자동 생성)
const SparkleIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z" />
  </svg>
);

// Layers/quiz types
const LayersIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </svg>
);

// Users (class management)
const UsersIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const CheckIcon = ({ size = 16, color = '#1E6B47' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const MicIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const PenIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const BlankIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <line x1="7" y1="12" x2="11" y2="12" />
    <line x1="13" y1="12" x2="17" y2="12" strokeDasharray="2 2" />
  </svg>
);

// Top nav — 공통, 시안마다 약간 다른 variant 가능
const TopNav = ({ accent = '#1E6B47', dense = false }) => (
  <nav style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: dense ? '18px 56px' : '22px 56px',
    borderBottom: '1px solid rgba(226, 221, 216, 0.6)',
    background: 'rgba(248, 245, 240, 0.85)',
    backdropFilter: 'blur(8px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <NamuIcon size={28} />
      <span style={{
        fontFamily: "'Paperozi', 'Pretendard Variable', sans-serif",
        fontWeight: 800, fontSize: 22, letterSpacing: '0.01em', color: accent, lineHeight: 1,
      }}>NAMU<span style={{ fontSize: 13, fontWeight: 700, opacity: 0.55, marginLeft: 6, letterSpacing: '0.08em' }}>Korean</span></span>
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 32,
      fontFamily: "'Pretendard Variable', sans-serif",
      fontSize: 14, color: '#1A1714', fontWeight: 500,
    }}>
      <a href="#" style={{ color: '#1A1714', textDecoration: 'none' }}>기능</a>
      <a href="#" style={{ color: '#1A1714', textDecoration: 'none' }}>요금</a>
      <a href="#" style={{ color: '#1A1714', textDecoration: 'none' }}>도움말</a>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <a href="#" style={{
        color: '#6B6460', textDecoration: 'none', fontSize: 14, fontWeight: 500,
        fontFamily: "'Pretendard Variable', sans-serif",
      }}>로그인</a>
      <a href="#" style={{
        background: accent, color: '#fff', padding: '9px 16px', borderRadius: 8,
        fontSize: 14, fontWeight: 600, textDecoration: 'none',
        fontFamily: "'Pretendard Variable', sans-serif",
      }}>무료로 시작</a>
    </div>
  </nav>
);

// 학생 진입 (회원가입 환영) — 모든 시안 hero CTA 아래에 배치
const StudentEntry = ({ align = 'center' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    justifyContent: align === 'center' ? 'center' : 'flex-start',
    marginTop: 24, fontSize: 13, color: '#6B6460',
    fontFamily: "'Pretendard Variable', sans-serif",
  }}>
    <span>학생이신가요?</span>
    <a href="#" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      color: '#1E6B47', fontWeight: 600, textDecoration: 'none',
    }}>
      학생으로 가입하기 <ArrowRightIcon size={13} />
    </a>
  </div>
);

// Footer — 모든 시안 동일
const Footer = ({ accent = '#1E6B47' }) => (
  <footer style={{
    borderTop: '1px solid #E2DDD8', padding: '40px 56px 32px',
    background: '#F8F5F0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    fontFamily: "'Pretendard Variable', sans-serif",
  }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <NamuIcon size={26} />
        <span style={{
          fontFamily: "'Paperozi', 'Pretendard Variable', sans-serif",
          fontWeight: 800, fontSize: 19, letterSpacing: '0.01em', color: accent, lineHeight: 1,
        }}>NAMU<span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, marginLeft: 6, letterSpacing: '0.08em' }}>Korean</span></span>
      </div>
      <div style={{ fontSize: 12, color: '#9E9894', lineHeight: 1.6 }}>
        AI 한국어 어휘 퀴즈 플랫폼<br/>
        선생님과 교육 기관을 위한 도구
      </div>
    </div>
    <div style={{
      display: 'flex', gap: 56, fontSize: 13, color: '#6B6460',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9E9894', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>제품</div>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>기능</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>요금</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>업데이트</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>도입 사례</a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9E9894', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>리소스</div>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>도움말 센터</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>블로그</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>커뮤니티</a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9E9894', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>회사</div>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>소개</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>문의</a>
        <a href="#" style={{ color: '#6B6460', textDecoration: 'none' }}>이용약관</a>
      </div>
    </div>
  </footer>
);

Object.assign(window, {
  NamuIcon, SparkleIcon, LayersIcon, UsersIcon,
  CheckIcon, ArrowRightIcon, MicIcon, PenIcon, BlankIcon,
  TopNav, StudentEntry, Footer,
});
