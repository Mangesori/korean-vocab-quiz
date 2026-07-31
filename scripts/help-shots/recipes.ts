/**
 * 도움말 센터 스크린샷 캡처 레시피.
 *
 * 키는 `${articleId}:${stepNumber}` (예: "t-firstquiz:1"), src/data/help/articles.ts의
 * steps[n].shot 선언과 반드시 일치해야 한다. 어긋나면 capture.ts가 방향에 따라 다르게
 * 알린다 — 레시피는 있는데 선언이 없으면(고아 레시피) 시작할 때 한 번에 모아 경고하고,
 * 선언은 있는데 레시피가 없으면 순회 중 그 슬롯에서 "레시피 없음"을 찍고 건너뛴다.
 * (문서 id를 인자로 준 실행에서는 고아 검사를 건너뛴다 — 다른 문서의 레시피가 전부
 * 고아로 잡히기 때문이다.)
 *
 * 각 레시피는 role에 맞는 로그인 상태의 새 Page를 받아서, 캡처할 화면까지 이동·조작만
 * 하고 끝난다 — 스크린샷을 찍고 저장하는 건 capture.ts가 공통으로 처리한다.
 *
 * 원칙: 실제 화면 흐름을 억지로 재현하려다 깨지기 쉬운 인터랙션(드래그, AI 생성 대기 등)에
 * 기대기보다, seed.ts가 이미 만들어둔 결정적 데이터로 곧장 도달할 수 있는 안정적인 화면을
 * 우선한다. 일부는 문서 캡션과 완벽히 1:1은 아니고 근접한 화면이다 — 그게 아예 없는 것보단
 * 낫다는 판단.
 */
import type { ElementHandle, Locator, Page } from "playwright";
import * as F from "./fixtures";

export type Role = "teacher" | "student1" | "anon";

export interface Recipe {
  role: Role;
  run: (page: Page) => Promise<void>;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
  await page.waitForTimeout(200);
}

/** 목표 경로에 실제로 머물렀는지 확인하고, 튕겼으면 다시 시도한다.
 *
 *  왜 필요한가: 일부 페이지가 `role`만 보고 리다이렉트한다. 예를 들어
 *  WrongAnswerNotebook.tsx:428은 `role !== 'student'`면 /dashboard로 보내는데,
 *  useAuth의 authLoading이 끝난 뒤에도 role(profiles 조회 결과)은 잠깐 null이라
 *  그 틈에 학생이 대시보드로 튕긴다. 실제로 s-notebook:3에 오답노트 대신
 *  학생 대시보드가 찍혔다. 레이스라 실행마다 결과가 달라져 더 위험하다.
 *  (앱 자체의 버그이기도 하다 — 학생이 북마크로 직접 열면 같은 일이 일어난다.) */
async function gotoStable(page: Page, path: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(path);
    await settle(page);
    if (new URL(page.url()).pathname === path) return;
    console.warn(`    ↻ ${path} 진입이 ${page.url()}로 튕겼습니다 — 재시도 ${attempt}/3`);
  }
  console.warn(`    ⚠ ${path}에 머물지 못했습니다. 이 슬롯은 엉뚱한 화면이 찍힙니다.`);
}

// button을 목록에 넣은 이유: closest()는 선택자 나열 순서가 아니라 DOM에서 가장 가까운
// 조상을 찾는다. 버튼 안의 텍스트("AI로 퀴즈 생성")를 강조할 때 button이 없으면 위로
// 계속 올라가 페이지 전체를 감싸는 큰 카드(rounded-2xl)가 잡혀 강조 효과가 사라진다.
const HIGHLIGHT_SECTION_SELECTOR =
  'button, section, [class*="rounded-2xl"], [class*="rounded-xl"], [class*="rounded-lg"]';

/** 강조 테두리 스펙. 대상 요소와의 간격과 모서리 곡률을 여기서만 조절한다. */
// 사진 위에 얹는 주석 표시라 앱 UI 색이 아니라 눈에 띄는 쪽을 고른다. 브랜드 그린은
// 초록이 많은 화면(오답노트 선택 바, 기본 버튼) 위에서 배경에 묻혀 안 보였다. 빨강은
// DESIGN.md의 error 토큰을 그대로 쓰고, 안팎에 흰 선(halo)을 덧대 흰 배경에서도
// 초록 배경에서도 경계가 살아 있게 한다.
const HIGHLIGHT = { color: "#C13B2E", width: 3, halo: 2, gap: 12, radius: 12 };

/** 강조/스크롤 대상은 본문(header + main) 안에서만 찾는다. 사이드바가 DOM상 본문보다
 *  앞이라 그냥 getByText를 쓰면 사이드바 메뉴 텍스트를 먼저 잡는다 —
 *  s-result:3이 사이드바 "오답노트" 링크를 잡아 강조가 통째로 무효가 된 적이 있다.
 *  AppLayout을 쓰지 않는 화면(퀴즈 풀이 등)은 header+main이 없으므로 페이지 전체로 폴백. */
async function locateForHighlight(page: Page, text: string) {
  const main = page.locator("header + main");
  if ((await main.count()) > 0) {
    const scoped = main.getByText(text, { exact: false }).first();
    if ((await scoped.count()) > 0) return scoped;
  }
  return page.getByText(text, { exact: false }).first();
}

