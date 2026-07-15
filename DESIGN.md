# Design System — 나무 (Namu) Korean

## Product Context

- **What this is:** 나무 (Namu) — AI 기반 한국어 어휘 퀴즈 플랫폼. 선생님이 단어를 입력하면 AI가 빈칸 채우기, 문장 만들기, 말하기 연습 문제를 자동 생성. 학생은 초대 코드로 클래스에 가입 후 퀴즈를 풀 수 있음.
- **Who it's for:** 한국어 선생님 (퀴즈 생성/관리) + 학생 (퀴즈 수행)
- **Space/industry:** EdTech, 언어 학습, 한국어 교육
- **Project type:** Web app (dashboard + quiz experience)

## Memorable Thing

> "10초 만에 완성되는 한국어 퀴즈"

속도와 효율이 핵심 가치. 선생님은 바쁘다. 디자인은 그 바쁨을 덜어줘야 한다.

## Aesthetic Direction

- **Direction:** Intentional Precision (의도적 정밀함)
- **Decoration level:** minimal — 타이포그래피와 색상이 모든 일을 한다
- **Mood:** 빠른 도구이지만 차갑지 않다. Linear의 효율감 + 한국 문방구의 온기. 군더더기 없이 핵심만 있지만 한지(韓紙) 텍스처를 연상시키는 따뜻함이 깔려 있다.
- **Reference sites:** Wordwall (positioning similarity), Linear (dashboard energy)

## Typography

- **전체 (한글·영문·숫자 모두):** Pretendard Variable — 단일 폰트로 통일. 가장 잘 설계된 한국어 web font, 굵기 9단계(100–900), 라틴·숫자 글리프도 깔끔(슬래시 없는 0). CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
- **제거됨 (2026-06):** Paperozi/Paperlogy, DM Serif Display, Geist, Geist Mono — 모두 제거하고 Pretendard 하나로 통일. (Geist Mono의 슬래시 제로 비선호 + 폰트 수 최소화)
- **숫자 정렬:** 별도 mono 없이 Pretendard + `font-feature-settings: "tnum" 1`(고정폭 숫자)로 표·가격 정렬 유지.
- **Font Utility Classes:** `.font-brand` / `.font-ui` / `.font-mono` 는 **의미용 별칭으로만 유지** — 전부 Pretendard로 렌더(`.font-mono`만 tabular-nums 추가). 신규 코드는 가급적 기본(Pretendard)을 쓰고 이 별칭에 의존하지 말 것.

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
- **Leaf Accent:** `#8FC85A` (나뭇잎 그린) — **나무 로고 리프 아이콘 전용**. 일반 UI에는 사용하지 않음.

- **Surface:** `#F8F5F0` (한지 오프화이트) — 앱 전체 배경. 순백이 아닌 따뜻한 톤.
- **Card:** `#FFFFFF` — 카드, 모달 배경
- **Input fill (정답 입력칸):** Tailwind `slate-50`(`#F8FAFC`) — 카드의 흰색과 구분되는 회색 톤. 학생 퀴즈 화면(빈칸 채우기/뜻 보고 단어 쓰기/문장 만들기)의 프롬프트 안내 박스도 이미 `slate-50`을 쓰고 있어 톤이 이어짐. 카드/모달 자체는 흰색 유지.
- **Border:** `#E2DDD8` — 구분선, 테두리. 따뜻한 회색.
- **Word Bank (보기):** `#F1ECE4` (베이지), 테두리 `#D3CCC4` — 빈칸 채우기 "보기"(단어 은행) 박스 전용.

- **Text Primary:** `#1A1714` (잉크) — 본문 텍스트. 순흑이 아닌 따뜻한 잉크색.
- **Text Muted:** `#6B6460` — 보조 텍스트, 플레이스홀더
- **Text Hint:** `#9E9894` — 비활성, 힌트, 캡션

- **Semantic:**
  - success: `#2D7D52` — 정답, 완료
  - warning: `#D97706` — 주의
  - error: `#C13B2E` — 오답, 경고, 삭제
  - info: `#1D4ED8` — 안내

