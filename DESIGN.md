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

### 퀴즈 풀이 화면 컨테이너 규칙 (4개 유형 공통: 문장 순서 맞추기·문장 만들기·말하기 연습·빈칸 채우기)
- 카드 최상단은 **헤더 줄**이다. 좌측 = 유형 배지, 중앙 = 안내문구, 우측 = 힌트 버튼.
  세 자리 중 비는 자리가 있어도 **헤더 줄 자체와 높이는 항상 렌더**한다 — 유형을 옮겨
  다녀도 안내문구가 같은 y좌표에 온다. 공용 컴포넌트는 `src/components/quiz/shared/QuizStageHeader.tsx`
  (props: `instruction`, `badge?`, `action?`, `flex-1` 좌우 균등 분배 + `min-h-[2.25rem] sm:min-h-[2.5rem]`
  로 높이 고정)와 `src/components/quiz/shared/HintButton.tsx`(힌트 토글 공용화, `active`/`onToggle`).
- **회색 박스(`bg-slate-50`)는 "이 문제의 재료"만 담는다.** 읽을 문장, 제시 단어, 보기 목록.
  안내문구·배지·힌트·학생 입력 UI는 회색 박스 밖(흰 면)에 둔다. 예외: 말하기 연습 listen
  모드의 음성 재생 버튼 — 재료를 듣는 수단이므로 박스 안에 유지.
- 힌트는 학생이 누르는 컨트롤이므로 문제 재료와 절대 섞지 않는다.
- 짝 맞추기는 이 규칙 대상이 아니다(이미 다른 레이아웃 원칙을 따름).
- **미리보기도 실제 화면과 같은 규칙을 따른다.** QuizPreview·QuizDetail의 "학생 화면"
  미리보기는 각 유형마다 별도 공유 컴포넌트(`FillBlankStudentSet.tsx`,
  `WordMagnetStudentView.tsx`, `SentenceMakingStudentView.tsx`, `RecordingStudentView.tsx`)를
  쓰는데, 실제 화면(`*Stage.tsx`)만 고치고 이 미리보기를 빠뜨리면 선생님이 보는 화면이
  학생 화면과 어긋난다. 유형별 레이아웃을 바꿀 땐 이 네 파일도 **항상 함께** 확인한다.

### 학생 퀴즈 상단 안내 문구 (6개 유형 공통)
- "단어와 뜻을 짝지어 보세요" 같은 풀이 방법 안내는 `text-sm sm:text-base text-foreground font-bold`(진하게)로 통일 — 옅은 회색(`text-muted-foreground`)·중간 굵기(`font-medium`)이던 이전 스타일에서 의도적으로 벗어난 예외. 아래 Decisions Log 참고.