// capture.ts가 잘라내는 세로 길이. 그 파일과 같은 값이어야 하는데 export가 없어 복제해 둔다
// (capture.ts는 이번 작업에서 손대지 않기로 했다).
const CLIP_HEIGHT = 720;
/** 강조 테두리와 캡처 영역 가장자리 사이에 최소한 남길 여백. */
const CLIP_MARGIN = 8;

/** 지금 스크롤 상태에서 캡처될 영역의 뷰포트 상단 y. capture.ts와 같은 계산이다
 *  (header + main의 top을 0으로 클램프). 스크롤에 따라 달라지므로 매번 다시 잰다. */
async function clipTopOf(page: Page): Promise<number> {
  return await page
    .evaluate(() => {
      const main = document.querySelector("header + main");
      if (!main) return 0;
      return Math.max(0, Math.round(main.getBoundingClientRect().y));
    })
    .catch(() => 0);
}

/** 강조 대상의 테두리(간격 포함) 세로 범위를 뷰포트 좌표로 잰다. */
async function measureHighlight(target: ElementHandle<HTMLElement>) {
  return await target.evaluate((el, spec) => {
    const rect = el.getBoundingClientRect();
    // halo(바깥 흰 선)까지 더해야 캡처 영역 맞춤 계산이 실제 두께를 반영한다.
    const pad = spec.gap + spec.width + spec.halo;
    return { top: rect.top - pad, bottom: rect.bottom + pad };
  }, HIGHLIGHT);
}

/** 강조 테두리가 캡처될 영역(y = 헤더높이 ~ +CLIP_HEIGHT) 안에 위아래 모두 들어오도록
 *  맞춘다.
 *
 *  왜 필요한가: 캡처 영역은 뷰포트(784px)보다 낮은 720px 고정이라, 뷰포트 기준으로
 *  가운데 맞춘 요소도 사진에서는 아래가 잘릴 수 있다. s-join:3의 "풀어야 할 퀴즈"
 *  카드가 그렇게 테두리 하단을 잃고 3면만 남았다. 슬롯마다 개별로 손보면 같은 결함이
 *  다른 슬롯에서 또 재발하므로 강조 경로 자체에 가드를 둔다.
 *
 *  스크롤해도 안 들어오면(대상이 캡처 영역보다 크거나 페이지 끝이라 더 못 움직임)
 *  조용히 넘어가지 않고 경고한다 — 그래야 로그만 보고 잘린 슬롯을 찾아낼 수 있다. */
async function fitHighlightIntoClip(page: Page, target: ElementHandle<HTMLElement>, label: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const clipTop = await clipTopOf(page);
    const box = await measureHighlight(target);
    const top = clipTop + CLIP_MARGIN;
    const bottom = clipTop + CLIP_HEIGHT - CLIP_MARGIN;
    if (box.top >= top && box.bottom <= bottom) return;

    if (box.bottom - box.top > CLIP_HEIGHT - CLIP_MARGIN * 2) {
      console.warn(
        `    ⚠ 강조 대상 "${label}"이(가) 캡처 영역(${CLIP_HEIGHT}px)보다 커서 테두리가 잘립니다 — ${page.url()}`,
      );
      return;
    }

    // 캡처 영역(뷰포트가 아니라)의 세로 중앙으로 옮긴다.
    const delta = (box.top + box.bottom) / 2 - (clipTop + CLIP_HEIGHT / 2);
    await page.evaluate((d) => window.scrollBy(0, d), delta).catch(() => {});
    await page.waitForTimeout(150);

    const moved = await measureHighlight(target);
    // 스크롤이 전혀 먹지 않았다면(페이지 끝) 더 시도해도 소용없다.
    if (Math.abs(moved.top - box.top) < 1) break;
  }

  const clipTop = await clipTopOf(page);
  const box = await measureHighlight(target);
  if (box.top < clipTop + CLIP_MARGIN || box.bottom > clipTop + CLIP_HEIGHT - CLIP_MARGIN) {
    console.warn(
      `    ⚠ 강조 대상 "${label}"을(를) 캡처 영역 안으로 넣지 못했습니다 — 테두리가 잘립니다: ${page.url()}`,
    );
  }
}

/** 텍스트가 속한 가장 가까운 섹션/카드/버튼에 브랜드 그린 테두리를 얹는다.
 *  글자 자체에만 그리면 "난이도" 세 글자만 감싸고 그 아래 실제 선택 버튼들이
 *  강조 밖에 남는다.
 *
 *  대상의 `outline`을 직접 건드리지 않고 **위에 덧씌우는 오버레이**로 그린다.
 *  outline은 대상의 성질에 끌려다니기 때문이다 — <section>은 모서리 곡률이 0이라
 *  테두리가 각지게 나오고, disabled 버튼은 `disabled:opacity-50`(button.tsx) 때문에
 *  요소 전체가 반투명해져 테두리까지 흐려진다("AI로 퀴즈 생성"에서 실측).
 *  오버레이는 대상의 곡률·투명도와 무관하게 항상 선명하고, 간격도 자유롭게 준다.
 *  스크린샷 직후 컨텍스트를 버리므로 지울 필요는 없다.
 *
 *  그리기 전에 fitHighlightIntoClip으로 테두리가 사진 안에 온전히 들어오는지 확인한다. */
