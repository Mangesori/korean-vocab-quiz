# Design System — 달콤한 한국어

## Product Context

- **What this is:** AI 기반 한국어 어휘 퀴즈 플랫폼. 선생님이 단어를 입력하면 AI가 빈칸 채우기, 문장 만들기, 말하기 연습 문제를 자동 생성. 학생은 초대 코드로 클래스에 가입 후 퀴즈를 풀 수 있음.
- **Who it's for:** 한국어 선생님 (퀴즈 생성/관리) + 학생 (퀴즈 수행)
- **Space/industry:** EdTech, 언어 학습, 한국어 교육
- **Project type:** Web app (dashboard + quiz experience)

## Memorable Thing

> "초 만에 완성되는 한국어 퀴즈"

속도와 효율이 핵심 가치. 선생님은 바쁘다. 디자인은 그 바쁨을 덜어줘야 한다.

## Aesthetic Direction

- **Direction:** Intentional Precision (의도적 정밀함)
- **Decoration level:** minimal — 타이포그래피와 색상이 모든 일을 한다
- **Mood:** 빠른 도구이지만 차갑지 않다. Linear의 효율감 + 한국 문방구의 온기. 군더더기 없이 핵심만 있지만 한지(韓紙) 텍스처를 연상시키는 따뜻함이 깔려 있다.
- **Reference sites:** Wordwall (positioning similarity), Linear (dashboard energy)

## Typography

- **한국어 전체 (한글 본문/UI):** Pretendard Variable — 가장 잘 설계된 한국어 web font. 굵기 9단계, 한글 획 세밀. CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
- **한국어 Display (브랜드/랜딩):** Paperozi — 기존 사용 중인 브랜드 폰트. 홈, 랜딩, 마케팅 레벨 display에만 유지. 앱 내 UI에는 사용하지 않음.
- **영문 Display/Hero:** DM Serif Display — 선생님 대시보드 큰 타이틀, 마케팅 헤더에만 사용. Google Fonts.
- **영문 Body/UI:** Geist — 점수, 타이머, UI 라벨, 영문 본문. Vercel Fonts / Google Fonts.
- **데이터/점수/숫자:** Geist Mono (tabular-nums) — 점수판, 타이머, 통계 수치. 고정폭으로 정렬 유지.
- **Scale:**
  - xs: 11px (캡션, 라벨)
  - sm: 12–13px (보조 텍스트, 힌트)
  - base: 14–15px (본문)
  - md: 16–18px (카드 타이틀, 문제 텍스트)
  - lg: 20–24px (섹션 타이틀)
  - xl: 28–36px (대시보드 히어로)
  - 2xl: 42px+ (마케팅 display)

## Color

- **Approach:** restrained — 하나의 브랜드 컬러가 강하게. 나머지는 따뜻한 중립.
- **Primary:** `#1E6B47` (대나무 그린) — 신뢰, 성숙함, 자연스러움. 보라/파란색 EdTech 카테고리에서 의도적으로 이탈.
- **Primary Dark:** `#155237` — hover, active 상태, 아이콘 강조
- **Primary Light:** `#E8F5EE` — 배지 배경, subtle highlight, 포커스 링

- **Surface:** `#F8F5F0` (한지 오프화이트) — 앱 전체 배경. 순백이 아닌 따뜻한 톤.
- **Card:** `#FFFFFF` — 카드, 모달, 입력 필드 배경
- **Border:** `#E2DDD8` — 구분선, 테두리. 따뜻한 회색.

- **Text Primary:** `#1A1714` (잉크) — 본문 텍스트. 순흑이 아닌 따뜻한 잉크색.
- **Text Muted:** `#6B6460` — 보조 텍스트, 플레이스홀더
- **Text Hint:** `#9E9894` — 비활성, 힌트, 캡션

- **Semantic:**
  - success: `#2D7D52` — 정답, 완료
  - warning: `#D97706` — 주의
  - error: `#C13B2E` — 오답, 경고, 삭제
  - info: `#1D4ED8` — 안내

- **Dark mode:**
  - surface: `#141210`
  - card: `#1F1C1A`
  - border: `#2E2A27`
  - text: `#F2EDE8`
  - (Primary, success, error 등은 동일 값 유지, 포화도 10–15% 감소 고려)

- **CEFR Level badges:**
  - A1: `background #DCFCE7, color #15803D`
  - A2: `background #CFFAFE, color #0E7490`
  - B1: `background #DBEAFE, color #1D4ED8`
  - B2: `background #EDE9FE, color #6D28D9`
  - C1: `background #FCE7F3, color #9D174D`
  - C2: `background #FEF9C3, color #854D0E`