### 빈칸 채우기 (Fill in the Blank)
- 상단 안내 + 예시: **흰 면**(회색 박스 밖), `QuizStageHeader`로 `빈칸에 알맞은 단어를 문법
  형태와 함께 입력하세요`. 그 아래 예시 2개를 **흰 칩**으로 둔다(`bg-slate-50 border
  border-slate-200 rounded-xl`처럼 옅은 테두리, 결합되는 문법 요소만 `text-primary font-bold`):
  ```
  미술관 + 에               →  미술관에
  가다 + -고 있다 + 아/어요   →  가고 있어요
  ```
  회색 잔글씨 2줄로 두면 안내문의 부속처럼 보이고 길이 차 때문에 삐뚤어 보인다 — 칩으로
  감싸 독립된 덩어리로 만든다. **고정 문자열, 세트당 한 번, 문항마다 반복 금지.**
  **평소엔 숨겨져 있다** — 인라인으로 상시 노출하지 않고, 안내문구 텍스트 끝("...
  입력하세요") 바로 옆에 붙는 작은 정보 아이콘(`Info`)을 눌러야 Popover로 뜬다. 아이콘은
  `QuizStageHeader`의 `instruction` prop 안에 텍스트와 한 덩어리로 넣는다 — 헤더 우측
  `action` 슬롯에 두면 안내문구에서 멀리 떨어져 보인다. 기존 `GrammarHintButton`과 같은
  패턴(`src/components/ui/popover.tsx` 재사용) — 바깥을 클릭하면 닫히고, **세트를 넘겨도
  자동으로 열리지 않는다**(Popover는 오버레이라 자동으로 뜨면 "클릭 안 했는데 떠 있다가
  아무 데나 눌러 바로 닫히는" 어색한 경험이 된다).
  **팝오버는 카드 가로 중앙에 뜬다, 아이콘 위치 기준이 아니다** — `PopoverTrigger`(아이콘,
  클릭 대상)와 `PopoverAnchor`(위치 계산 기준)를 분리하는 Radix 공식 패턴을 쓴다.
  `PopoverAnchor asChild`로 안내문구를 감싸는 카드 폭 전체 wrapper를 감싸면, 트리거가
  안내문구 어디에 있든 팝오버는 항상 그 wrapper(카드 콘텐츠 폭) 기준으로 중앙에 뜬다.
  (`src/components/ui/popover.tsx`는 기본적으로 `PopoverAnchor`를 export하지 않으므로
  직접 추가해야 한다.)
  팝오버 안 칩 2개는 `flex-wrap`으로 **기본은 한 줄**, 폭이 부족한 좁은 화면에서만
  자동으로 줄바꿈된다(완전한 강제 한 줄은 모바일에서 잘림 위험이 있어 피한다).
  이 패턴은 `FillBlankStage.tsx`(학생 화면)와 `FillBlankStudentSet.tsx`(선생님 미리보기 —
  QuizPreview·QuizDetail 공유) 양쪽에 동일하게 적용돼 있다.
- 보기(word bank): **회색 박스**(`bg-slate-50`) 안에 현재 세트의 단어를 흰 pill 배지로
  나열(`bg-white shadow-sm`가 회색 배경 위에서 떠 보인다). 이미 사용한 단어는 취소선 + opacity 감소.
- 베이지(`#F1ECE4`/`#D3CCC4`)는 더 이상 쓰지 않는다 — 안내는 흰 면, 보기는 회색 박스로 뒤집었다.
- 문제 목록: 인라인 입력 필드. 활성 문제 행은 `primary-light` 배경으로 하이라이트.
- 세트 네비게이션: 하단 "이전 세트 / 다음 세트". 모든 답 미입력 시 다음 세트 비활성화.
- **문법 힌트 버튼 (`GrammarHintButton`)**: 문법 힌트(`problem.hint`)는 **문장 글자처럼 그대로 노출하지 않는다.** 정답 입력칸 **바로 오른쪽에 맞붙는 접합 버튼**으로 `문법` 한 단어를 두고, 클릭하면 Popover로 힌트를 보여준다.
  - **접합 스타일**: 독립된 알약(`rounded-full`)이 아니라 입력칸에 **왼쪽 모서리를 지우고
    맞붙는** 형태 — `rounded-l-none rounded-r-xl border border-l-0 border-primary/30 bg-accent`.
    입력칸도 힌트가 있을 때 오른쪽 모서리를 지운다(`rounded-l-xl rounded-r-none border-r-0`),
    없으면 `rounded-xl` 그대로. 둘을 감싸는 래퍼의 `gap`은 0(붙어야 하므로). 따로 떨어진
    알약이면 각진 입력칸 옆에 뜬 배지처럼 보여 입력칸의 부속으로 안 읽힌다.
  - 높이는 `heightClass` prop으로 받는다(모바일 입력칸 `h-11` / 데스크톱 기본 `h-10`).
  - 공개는 기존 `src/components/ui/popover.tsx`(Radix) 재사용. `side="top"`. **바깥을 클릭하면 닫힌다** — 학생이 입력칸을 누르면 힌트가 사라지는 트레이드오프를 알고 채택한 것이다. open 상태는 컴포넌트가 직접 소유하므로 호스트에 `revealedHints` 같은 state를 두지 않는다.
  - 입력칸 placeholder는 **항상 `"정답 입력"`**. (힌트 공개 시 `` `${hint} 형태로` ``로 바꿨더니 `-(으)ㄹ 수 없어요 형태로` 같은 긴 문법형이 입력칸을 가득 채워 지저분했다.)
  - 정답 산출에 필수인 요소이므로 `tabIndex={-1}`을 붙이지 않는다(같은 행의 듣기/번역 버튼과 다른 점).
  - `hint`가 비어 있으면 버튼 자체를 렌더하지 않는다 — 이때 입력칸은 4방향 다 둥근 `rounded-xl`.
  - **행은 1단으로 유지한다.** 힌트를 입력칸 *위*에 얹으면 행이 2단이 되어 높이를 못 줄이고(실측 89px이 한계였다), 힌트 길이에 따라 폭이 달라져 **입력칸 시작 위치가 문항마다 들쭉날쭉해진다.**
  - **세로 정렬**: 1단이므로 그룹 `items-center` 하나로 충분하다. `items-end` + 하단 보정 패딩 같은 트릭을 다시 넣지 말 것.
  - **번호 위치**: 문항 번호는 바깥 flex 행의 형제가 아니라 **문장 그룹 안 첫 번째 항목**이어야 한다. 형제로 두면 좁은 폭(640~740px)에서 문장만 두 줄로 접힐 때 번호가 마지막 줄로 내려간다.
- **번역 버튼**: `Lightbulb` 아이콘 버튼의 라벨은 **"번역"**(과거 "힌트"). 실제로 `maskTranslation(translation)`을 토글하므로 사실에 맞춘 이름이며, 문법 힌트 버튼과 개념이 겹치지 않게 하기 위함이다.
- 참고: 문장 그룹의 `leading-*`은 행 높이에 영향을 주지 **않는다**. flex 자식 span들이 `text-lg`로 자기 line-height(28px)를 직접 갖기 때문이다. 높이는 래퍼 패딩과 입력칸 높이가 결정한다.
- 이 패턴은 `FillBlankStudentSet.tsx`(선생님용 학생 미리보기)와 `WrongAnswerPractice.tsx`
  (오답 노트 연습, 힌트 버튼은 없고 안내+보기 뒤집기만 동일 적용)에도 동일하게 적용돼 있다.

> 참고: 위 `primary-light`(#E8F5EE)는 별도 Tailwind 클래스가 아니라 `--accent`(152 55% 95%) 토큰으로 구현돼 있다. 코드에서는 `bg-accent`를 쓴다.

### 문장 만들기 (Sentence Making)
- 안내문구 + 힌트 버튼: **흰 면**의 `QuizStageHeader`(`action`에 `HintButton`). 회색 박스에는
  단어 배지 + 힌트 뜻만 남긴다(예전엔 안내·힌트·배지·뜻이 회색 박스 안에 뒤섞여 있었다).
- 한 번에 하나의 단어. 단어를 `primary-light` 박스로 강조.
- 텍스트에어리어 포커스 시 진한 `primary` 포커스 링(기본 shadcn `ring-2 ring-ring ring-offset-2`) 하나만 또렷하게 — 테두리 색은 중립으로 유지하고 링 색을 옅게(투명도) 타지 않는다. 정답 입력칸(빈칸 채우기/뜻 보고 단어 쓰기)과 동일한 포커스 처리.
- AI 채점 결과: success 배경 박스, 문법/어휘/자연스러움 3개 태그.

### 말하기 연습 (Speaking Practice)
- 유형 배지(듣고/보고 말하기) + 안내문구 + 힌트 버튼: **흰 면**의 `QuizStageHeader`. 회색
  박스에는 문장(read 모드) 또는 재생 버튼(listen 모드)만 남긴다. listen 모드 안내문구는
  헤더에만 있고 회색 박스 안에서 중복 렌더하지 않는다.
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
| 2026-07-28 | 빈칸 채우기 문법 힌트를 문장 인라인 → 입력칸 위 칩으로 분리, 기본 마스킹 + 클릭 공개 | 학생이 정답에 문법 형태를 빼고 원형만 쓰는 일이 잦았음. 원인은 힌트가 문장 본문과 같은 줄·같은 크기(`text-primary/70 text-base font-medium`)로 입력칸 오른쪽에 붙어 있어 **이미 문장에 들어있는 글자로 읽혔기** 때문(모바일은 `( _____ ) 에`가 통째로 문장 안에 보여 더 심했음). 채점은 완전 일치만 인정하므로 문법을 아는 학생도 무더기로 오답 처리됨. 채점·데이터·AI 프롬프트는 그대로 두고 입력 유도만 수정. 점선 고스트 칩은 시선 순위 최하위라 기각하고 `bg-accent` 채움 pill 채택. 클릭 공개를 택한 이유는 "이건 문장이 아니라 내가 써야 할 것"이라는 인식을 만들기 위함이며, 안 눌러서 못 보는 실패를 막으려고 **칩 자체는 항상 보이고 내용만 가린다**. 제출 전 형식 넛지는 의도적으로 보류 — 이 UI 변경만으로 부족하면 그때 추가한다. |
| 2026-07-29 | 퀴즈 풀이 화면 컨테이너 통일 — 4개 유형(문장 순서 맞추기·문장 만들기·말하기 연습·빈칸 채우기)에 공용 `QuizStageHeader`/`HintButton` 도입 | 유형마다 안내문구·배지·힌트 버튼의 위치가 제각각이라 유형을 오갈 때 안내문구가 화면에서 위아래로 튀었다. 문장 순서 맞추기만 안내문구가 회색 박스(`bg-slate-50`) 밖에 있었고, 나머지 세 유형은 재료(문장·단어·보기)와 컨트롤(힌트 버튼·배지)이 섞여 있었다. **"회색 박스는 문제 재료만, 안내·배지·힌트는 흰 면의 공용 헤더 줄로"** 규칙으로 통일: `QuizStageHeader`(좌 배지/중앙 안내문구/우 액션, `flex-1` 균등 분배 + `min-h` 고정)와 `HintButton`을 새로 만들어 3개 유형에 적용, 빈칸 채우기는 베이지(`#F1ECE4`/`#D3CCC4`) 블록을 걷어내고 안내는 흰 면, 보기는 회색 박스로 뒤집었다(안내·보기가 정반대 색이던 것을 정정). 실측으로 4개 유형의 안내문구 y좌표가 정확히 일치함을 확인. 같은 패턴을 `FillBlankStudentSet.tsx`(선생님용 학생 미리보기)·`WrongAnswerPractice.tsx`(오답 노트 연습)·`HeroProductMock.tsx`(랜딩 목업)에도 동일 적용 — 이 셋은 애초 지시서 범위 밖이었지만 그대로 두면 실물과 어긋나 혼란을 준다는 이유로 함께 처리했다. |
| 2026-07-29 | 문법 힌트 버튼을 독립 알약(`rounded-full`)에서 **입력칸에 맞붙는 접합 버튼**으로 | 위 컨테이너 통일과 같은 리팩터링의 일부. 알약이 입력칸과 따로 떨어져 있으면 "입력칸 옆에 뜬 배지"로 보여 입력칸의 부속이라는 인상이 약했다. 왼쪽 모서리를 지우고(`rounded-l-none rounded-r-xl border-l-0`) 입력칸의 오른쪽 모서리도 지워(`rounded-l-xl rounded-r-none border-r-0`, 힌트 없으면 `rounded-xl` 그대로) 하나로 붙였다. 높이는 `heightClass` prop으로 인접 입력칸과 맞춘다(모바일 `h-11`/데스크톱 `h-10`). Popover 열림/닫힘 동작 자체는 변경 없음. |
| 2026-07-29 | 문법 힌트 버튼의 왼쪽 테두리를 다시 살림(`border-l-0` 제거) | 입력칸과 버튼을 접합하며 왼쪽 테두리를 아예 없앴더니 둘 사이 경계가 안 보였다. 왼쪽 테두리를 되살리면 버튼 자체 색(`border-primary/30`)이 그대로 구분선 역할을 한다 — 새 색을 정의할 필요가 없었다. 버튼의 개별 포커스 링(`focus-visible:ring-2`)도 제거했는데, 입력칸+버튼을 감싸는 호출부 wrapper가 `focus-within:ring-2`로 포커스 링을 대신 그리기 때문 — 입력칸에 포커스가 가든 버튼에 포커스가 가든 하나의 링이 둘을 함께 감싸야 한 덩어리로 보이고, 버튼에 자체 링을 남기면 탭으로 넘어올 때 링이 겹쳐 보인다. |
| 2026-07-29 | 빈칸 채우기 예제를 인라인 상시노출 → 안내문구 옆 정보 아이콘 + Popover로, 그다음 카드 중앙 정렬로 2차 수정 | 처음엔 접기/펴기 텍스트 버튼(`예제 ⌄`)을 안내문구 아래 별도 줄로 뒀는데, 이 버튼 자체가 안내문구와 예제 사이에 낀 시각적 잡음이 됐다. 대안들을 비교해 `GrammarHintButton`과 같은 "아이콘 클릭 → Popover" 패턴(이미 검증된 관용구)으로 교체하고, 세트 1 자동 펼침은 뺐다 — Popover는 오버레이라 클릭 없이 자동으로 뜨면 어색하다(첫 클릭에 바로 닫혀버리는 경험). 이후 아이콘을 헤더 우측 `action` 슬롯에서 안내문구 텍스트 끝으로 옮겨달라는 요청에 따라 인라인으로 이동했는데, 그 상태에선 팝오버가 **아이콘 위치 기준**으로 떠서 카드 중앙이 아니라 오른쪽으로 치우쳤다. 원인은 Radix Popover가 위치를 "앵커"(없으면 트리거) 기준으로 계산하는데 트리거=아이콘이라 그랬던 것. `src/components/ui/popover.tsx`에 `PopoverAnchor`(당시 export 안 돼 있었음)를 추가해 트리거(아이콘, 클릭 대상)와 앵커(위치 계산 기준, 안내문구를 감싸는 카드 폭 전체 wrapper)를 분리하는 Radix 공식 패턴으로 해결했다. 예제 2개도 세로 2줄(`flex-col`) → `flex-wrap`으로 기본 한 줄, 좁은 화면에서만 줄바꿈. `FillBlankStudentSet.tsx`(선생님 미리보기, QuizPreview·QuizDetail 공유)에도 동일 적용해 학생 화면과 통일했다. |
| 2026-07-29 | `src/pages/QuizUIPreview.tsx`(`/quiz/ui-preview`) 삭제 | 앱 어디서도 링크되지 않는(참조가 `App.tsx`의 라우트 정의 하나뿐) 개발자 전용 UI 카탈로그 페이지였다. 실데이터 없이 6개 유형+결과 화면을 탭으로 훑어보려는 용도로 보였으나, 실제 화면 디자인이 여러 차례 바뀌는 동안(컨테이너 통일, 예제 Popover 전환 등) 이 페이지만 계속 갱신이 누락돼 가장 오래된 디자인(그리드 예제, Popover 없음)으로 뒤처져 있었다. 아무도 안 보는 페이지라 아무도 이 불일치를 알아채지 못했다 — "최신 디자인처럼 보이지만 실은 옛날 것"이라는 위험이 유지 비용보다 커서, 계속 관리하는 대신 삭제를 택했다. 실제 선생님이 보는 미리보기(`FillBlankStudentSet.tsx` 등 `*StudentView.tsx` 계열)는 이 삭제와 무관하게 그대로 유지된다. |
| 2026-07-28 | 문법 힌트 칩 3차 — 입력칸 **위 칩**을 폐기하고 **오른쪽 `문법` 버튼 + Popover**로 전환 | 칩이 입력칸 위에 있는 한 행이 2단이라 세로 높이를 89px 밑으로 못 내렸고(칩 도입 전은 81px), 더 큰 문제로 **칩 너비가 힌트 길이에 좌우돼 입력칸 시작 위치가 문항마다 들쭉날쭉**했다(`문법 힌트` vs `문법 -고 있다 + 아/어요`). 버튼을 오른쪽 인라인으로 옮기니 행이 1단으로 복귀해 두 문제가 동시에 해소되고, 2차에서 필요했던 `revealedHints` state·`items-end`·하단 보정 패딩(`pb-1.5`/`pb-0.5`)이 전부 불필요해졌다. 마스킹이라는 핵심 장치(힌트가 문장 글자로 안 읽히게 하는 것)는 그대로다. 공개는 기존 Radix Popover 재사용 — **바깥 클릭 시 닫히므로 학생이 입력칸을 누르면 힌트가 사라진다**는 트레이드오프를 알고 채택했다(불편하면 고정 말풍선으로 전환 가능). 안내 문구도 `빈칸에 알맞은 단어를 문법 형태와 함께 입력하세요`로 바꾸고 예시를 2개로 늘려 화살표 정렬로 아래 배치. |
| 2026-07-28 | 문법 힌트 칩 2차 조정 — 행 높이 축소, 번호를 문장 그룹 안으로, 마스킹 문구·placeholder 정정 | 칩을 입력칸 위로 올린 뒤 실제 화면에서 네 가지가 드러남. ① 행이 2단이 되며 피치가 111px로 불어나 답답해짐 → 칩 위치는 유지한 채 `py-6 sm:py-5`→`py-4 sm:py-3`, 칩 `py-1`→`py-0.5`, `gap-1`→`gap-0.5`로 축소해 **89px**로 낮춤(칩 도입 전 원래 높이 81px 대비 +8px). 처음엔 `leading-loose`를 주범으로 지목했으나 실측 결과 오진이었다 — flex 자식 span이 `text-lg`로 자기 line-height를 갖고 있어 부모 `leading-*`은 렌더에 영향이 없었다. `leading-normal`로 바꾼 건 무해하나 높이 감소분은 전부 패딩·칩 크기에서 나왔다. ② 문장이 입력칸과 다른 줄처럼 떠 보임 → 세로 중심을 칩 포함 스택이 아니라 **입력칸 중심선**에 맞추도록 보정. ③ 640~740px에서 문장만 두 줄로 접히면 번호가 마지막 줄로 내려감(형제 flex + `items-end` 탓, `items-center`였을 땐 한가운데로 뜸. 칩이 위에 있어 `items-start`도 불가) → 번호를 문장 그룹 **안 첫 항목**으로 옮겨 줄바꿈에 함께 참여시킴. ④ 마스킹 `문법 ______`을 `문법 힌트`로, 공개 시 바뀌던 placeholder는 항상 `정답 입력`으로 고정(`-(으)ㄹ 수 없어요 형태로`가 입력칸을 가득 채워 지저분했음). 안내 문구와 예시도 한 줄로 병합. |
| 2026-07-28 | `Lightbulb` 버튼 라벨 "힌트" → "번역" (빈칸 채우기·오답 노트 연습) | 이 버튼은 실제로 `maskTranslation(translation)`, 즉 번역문을 보여주는데 이름이 "힌트"라 문법 힌트와 개념이 충돌했음. 한 행에 "힌트"가 두 번 나오면 학생 눈이 둘을 같은 것으로 뭉뚱그려 문법 칩이 묻힌다. 사실에 맞게 정정. |
| 2026-07-28 | 장식용 페이지 부제 삭제 | 제목을 되풀이할 뿐 정보가 없음. Decoration level: minimal 원칙과 "입력 필드가 화면을 지배한다"는 레이아웃 원칙에 어긋남. 숫자·맥락을 보여주는 상태 표시줄(단어장·오답노트 등)은 유지. |