async function applyHighlight(page: Page, text: string) {
  const loc = await locateForHighlight(page, text);
  // 대상을 못 찾으면 조용히 넘어가지 말고 알린다. s-practice:3에서 시드의 마스터
  // 단어가 오답노트 목록에 없어 강조가 통째로 빠진 걸 뒤늦게 발견했다.
  if ((await loc.count()) === 0) {
    // URL을 함께 찍는다 — 어느 슬롯에서 난 경고인지, 애초에 의도한 화면에 도달했는지
    // 로그만 보고 판별할 수 있다(대시보드로 튕긴 걸 이걸로 알아냈다).
    console.warn(
      `    ⚠ 강조 대상 "${text}"을(를) 찾지 못해 강조 없이 캡처됩니다 — 현재 URL: ${page.url()}`,
    );
    return;
  }

  // 실제로 테두리를 두를 요소를 먼저 확정해 핸들로 잡아 둔다. 측정·스크롤·그리기가
  // 모두 같은 요소를 봐야 해서, 매번 closest()를 다시 부르지 않는다.
  const target = (await loc
    .evaluateHandle((el, selector) => {
      const candidate = el.closest(selector) as HTMLElement | null;
      // 후보가 화면을 거의 다 덮을 만큼 크면 강조가 아니라 액자 테두리처럼 보인다.
      // 다이얼로그(모달)를 잡은 경우도 마찬가지 — 화면 대부분이 그 모달이라
      // "여기를 보라"는 의미가 사라진다. 둘 중 하나면 원래 텍스트 요소로 되돌린다.
      const tooBig = !!candidate && candidate.getBoundingClientRect().height > window.innerHeight * 0.85;
      const isDialog = !!candidate && candidate.matches('[role="dialog"], [role="alertdialog"]');
      return candidate && !tooBig && !isDialog ? candidate : (el as HTMLElement);
    }, HIGHLIGHT_SECTION_SELECTOR)
    .catch(() => null)) as ElementHandle<HTMLElement> | null;
  if (!target) return;
  await drawHighlight(page, target, text);
}

/** 이미 특정한 요소에 그대로 테두리를 두른다 — 가장 가까운 카드로 올라가지 않는다.
 *  텍스트로 찾으면 엉뚱하게 큰 조상이 잡히는 자리에 쓴다. t-wronganswer:1의
 *  '전체 선택'이 그랬다: 라벨 위로는 rounded-lg가 카드밖에 없어서 단계 카드 전체에
 *  테두리가 둘러졌고, 강조가 아니라 액자처럼 보였다. */
async function highlightLocator(page: Page, locator: Locator, label: string) {
  const handle = (await locator.first().elementHandle().catch(() => null)) as ElementHandle<HTMLElement> | null;
  if (!handle) {
    console.warn(`    ⚠ 강조 대상 "${label}"을(를) 찾지 못해 강조 없이 캡처됩니다 — 현재 URL: ${page.url()}`);
    return;
  }
  await drawHighlight(page, handle, label);
}

/** 캡처 영역 안으로 맞춘 뒤 실제로 테두리를 그린다. */
async function drawHighlight(page: Page, target: ElementHandle<HTMLElement>, label: string) {
  await fitHighlightIntoClip(page, target, label);

  await target
    .evaluate((el, spec) => {
      const rect = el.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.left = `${rect.left - spec.gap}px`;
      overlay.style.top = `${rect.top - spec.gap}px`;
      overlay.style.width = `${rect.width + spec.gap * 2}px`;
      overlay.style.height = `${rect.height + spec.gap * 2}px`;
      overlay.style.border = `${spec.width}px solid ${spec.color}`;
      // 안팎으로 흰 선을 한 겹씩 둘러 어떤 배경색 위에서도 테두리가 분리돼 보이게 한다.
      // box-shadow는 borderRadius를 그대로 따라가므로 둥근 모서리가 유지된다.
      overlay.style.boxShadow = `0 0 0 ${spec.halo}px #fff, inset 0 0 0 ${spec.halo}px #fff`;
      overlay.style.borderRadius = `${spec.radius}px`;
      overlay.style.boxSizing = "border-box";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "2147483647"; // 모달·팝오버 위에도 확실히 올라오도록
      document.body.appendChild(overlay);
    }, HIGHLIGHT)
    .catch(() => {});
  await page.waitForTimeout(100);
}

/** 대상을 뷰포트 세로 중앙으로 스크롤한 뒤 강조. scrollIntoViewIfNeeded는 뷰포트에
 *  "최소한으로 걸치는" 지점까지만 스크롤해서 요소가 하단 가장자리에 붙어 잘릴 수 있다. */
async function scrollTo(page: Page, text: string) {
  const loc = await locateForHighlight(page, text);
  await loc
    .evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }))
    .catch(() => {});
  await page.waitForTimeout(150);
  await applyHighlight(page, text);
}

/** 대상을 화면 위쪽에 붙인다(위로 offset만큼만 여백을 남긴다).
 *  "이 요소부터 아래로 쭉" 보여줘야 하는 화면용 — 가운데 맞추기(scrollTo)를 쓰면
 *  그 아래 내용이 절반밖에 안 들어온다. */
async function scrollToStart(page: Page, locator: Locator, offset = 24) {
  await locator
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "start", inline: "nearest" }))
    .catch(() => {});
  await page.evaluate((o) => window.scrollBy(0, -o), offset).catch(() => {});
  await page.waitForTimeout(200);
}

/** 대상의 아래끝이 캡처 영역 안으로 들어올 만큼만 아래로 스크롤한다.
 *  가운데 맞추기와 달리 최소한만 움직여 위쪽 내용을 최대한 남긴다
 *  (s-types:1의 짝 맞추기 6쌍처럼 위도 아래도 다 보여야 하는 화면용). */