- **퀴즈 유형 의미색:** 6개 BaseStage 유형 구분 전용 고정색. 태그/아이콘/통계 범례에만 사용, 일반 UI 강조엔 금지. 토큰 정의는 `src/index.css`(`:root` + `.dark`), Tailwind 등록은 `tailwind.config.ts`의 `type-*` (예: `text-type-matchup`). 토큰명은 `src/types/quiz.ts`의 `BaseStage` 키와 1:1 대응.
  - 빈칸 채우기: #1E6B47 (primary와 동일, `--type-fill-blank`)
  - 짝 맞추기: #1D4ED8 (파랑, `--type-matchup`)
  - 단어 받아쓰기: #0E7490 (틸, `--type-type-answer`)
  - 문장 순서 맞추기: #854D0E (브라운, `--type-word-magnet`)
  - 문장 만들기: #6D28D9 (보라, `--type-sentence-making`)
  - 말하기 연습: #C13B2E (error 레드와 동일, `--type-recording`)

- **Dark mode:**
  - surface: `#141210`
  - card: `#1F1C1A`
  - border: `#2E2A27`
  - text: `#F2EDE8`
  - (Primary, success, error 등은 동일 값 유지, 포화도 10–15% 감소 고려)

- **CEFR Level badges** (Tailwind 클래스 기준, `level-badge.tsx` + `src/index.css`):
  - A1: `bg-emerald-100 text-emerald-700` (dark: `bg-emerald-900 text-emerald-300`) — 초급
  - A2: `bg-teal-100 text-teal-700` (dark: `bg-teal-900 text-teal-300`) — 초중급
  - B1: `bg-sky-100 text-sky-700` (dark: `bg-sky-900 text-sky-300`) — 중급
  - B2: `bg-violet-100 text-violet-700` (dark: `bg-violet-900 text-violet-300`) — 중고급
  - C1: `bg-purple-100 text-purple-700` (dark: `bg-purple-900 text-purple-300`) — 고급
  - C2: `bg-pink-100 text-pink-700` (dark: `bg-pink-900 text-pink-300`) — 최고급

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
- **학생 퀴즈 원칙:** 퀴즈 유형에 맞는 레이아웃을 쓴다 — 빈칸/작문은 집중형(한 번에 하나), 매치업·워드마그넷처럼 여러 항목을 다루는 유형은 한 화면에 여러 항목을 보여줘도 된다. 공통적으로 차분하고 조용한 톤(시간압박·점수연출 등 아케이드 게임 UI는 지양). 점수/결과는 단계 완료 후.
- **Max content width:** 1120px (대시보드), 학생 퀴즈는 유형별로 640~960px (집중형 640px, 매치업·마그넷 그리드는 더 넓게)
- **Grid:** 12-column, 24px gap
- **Border radius** (`--radius: 0.75rem`):
  - `sm`: 8px — `calc(var(--radius) - 4px)` (배지, 인라인 요소)
  - `md`: 10px — `calc(var(--radius) - 2px)` (버튼, 입력 필드, 작은 카드)
  - `lg`: 12px — `var(--radius)` (큰 카드, 모달, 섹션)
  - `full`: 9999px (pill 배지, 아바타)

## Motion

- **Approach:** minimal-functional — 상태 전환만. 화려한 애니메이션 없음. 속도감은 즉각적인 반응으로 표현한다.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 80ms (버튼 hover, 색상 전환)
  - short: 150ms (드롭다운 열기, 포커스 링)
  - medium: 250ms (모달 등장, 슬라이드)
  - long: 400ms (페이지 전환)

- **Keyframes** (`tailwind.config.ts`):
  - `accordion-down / accordion-up` — 0.2s ease-out (아코디언)
  - `fade-in` — 0.5s ease-out, opacity + translateY(10px→0) (모달, 오버레이)
  - `slide-in-right` — 0.3s ease-out, opacity + translateX(20px→0) (사이드바 패널)
  - `pulse-soft` — 2s ease-in-out infinite, opacity 1→0.7→1 (녹음 중 빨간 펄스)

## Quiz-Specific Guidelines

### 학생 퀴즈 상단 안내 문구 (6개 유형 공통)
- "단어와 뜻을 짝지어 보세요" 같은 풀이 방법 안내는 `text-sm sm:text-base text-foreground font-bold`(진하게)로 통일 — 옅은 회색(`text-muted-foreground`)·중간 굵기(`font-medium`)이던 이전 스타일에서 의도적으로 벗어난 예외. 아래 Decisions Log 참고.

### 빈칸 채우기 (Fill in the Blank)
- 상단 보기(word bank): 현재 세트의 단어를 pill 배지로 나열. 이미 사용한 단어는 취소선 + opacity 감소.
- 문제 목록: 인라인 입력 필드. 활성 문제 행은 `primary-light` 배경으로 하이라이트.
- 세트 네비게이션: 하단 "이전 세트 / 다음 세트". 모든 답 미입력 시 다음 세트 비활성화.