## Spacing

- **Base unit:** 8px
- **Density:** comfortable
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout

- **Approach:** grid-disciplined (선생님 대시보드) + focused single-column (학생 퀴즈)
- **선생님 대시보드 원칙:** 단어 입력 필드가 화면 중앙을 지배한다. 나머지 옵션(난이도, 타이머, 퀴즈 유형)은 서포트 역할.
- **학생 퀴즈 원칙:** 한 번에 하나의 문제. 조용하고 집중된 화면. 게임 UI 없음. 점수/결과는 세트 완료 후.
- **Max content width:** 1120px (대시보드), 640px (학생 퀴즈)
- **Grid:** 12-column, 24px gap
- **Border radius:**
  - sm: 4px (인라인 요소, 작은 배지)
  - md: 8px (버튼, 입력 필드, 작은 카드)
  - lg: 12px (큰 카드, 모달, 섹션)
  - full: 9999px (pill 배지, 아바타)

## Motion

- **Approach:** minimal-functional — 상태 전환만. 화려한 애니메이션 없음. 속도감은 즉각적인 반응으로 표현한다.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 80ms (버튼 hover, 색상 전환)
  - short: 150ms (드롭다운 열기, 포커스 링)
  - medium: 250ms (모달 등장, 슬라이드)
  - long: 400ms (페이지 전환)

## Quiz-Specific Guidelines

### 빈칸 채우기 (Fill in the Blank)
- 상단 보기(word bank): 현재 세트의 단어를 pill 배지로 나열. 이미 사용한 단어는 취소선 + opacity 감소.
- 문제 목록: 인라인 입력 필드. 활성 문제 행은 `primary-light` 배경으로 하이라이트.
- 세트 네비게이션: 하단 "이전 세트 / 다음 세트". 모든 답 미입력 시 다음 세트 비활성화.

### 문장 만들기 (Sentence Making)
- 한 번에 하나의 단어. 단어를 `primary-light` 박스로 강조.
- 텍스트에어리어 포커스 시 `primary` 테두리 + 포커스 링.
- AI 채점 결과: success 배경 박스, 문법/어휘/자연스러움 3개 태그.

### 말하기 연습 (Speaking Practice)
- 녹음 중: `error` 색 (#C13B2E) — 빨간 펄스 애니메이션 + 파형. 녹음 = 행동 = 빨간색.
- 채점 결과: 전체 점수 (큰 mono 숫자) + 세부 4개 격자 + 단어별 색상 코딩 (녹색/노랑/빨강 점수 기준).

## CSS Variables Mapping (Tailwind / shadcn)

```css
:root {
  --background:          0 0% 100%;          /* card */
  --foreground:          25 8% 10%;          /* #1A1714 */
  --primary:             152 55% 27%;        /* #1E6B47 */
  --primary-foreground:  0 0% 100%;
  --secondary:           40 15% 97%;         /* surface #F8F5F0 */
  --secondary-foreground: 25 8% 10%;
  --muted:               40 15% 97%;
  --muted-foreground:    22 7% 40%;          /* #6B6460 */
  --accent:              152 55% 95%;        /* primary-light #E8F5EE */
  --accent-foreground:   152 55% 20%;        /* primary-dark */
  --border:              25 12% 88%;         /* #E2DDD8 */
  --input:               25 12% 88%;
  --ring:                152 55% 27%;        /* primary */
  --radius:              0.5rem;             /* 8px = md */
}
```

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-23 | Primary 색상: 대나무 그린 #1E6B47 | 보라/파란색 EdTech 카테고리에서 의도적으로 이탈. 신뢰, 성숙함. |
| 2026-04-23 | 한국어 폰트: Pretendard (UI/본문) + Paperozi (display 유지) | Pretendard가 한국어 가독성 최적. Paperozi는 브랜드 정체성 유지. |
| 2026-04-23 | 영문 헤더: DM Serif Display | 정밀함과 따뜻함의 대비. 큰 타이틀에만 사용. |
| 2026-04-23 | 영문 UI: Geist + Geist Mono | 숫자 정렬, UI 텍스트. Tabular-nums 지원. |
| 2026-04-23 | 학생 퀴즈: 게임 UI 없음 | 집중 모드. 점수는 세트 완료 후. 진지한 학습 도구 인상. |
| 2026-04-23 | Surface: #F8F5F0 (한지 오프화이트) | 순백이 아닌 따뜻함. 장시간 화면 피로 감소. |
| 2026-04-23 | Initial design system created | /design-consultation via gstack |