async function scrollBottomIntoClip(page: Page, locator: Locator, margin = 16) {
  const clipTop = await clipTopOf(page);
  const bottom = await locator
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom)
    .catch(() => null);
  if (bottom === null) return;
  const overflow = bottom - (clipTop + CLIP_HEIGHT - margin);
  if (overflow <= 0) return;
  await page.evaluate((d) => window.scrollBy(0, d), overflow).catch(() => {});
  await page.waitForTimeout(150);
}

/** 진행 중인 등장 애니메이션이 끝나길 기다린 뒤, 남은 애니메이션·트랜지션을 아예 끈다.
 *
 *  왜: 컨텍스트에 reducedMotion:"reduce"를 줬지만 그건 prefers-reduced-motion 미디어
 *  쿼리를 쓰는 CSS에만 먹는다. 이 앱의 등장 애니메이션(tailwind.config.ts의 fade-in 등)은
 *  그 쿼리를 보지 않아 그대로 재생되고, s-types:6에 배지 아래로 흐릿한 대각선 잔상
 *  (fade-in의 translateY 중간 프레임)이 찍혔다.
 *  fade-in·slide-in-right 모두 최종 상태가 요소의 기본 스타일(opacity 1, transform 없음)과
 *  같아서, animation을 none으로 꺼도 "애니메이션이 끝난 모습"이 그대로 남는다. */
async function freezeAnimations(page: Page) {
  await page.waitForTimeout(600);
  await page
    .addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    })
    .catch(() => {});
  await page.waitForTimeout(100);
}