### 문장 만들기 (Sentence Making)
- 한 번에 하나의 단어. 단어를 `primary-light` 박스로 강조.
- 텍스트에어리어 포커스 시 진한 `primary` 포커스 링(기본 shadcn `ring-2 ring-ring ring-offset-2`) 하나만 또렷하게 — 테두리 색은 중립으로 유지하고 링 색을 옅게(투명도) 타지 않는다. 정답 입력칸(빈칸 채우기/뜻 보고 단어 쓰기)과 동일한 포커스 처리.
- AI 채점 결과: success 배경 박스, 문법/어휘/자연스러움 3개 태그.

### 말하기 연습 (Speaking Practice)
- 녹음 중: `error` 색 (#C13B2E) — 빨간 펄스 애니메이션 + 파형. 녹음 = 행동 = 빨간색.
- 채점 결과: 전체 점수 (큰 mono 숫자) + 세부 4개 격자 + 단어별 색상 코딩 (녹색/노랑/빨강 점수 기준).

## CSS Variables Mapping (Tailwind / shadcn)

```css
:root {
  /* Surfaces */
  --background:          40 15% 97%;         /* #F8F5F0 한지 오프화이트 (앱 배경) */
  --foreground:          20 8% 10%;          /* #1A1714 잉크 */
  --card:                0 0% 100%;          /* 카드/모달/입력 배경 */
  --card-foreground:     20 8% 10%;

  /* Brand */
  --primary:             152 55% 27%;        /* #1E6B47 대나무 그린 */
  --primary-foreground:  0 0% 100%;
  --accent:              152 55% 95%;        /* #E8F5EE primary-light */
  --accent-foreground:   152 55% 20%;        /* primary-dark */

  /* Neutral */
  --secondary:           40 15% 97%;
  --secondary-foreground: 20 8% 10%;
  --muted:               40 15% 97%;
  --muted-foreground:    22 7% 40%;          /* #6B6460 */
  --border:              25 12% 88%;         /* #E2DDD8 */
  --input:               25 12% 88%;
  --ring:                152 55% 27%;

  /* Semantic */
  --success:             150 47% 34%;        /* #2D7D52 */
  --warning:             38 72% 45%;         /* #D97706 */
  --destructive:         3 60% 47%;          /* #C13B2E (error) */
  --info:                199 89% 48%;        /* #1D4ED8 */

  /* Radius */
  --radius:              0.75rem;            /* 12px = lg */

  /* Sidebar */
  --sidebar-background:          40 15% 97%;
  --sidebar-foreground:          20 8% 10%;
  --sidebar-primary:             152 55% 27%;
  --sidebar-primary-foreground:  0 0% 100%;
  --sidebar-accent:              152 55% 95%;
  --sidebar-accent-foreground:   152 55% 20%;
  --sidebar-border:              25 12% 88%;
  --sidebar-ring:                152 55% 27%;
}
```

## CSS Utilities (`src/index.css`)

| 클래스 | 설명 |
|--------|------|
| `.gradient-primary` | `bg-gradient-to-r from-primary to-purple-500` — 강조 버튼/배너 전용 |
| `.gradient-text` | 위 그라디언트 + `bg-clip-text text-transparent` |
| `.card-hover` | `transition-all duration-300 hover:shadow-lg hover:-translate-y-1` |
| `.glass` | `bg-background/80 backdrop-blur-lg` |
| `.level-badge` | `px-3 py-1 rounded-full text-xs font-semibold` — CEFR 배지 베이스 |
| `.level-a1` ~ `.level-c2` | 위 색상 섹션 참조 |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-23 | Primary 색상: 대나무 그린 #1E6B47 | 보라/파란색 EdTech 카테고리에서 의도적으로 이탈. 신뢰, 성숙함. |
| 2026-04-23 | 한국어 폰트: Pretendard (UI/본문) + Paperozi (display 유지) | Pretendard가 한국어 가독성 최적. Paperozi는 브랜드 정체성 유지. |
| 2026-04-23 | 영문 헤더: DM Serif Display | 정밀함과 따뜻함의 대비. 큰 타이틀에만 사용. |
| 2026-04-23 | 영문 UI: Geist + Geist Mono | 숫자 정렬, UI 텍스트. Tabular-nums 지원. |
| 2026-04-23 | 학생 퀴즈: 게임 UI 없음 | 집중 모드. 점수는 세트 완료 후. 진지한 학습 도구 인상. |
| 2026-06-21 | "한 번에 한 문제" 강제 완화 | 매치업·워드마그넷 등 여러 항목형 신규 유형 추가에 따라, 유형별 적절한 레이아웃 허용(차분한 톤은 유지, 아케이드 연출은 계속 지양). |
| 2026-04-23 | Surface: #F8F5F0 (한지 오프화이트) | 순백이 아닌 따뜻함. 장시간 화면 피로 감소. |
| 2026-04-23 | Initial design system created | /design-consultation via gstack |
| 2026-05-26 | 브랜드 나무(Namu)로 리네임 | 트리/잎 모티프로 자연 친화적 아이덴티티. "달콤한 한국어"에서 전환. |
| 2026-05-26 | 나뭇잎 그린 #8FC85A 추가 (로고 전용) | 로고 리프 아이콘 포인트 컬러. 일반 UI 사용 금지. |
| 2026-05-26 | AppSidebar 레이아웃 도입 | 역할별 네비게이션(선생님/학생/관리자) 분리. sidebar CSS 토큰 시스템 추가. |
| 2026-05-26 | --radius 0.5rem → 0.75rem | 전체적으로 더 부드러운 모서리. 카드/모달 질감 개선. |
| 2026-06-11 | 폰트 단일화 → Pretendard 하나 | Paperozi·DM Serif·Geist·Geist Mono 전부 제거. Geist Mono 슬래시 제로 비선호 + 폰트 수/로드 최소화. 숫자는 Pretendard + tnum. |
| 2026-07-02 | 정답 입력칸 배경 흰색 → `slate-50`, 포커스는 진한 단일 링만(테두리 색 변경·옅은 링 오버레이 금지) | 학생 퀴즈 3종(빈칸 채우기/뜻 보고 단어 쓰기/문장 만들기)의 입력칸이 배경색·포커스 표시 방식이 제각각이었음. 실제 비교 결과 "테두리 색 불변 + 진한 단일 ring"(빈칸 채우기 기존 방식)이 가장 또렷했고, 배경은 카드 흰색과 구분되면서 기존 프롬프트 박스와도 톤이 이어지는 `slate-50`으로 통일. |
| 2026-07-02 | 설명 배너 색 `#F1ECE4` 공식화, 6개 유형 모두에 적용 → 곧바로 취소 | 원래 빈칸 채우기 "보기"칸에만 예외적으로 쓰이던 색. 6개 퀴즈 유형의 상단 안내 문구 스타일이 제각각(배경 없는 텍스트 vs 없음)이었는데, 이 색을 팔레트에서 빼는 대신 오히려 안내 문구 배너 전용 공식 색으로 승격해 전체 통일 시도. 빈칸 채우기·말하기 연습에도 안내 문구 신규 추가. 짝맞추기 제외 5개 유형 컨테이너 너비도 `max-w-3xl`로 통일. |
| 2026-07-02 | 상단 안내 문구 배너 전체 제거 | 실제로 적용해보니 안내 문구 자체가 화면을 산만하게 해서, 6개 유형 전부에서 상단 안내 문구를 완전히 없애기로 결정(원래 있던 4개 유형의 문구도 함께 제거). `#F1ECE4`는 다시 빈칸 채우기 "보기"칸 전용으로 축소. 컨테이너 너비 `max-w-3xl` 통일은 유지. |
| 2026-07-15 | 퀴즈 유형색 3개 → 6개로 정리하고 `--type-*` 토큰으로 실제 구현 | 그동안 문서에만 3개(`--type-fill`/`--type-sentence`/`--type-speaking`)가 있었고 index.css엔 토큰이 아예 없어, 유형색이 AdminDashboard의 하드코딩 hex로만 존재했음. 신규 3유형(짝 맞추기·단어 받아쓰기·문장 순서 맞추기)도 문서에 없었음. 토큰명을 `BaseStage` 키 기준으로 통일하고 `:root`/`.dark` 양쪽에 정의 + tailwind에 `type-*`로 등록. |
| 2026-07-04 | 안내 문구 재도입(배경 없이) 후 볼드체로 변경 | 안내 문구를 다시 넣되 이번엔 배경 없이 텍스트만. 이후 듀오링고 등 타 앱 캡처를 참고해 `text-muted-foreground font-medium`(옅음)에서 `text-foreground font-bold`(진하게)로 전환. "차분한 톤" 원칙에서 벗어난 의도적 예외 — 크기(`text-sm sm:text-base`)는 유지해 실제 단어/문장 콘텐츠보다 작게 유지. |