export const RECIPES: Record<string, Recipe> = {
  // ── t-signup ────────────────────────────────────────────────────────
  "t-signup:1": {
    role: "anon",
    run: async (page) => {
      await page.goto("/");
      await settle(page);
      await page.getByRole("link", { name: "무료로 시작" }).first().click();
      await settle(page);
    },
  },

  // ── t-firstquiz ─────────────────────────────────────────────────────
  "t-firstquiz:1": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      // 스크롤을 따로 하지 않는다 — 페이지 최상단(퀴즈 제목 + 단어 입력칸)이 그대로
      // 보여야 한다. applyHighlight는 테두리가 사진 밖으로 나갈 때만 스크롤한다.
      await applyHighlight(page, "입력 방식");
    },
  },
  "t-firstquiz:2": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await scrollTo(page, "난이도");
    },
  },
  "t-firstquiz:3": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await scrollTo(page, "퀴즈 유형");
    },
  },
  "t-firstquiz:4": {
    role: "teacher",
    run: async (page) => {
      // 실제 AI 생성은 호출하지 않는다(엣지 함수·비용). 생성 버튼이 보이는 상태로 대신한다.
      await page.goto("/quiz/create");
      await settle(page);
      await scrollTo(page, "AI로 퀴즈 생성");
    },
  },

  // ── t-words ─────────────────────────────────────────────────────────
  "t-words:1": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
    },
  },
  "t-words:2": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await scrollTo(page, "세트당 단어 수");
    },
  },
  "t-words:3": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await scrollTo(page, "번역 언어");
    },
  },

  // ── t-prompt ────────────────────────────────────────────────────────
  "t-prompt:1": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await page.getByRole("tab", { name: "프롬프트 입력" }).click();
      await page.waitForTimeout(200);
    },
  },
  "t-prompt:2": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await page.getByRole("tab", { name: "프롬프트 입력" }).click();
      await page.waitForTimeout(200);
      await scrollTo(page, "문제 수");
    },
  },
  "t-prompt:3": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/quiz/create");
      await settle(page);
      await page.getByRole("tab", { name: "프롬프트 입력" }).click();
      await page.waitForTimeout(200);
      await scrollTo(page, "AI로 퀴즈 생성");
    },
  },

  // ── t-edit — 6가지 유형의 편집 화면 (유형마다 고칠 수 있는 항목이 다르다) ──
  "t-edit:1": { role: "teacher", run: (page) => openTypeEditor(page, /^짝 맞추기 \(/) },
  "t-edit:2": { role: "teacher", run: (page) => openTypeEditor(page, /^단어 받아쓰기 \(/) },
  "t-edit:3": { role: "teacher", run: (page) => openTypeEditor(page, /^빈칸 채우기 \(/) },
  "t-edit:4": { role: "teacher", run: (page) => openTypeEditor(page, /^문장 순서 맞추기 \(/) },
  "t-edit:5": { role: "teacher", run: (page) => openTypeEditor(page, /^문장 만들기 \(/) },
  "t-edit:6": { role: "teacher", run: (page) => openTypeEditor(page, /^말하기 연습 \(/) },

  // ── t-createclass ───────────────────────────────────────────────────
  "t-createclass:1": {
    role: "teacher",
    run: async (page) => {
      await page.goto("/classes");
      await settle(page);
      await page.getByRole("button", { name: "새 클래스" }).click();
      await page.waitForTimeout(300);
    },
  },
  "t-createclass:2": {
    role: "teacher",
    run: async (page) => {
      await page.goto(`/quiz/${F.QUIZ_A_ID}`);
      await settle(page);
      await page.getByRole("button", { name: "퀴즈 보내기" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("tab", { name: "클래스에 할당" }).click().catch(() => {});
      await page.waitForTimeout(200);
    },
  },
  // ── t-invite ────────────────────────────────────────────────────────
  "t-invite:1": {
    role: "teacher",
    run: async (page) => {
      await page.goto(`/class/${F.CLASS_A.id}`);
      await settle(page);
      await scrollTo(page, "초대 코드");
    },
  },
  "t-invite:3": {
    role: "teacher",
    run: async (page) => {
      await page.goto(`/class/${F.CLASS_A.id}`);
      await settle(page);
      await scrollTo(page, "학생 목록");
    },
  },

  // ── t-classstatus ───────────────────────────────────────────────────
  "t-classstatus:1": {
    role: "teacher",
    run: async (page) => {
      await gotoStable(page, `/class/${F.CLASS_A.id}`);
      // 지표 카드 3개(전체 퀴즈·학생 수·최근 배정일)를 화면 맨 위에 붙이면
      // 그 아래로 배정된 퀴즈 목록까지 한 화면에 들어온다. 위쪽의 클래스 이름·
      // 초대 코드 줄은 t-invite:1이 이미 다루는 영역이라 잘려도 무방하다.
      await scrollToStart(page, page.locator("header + main div.grid-cols-3"), 16);
      await applyHighlight(page, "결과 확인");
    },
  },
  "t-classstatus:2": {
    role: "teacher",
    run: async (page) => {
      await gotoStable(page, `/class/${F.CLASS_A.id}`);
      // 학생 행의 아이콘 버튼에는 접근성 이름이 없다. 그런데 같은 행의 두 번째
      // 버튼은 UserMinus(학생을 클래스에서 제외)라 잘못 누르면 시드가 깨진다.
      // 그래서 순서에 기대지 않고 시계 아이콘(lucide-clock)을 직접 지목한다.
      // 행 스코프도 함께 걸어 다른 카드의 시계 아이콘(배정일 표시)을 피한다.
      const row = page
        .locator("header + main")
        .getByText(F.STUDENT1.name, { exact: true })
        .first()
        .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
      await row.locator("button:has(svg.lucide-clock)").first().click({ timeout: 5000 });
      await page.waitForSelector('[role="dialog"]');
      await settle(page);
      // 강조는 넣지 않는다 — 모달(유형별 점수 표) 전체가 설명 대상이다.
    },
  },

  // ── t-share ─────────────────────────────────────────────────────────
  // 세 장이 실제로 누르는 순서를 그대로 따라간다: 퀴즈 보내기 → 링크 공유 탭 → 링크 생성.
  // ⚠ '링크 생성'은 절대 누르지 않는다 — 누르면 quiz_shares에 행이 생겨 시드가 변형된다.
  "t-share:1": {
    role: "teacher",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}`);
      await settle(page);
      await applyHighlight(page, "퀴즈 보내기");
    },
  },
  "t-share:2": {
    role: "teacher",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}`);
      await settle(page);
      await page.getByRole("button", { name: "퀴즈 보내기" }).click();
      await page.waitForSelector('[role="dialog"]');
      await page.waitForTimeout(300);
      // 탭을 누르지 않는다 — 기본값인 '클래스에 할당'이 선택된 상태에서
      // "여기를 눌러 링크 공유로 바꾸세요"를 보여주는 단계다.
      await applyHighlight(page, "링크 공유");
    },
  },
  "t-share:3": {
    role: "teacher",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}`);
      await settle(page);
      await page.getByRole("button", { name: "퀴즈 보내기" }).click();
      await page.waitForSelector('[role="dialog"]');
      await page.waitForTimeout(300);
      await page.getByRole("tab", { name: "링크 공유" }).click().catch(() => {});
      await page.waitForTimeout(300);
      await applyHighlight(page, "링크 생성");
    },
  },

  // ── t-results ───────────────────────────────────────────────────────
  "t-results:1": {
    role: "teacher",
    run: async (page) => {
      // 선생님이 보는 결과 화면은 QuizResultsList(학생 목록·점수·제출 시간)다.
      // /quiz/:id/result/:resultId는 학생 본인 결과 화면(QuizResult.tsx)이라
      // 선생님 문서에 쓰면 "내 답변" 같은 1인칭 문구가 들어간다.
      await page.goto(`/quiz/${F.QUIZ_A_ID}?tab=results`);
      await settle(page);
      // 딥링크가 안 먹었을 때를 위한 보험
      await page
        .getByRole("tab", { name: "퀴즈 결과" })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await applyHighlight(page, "퀴즈 결과");
    },
  },
  "t-results:2": {
    role: "teacher",
    run: async (page) => {
      // 상세보기는 페이지 이동이 아니라 QuizResultDialog 모달을 연다
      // (QuizResultsList.tsx:340). 이 모달은 QuizReviewCard에 isTeacherView를
      // 넘겨 라벨이 "학생 답변"이 되므로 선생님 문서에 1인칭 문구가 섞이지 않는다.
      await page.goto(`/quiz/${F.QUIZ_A_ID}?tab=results`);
      await settle(page);
      await page
        .getByRole("tab", { name: "퀴즈 결과" })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      // 눈 아이콘 버튼에는 접근성 이름이 없다(아이콘만, sr-only 텍스트도 없음).
      // 제출 시간 칸에도 버튼이 있을 수 있어(SubmissionTimeCell의 점선 버튼)
      // 행 안의 마지막 버튼 = 맨 오른쪽 '상세보기' 칸으로 특정한다.
      await page.locator("table tbody tr").first().locator("button").last().click();
      await page.waitForSelector('[role="dialog"]');
      await settle(page);
      // 강조는 넣지 않는다 — 모달 전체가 설명 대상이다.
    },
  },

  // ── t-wronganswer — 오답 복습 퀴즈 위저드 3단계 ──────────────────────
  // 마지막 '퀴즈 생성' 버튼은 절대 누르지 않는다 — 실제 퀴즈가 만들어지고(시드 변형)
  // 'AI로 새 예문 생성'이 켜져 있으면 엣지 함수까지 호출된다.
  "t-wronganswer:1": {
    role: "teacher",
    run: async (page) => {
      await openWrongAnswerWizard(page);
      // 강조는 '전체 선택'에 건다 — 이 단계 본문이 "체크하거나 '전체 선택'을 누르세요"다.
      // 체크박스와 라벨을 같이 감싸는 줄(라벨의 부모)을 직접 지목한다.
      await highlightLocator(
        page,
        page.locator("header + main").getByText("전체 선택", { exact: true }).first().locator("xpath=.."),
        "전체 선택",
      );
    },
  },
  "t-wronganswer:2": {
    role: "teacher",
    run: async (page) => {
      await openWrongAnswerStep2(page);
      await applyHighlight(page, "자주 틀린 순");
    },
  },
  "t-wronganswer:3": {
    role: "teacher",
    run: async (page) => {
      await openWrongAnswerStep2(page);
      // 펼치면 유형 배지·문장·학생이 쓴 답이 나온다. "감사하다"는 빈칸 채우기 오답이라
      // 문장과 번역까지 함께 나와 이 단계 본문과 가장 잘 맞는다.
      const row = page.getByText(F.WRONG_ANSWER_EXPAND_WORD, { exact: false }).first();
      await row.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      // 목록이 자체 스크롤 영역(max-h-96)이라 펼친 카드가 그 안에서 밀려 내려간다.
      await row.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" })).catch(() => {});
      await page.waitForTimeout(200);
      // 강조는 넣지 않는다 — 펼쳐진 내용 전체가 설명 대상이다.
    },
  },
  "t-wronganswer:4": {
    role: "teacher",
    run: async (page) => {
      await openWrongAnswerStep2(page);
      // 체크박스는 줄 클릭(펼치기)과 분리돼 있으므로 행 안에서 따로 눌러야 한다.
      const row = page
        .getByText(F.WRONG_ANSWER_EXPAND_WORD, { exact: false })
        .first()
        .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
      await row.getByRole("checkbox").first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: /다음 · 설정으로/ }).click({ timeout: 5000 }).catch(() => {});
      await settle(page);
      // 제목·난이도·번역 언어·유형·생성 옵션이 최대한 한 화면에 들어오도록 위쪽에 붙이고,
      // 맨 아래 '선택한 클래스에 바로 배정'까지 들어오게 필요한 만큼만 더 민다.
      await scrollToStart(page, page.getByText("퀴즈 제목", { exact: true }), 24);
      await scrollBottomIntoClip(page, page.getByText("선택한 클래스에 바로 배정", { exact: true }));
    },
  },

  // ── t-profile / s-profile (같은 페이지, 스크롤 위치만 다름) ─────────────
  "t-profile:1": { role: "teacher", run: profileStep1 },
  "t-profile:2": { role: "teacher", run: profileStep2 },
  "t-profile:3": { role: "teacher", run: profileStep3 },
  "s-profile:1": { role: "student1", run: profileStep1 },
  "s-profile:2": { role: "student1", run: profileStep2 },
  "s-profile:3": { role: "student1", run: profileStep3 },

  // ── s-signup ────────────────────────────────────────────────────────
  "s-signup:1": {
    role: "anon",
    run: async (page) => {
      await page.goto("/auth?mode=signup");
      await settle(page);
    },
  },

  // ── s-join ──────────────────────────────────────────────────────────
  "s-join:2": {
    role: "student1",
    run: async (page) => {
      await page.goto("/dashboard");
      await settle(page);
      await page.getByText("초대 코드로 가입").click().catch(() => {});
      await page.waitForTimeout(300);
    },
  },
  "s-join:3": {
    role: "student1",
    run: async (page) => {
      await page.goto("/dashboard");
      await settle(page);
      await scrollTo(page, "풀어야 할 퀴즈");
    },
  },

  // ── s-types — 6가지 유형의 학생 풀이 화면. 유형별 단일 퀴즈로 결정적으로 도달한다 ──
  "s-types:1": {
    role: "student1",
    run: async (page) => {
      await openStudentQuiz(page, F.QUIZ_H_ID); // 짝 맞추기
      // 6쌍 목록의 세로 길이가 720px를 넘어 하단의 '이전 / 결과 확인' 버튼이 반쯤
      // 잘렸다. 위쪽 여백이 넉넉한 편이라 필요한 만큼만 밀면 6쌍과 버튼이 함께 들어온다.
      await scrollBottomIntoClip(page, page.getByRole("button", { name: /결과 확인/ }));
    },
  },
  "s-types:2": { role: "student1", run: (page) => openStudentQuiz(page, F.QUIZ_E_ID) }, // 단어 받아쓰기
  "s-types:3": { role: "student1", run: (page) => openStudentQuiz(page, F.QUIZ_B_ID) }, // 빈칸 채우기
  "s-types:4": { role: "student1", run: (page) => openStudentQuiz(page, F.QUIZ_F_ID) }, // 문장 순서 맞추기
  "s-types:5": { role: "student1", run: (page) => openStudentQuiz(page, F.QUIZ_G_ID) }, // 문장 만들기
  "s-types:6": { role: "student1", run: (page) => openStudentQuiz(page, F.QUIZ_C_ID) }, // 말하기 연습

  // ── s-fill (fill_blank만 켠 퀴즈 B로 곧장 진입) ─────────────────────────
  "s-fill:1": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_B_ID}/take`);
    },
  },
  "s-fill:2": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_B_ID}/take`);
      await page
        .getByPlaceholder("정답 입력")
        .first()
        .fill(F.QUIZ_B_WORDS[0])
        .catch(() => {});
      await page.waitForTimeout(300);
    },
  },
  "s-fill:3": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_B_ID}/take`);
      const revealBtn = page.getByRole("button", { name: /번역/ }).first();
      await revealBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
    },
  },

  // ── s-speak — 두 모드를 각각 단일 모드 퀴즈로 찍는다 ──
  // QuizTake가 문제를 매 로드마다 셔플하고(QuizTake.tsx:614) "다음 문제"는 녹음 후에만
  // 나타나므로(SpeakingStage.tsx:481-506), 모드를 결정적으로 고정할 방법은
  // "그 모드만 들어 있는 퀴즈"뿐이다.
  "s-speak:1": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_C_ID}/take`); // read(보고 말하기) 전용
    },
  },
  "s-speak:2": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_D_ID}/take`); // listen(듣고 말하기) 전용
      // 재생 버튼은 누르지 않는다 — 시드 오디오가 더미 URL이라 실패 토스트가 사진에 찍힌다.
      await applyHighlight(page, "보통 속도로 듣기");
    },
  },
  "s-speak:3": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_C_ID}/take`);
      await page
        .getByRole("button", { name: "힌트" })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await applyHighlight(page, "힌트");
    },
  },
  "s-speak:4": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_C_ID}/take`);
      // 녹음을 시작만 하고 멈추지 않는다(멈추면 업로드·채점이 일어난다).
      // 컨텍스트를 그대로 버리므로 DB에 남지 않는다.
      const recordBtn = page.getByRole("button").filter({ has: page.locator("svg") }).last();
      await recordBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    },
  },
  "s-speak:5": {
    role: "student1",
    run: async (page) => {
      // 실제 발음 평가는 외부 음성 API가 필요해 로컬에서 불가능하다. 대신 시드에
      // 점수가 들어 있는 결과 화면의 말하기 연습 탭을 쓴다 — 학생이 실제로 보는 화면이다.
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}/result/${F.RESULT_ID}`);
      await page
        .getByRole("tab", { name: /말하기/ })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(400);
      await scrollTo(page, "내 발음");
    },
  },

  // ── s-result ────────────────────────────────────────────────────────
  "s-result:1": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}/result/${F.RESULT_ID}`);
    },
  },
  "s-result:2": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}/result/${F.RESULT_ID}`);
      await page
        .getByRole("tab", { name: /빈칸 채우기/ })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(400);
      await scrollTo(page, F.FILL_BLANK_PROBLEMS[5].word);
    },
  },
  "s-result:3": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, `/quiz/${F.QUIZ_A_ID}/result/${F.RESULT_ID}`);
      await scrollTo(page, "방금 틀린");
    },
  },

  // ── s-notebook ──────────────────────────────────────────────────────
  "s-notebook:1": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, "/wrong-answers");
    },
  },
  "s-notebook:2": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, "/wrong-answers");
      // 감사하다는 빈칸 채우기 오답이라 펼치면 예문·번역·내 답변이 다 나온다.
      // (짝 맞추기 오답은 예문이 없어 이 단계 본문과 맞지 않는다.)
      await page.getByText("감사하다", { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    },
  },
  "s-notebook:3": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, "/wrong-answers");
      await page.getByRole("button", { name: "오답 퀴즈 만들기" }).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      // 카드 하나를 눌러 선택 상태로 만들면 하단에 "퀴즈 시작" 바가 뜬다.
      await page.getByText(F.WRONG_ANSWER_PROGRESS[1].word, { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      // 강조는 "퀴즈 시작" 버튼이 아니라 방금 고른 단어 줄에 건다. 그 버튼은 브랜드
      // 그린 플로팅 바 안에 있어서 같은 그린 테두리를 둘러도 배경에 묻혀 보이지 않았다
      // (강조 색은 DESIGN.md의 브랜드 색이라 바꾸지 않는다). 단어 줄은 흰 카드 위라
      // 테두리가 선명하고, "틀린 단어를 골라"라는 이 단계 본문과도 맞는다.
      await applyHighlight(page, F.WRONG_ANSWER_PROGRESS[1].word);
    },
  },

  // ── s-practice ──────────────────────────────────────────────────────
  "s-practice:1": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, "/wrong-answers");
      await page.getByRole("button", { name: "오답 퀴즈 만들기" }).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      await page.getByText(F.WRONG_ANSWER_PROGRESS[1].word, { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      await applyHighlight(page, "개 선택됨");
    },
  },
  "s-practice:2": {
    role: "student1",
    run: async (page) => {
      // 이전에는 localStorage에 가짜 문제를 심었는데, 앱에서 나올 수 없는 화면(보기에
      // 정답 노출)이 찍혀서 실제 선택 플로우로 바꿨다. 감사하다는 빈칸 채우기 오답이라
      // 연습에서도 빈칸 문항으로 출제된다.
      await gotoStable(page, "/wrong-answers");
      await page
        .getByRole("button", { name: "오답 퀴즈 만들기" })
        .click()
        .catch(() => {});
      await page.waitForTimeout(200);
      await page
        .getByText("감사하다", { exact: false })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(200);
      await page
        .getByRole("button", { name: "퀴즈 시작" })
        .click()
        .catch(() => {});
      await settle(page);
    },
  },
  "s-practice:3": {
    role: "student1",
    run: async (page) => {
      await gotoStable(page, "/wrong-answers");
      // 시드의 마스터 단어("학교")는 실제로 틀린 단어가 아니어서 오답노트 목록에
      // 나타나지 않는다. 대신 마스터까지 남은 횟수가 표시된 행을 강조한다 — 이
      // 단계 본문("맞을 때까지 반복해 마스터를 만듭니다")과 정확히 맞는 화면이다.
      await scrollTo(page, "마스터까지");
    },
  },
};

/** 퀴즈 상세에서 특정 유형 서브탭을 열고 편집 모드로 들어간다.
 *
 *  주의점 세 가지:
 *  1) 서브탭 버튼 이름에 문제 개수가 붙으므로("짝 맞추기 (6)") 정규식으로 잡는다.
 *  2) 버튼 안에 유형 제거용 X가 들어 있어 그냥 클릭하면 제거 확인 팝업이 뜰 수 있다.
 *     버튼 왼쪽 좌표를 찍어 X를 피한다.
 *  3) 비활성 탭의 목록도 hidden으로 DOM에 남아 "수정하기"가 최대 6개 존재한다.
 *     :visible로 좁혀야 지금 보이는 탭의 버튼을 누른다.
 *
 *  "저장하기"·"음성 재생성"·"문제 재생성"은 절대 누르지 않는다 —
 *  각각 시드 데이터 변형, 실제 TTS 엣지 함수 호출, 실패 토스트를 일으킨다. */
async function openTypeEditor(page: Page, tabName: RegExp) {
  await gotoStable(page, `/quiz/${F.QUIZ_A_ID}`);
  const tab = page.getByRole("button", { name: tabName }).first();
  await tab.click({ position: { x: 30, y: 12 } }).catch(() => {});
  await page.waitForTimeout(300);
  await page
    .locator('button:has-text("수정하기"):visible')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(400);
  // 유형 서브탭 바를 화면 위쪽에 붙인다. 그 위의 퀴즈 제목·단어 목록·상위 탭이
  // 화면 절반을 먹는 바람에 정작 설명 대상인 편집 입력칸이 사진 아래로 잘려 나갔다.
  // 서브탭 바 자체는 남겨야 어떤 유형을 편집 중인지 사진만 보고 알 수 있다.
  await scrollToStart(page, tab, 16);
}

/** 학생 계정으로 퀴즈 풀이 화면을 연다. 강조는 하지 않는다 —
 *  이 단계들은 화면 전체가 설명 대상(그 유형의 풀이 화면)이다. */
async function openStudentQuiz(page: Page, quizId: string) {
  await gotoStable(page, `/quiz/${quizId}/take`);
  await freezeAnimations(page);
}

/** 오답 복습 퀴즈 위저드 1단계 — 클래스를 골라 학생 목록이 뜬 상태까지.
 *
 *  이 화면은 왼쪽 메뉴에 없고 선생님 대시보드 카드로만 들어간다. 그리고
 *  CREATE_QUIZ 권한이 없으면 /dashboard로 리다이렉트하므로(WrongAnswerQuizCreate.tsx:614)
 *  role 판정이 늦게 끝나는 레이스에 대비해 gotoStable로 진입한다. */
async function openWrongAnswerWizard(page: Page) {
  await gotoStable(page, "/quiz/wrong-answer");
  await page.getByRole("combobox").first().click().catch(() => {});
  await page.getByRole("option", { name: F.CLASS_A.name }).click().catch(() => {});
  // 클래스를 고르면 학생 목록을 비동기로 불러온다. 고정 200ms로는 부족해서
  // "학생 (0명 선택됨)" 상태로 남고 '다음 · 문제로'가 계속 비활성이었다.
  await settle(page);
}

/** 위저드 2단계(단어별 오답 집계)까지 진행한다. 학생은 '전체 선택'으로 모두 고른다. */
async function openWrongAnswerStep2(page: Page) {
  await openWrongAnswerWizard(page);
  // check()가 아니라 click() — Radix Checkbox는 <input>이 아니라 button[role=checkbox]라
  // Playwright의 check()가 실패했고, 그래서 학생이 0명 선택된 채로 진행이 막혔다.
  // 첫 체크박스가 '전체 선택'이다(학생 목록 위의 구분선 안).
  await page.getByRole("checkbox").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /다음 · 문제로/ }).click({ timeout: 5000 }).catch(() => {});
  await settle(page);
}

async function profileStep1(page: Page) {
  await page.goto("/profile/settings");
  await settle(page);
}
async function profileStep2(page: Page) {
  await page.goto("/profile/settings");
  await settle(page);
  await scrollTo(page, "학습 목표");
}
async function profileStep3(page: Page) {
  await page.goto("/profile/settings");
  await settle(page);
  await scrollTo(page, "테마 설정");
}
