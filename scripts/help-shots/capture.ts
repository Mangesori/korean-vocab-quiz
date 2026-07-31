/**
 * 도움말 센터 스크린샷 캡처 실행기.
 *
 * 로컬 Supabase(`npx supabase start`)와 시드 데이터(scripts/help-shots/seed.ts)가
 * 이미 준비된 상태에서 실행한다.
 *
 * 순서: .env.capture로 vite dev 서버(mode=capture, 로컬 Supabase를 바라봄)를 띄우고 →
 * 선생님/학생1 계정으로 각각 로그인해 storageState를 저장 → src/data/help의 ARTICLES에
 * 선언된 모든 steps[n].shot을 순회하며 recipes.ts에서 대응하는 레시피를 찾아 실행 →
 * 사이드바를 접고 헤더만 제외한 16:9 영역을 스크린샷 → sharp로 리사이즈·압축해
 * public/help/에 저장.
 *
 * 실행: npx tsx scripts/help-shots/capture.ts
 */
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTICLES } from "../../src/data/help/articles";
import { shotPath, type HelpArticleId } from "../../src/data/help";
import { RECIPES, type Role } from "./recipes";
import * as F from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PUBLIC_HELP_DIR = path.join(ROOT, "public", "help");
const AUTH_DIR = path.join(__dirname, ".auth");

// 캡처 규격. 잘라낸 결과가 항상 16:9(=1280x720)가 되도록, 뷰포트를 잘라낼 헤더 높이만큼
// 더 크게 잡는다. 64px은 가장 두꺼운 헤더(랜딩·도움말의 LandingHeader h-16) 기준이고,
// AppLayout(h-14=56px)은 8px 여유가 남는다.
const VIEWPORT_WIDTH = 1280;
const CLIP_HEIGHT = 720;
const VIEWPORT_HEIGHT = CLIP_HEIGHT + 64;

// 인자로 문서 id를 주면 그 문서만 캡처한다(예: npx tsx scripts/help-shots/capture.ts t-firstquiz).
// 한 문서만 반복 확인할 때 전체 슬롯을 다시 돌리지 않아도 된다.
const ONLY_ARTICLES = process.argv.slice(2).filter((a) => !a.startsWith("-"));

function log(...args: unknown[]) {
  console.log(...args);
}

async function waitForServer(url: string, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // 아직 안 뜸
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev 서버가 ${timeoutMs}ms 안에 응답하지 않았다: ${url}`);
}

// Windows에서 { shell: true }로 띄운 프로세스는 child.kill()이 npx 래퍼만 죽이고
// 그 아래 실제 vite 서버는 살려둔 채 포트를 계속 물고 있는다(다음 실행이 "포트 사용 중"으로
// 실패하는 원인). taskkill /T로 프로세스 트리 전체를 죽인다.
function killServerTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill();
  }
}

function startDevServer(): ChildProcess {
  const child = spawn(
    "npx",
    ["vite", "--mode", "capture", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout?.on("data", (d) => {
    const s = d.toString();
    if (/error/i.test(s)) log("[vite]", s.trim());
  });
  child.stderr?.on("data", (d) => log("[vite:err]", d.toString().trim()));
  return child;
}

async function loginAndSaveState(browser: Browser, email: string, password: string, outFile: string) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/auth");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await context.storageState({ path: outFile });
  await context.close();
  log(`  - 로그인 완료: ${email} → ${path.basename(outFile)}`);
}

async function runRecipe(
  browser: Browser,
  role: Role,
  storageStatePath: string | undefined,
  run: (page: Page) => Promise<void>,
): Promise<Buffer> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1.5,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "light",
    reducedMotion: "reduce",
    storageState: storageStatePath,
    permissions: role === "student1" ? ["microphone"] : undefined,
  });
  // 사이드바를 접은 상태로 첫 렌더부터 그린다. 예전에는 사이드바를 펼친 채 찍고
  // 사진에서 그 폭만큼 잘라냈는데, 그러면 화면 정중앙에 뜨는 팝업이 잘라낸 사진에서는
  // 늘 왼쪽으로 치우쳐 보였다. AppSidebar는 collapsible 기본값이 "offcanvas"라
  // 접으면 화면 밖으로 완전히 나가고 main이 뷰포트 전체 폭을 차지한다.
  //
  // 버튼을 클릭하지 않고 쿠키를 심는 이유: sidebar.tsx가 이 쿠키를 useState의
  // lazy initializer에서 동기로 읽으므로 열림→닫힘 트랜지션(200ms)이 아예 발생하지
  // 않는다. 클릭 방식은 reducedMotion으로도 트랜지션이 꺼지지 않아 임의 대기가 붙는다.
  // 쿠키명에 ':'이 들어가 addCookies의 토큰 검증에 걸릴 수 있어 앱과 같은 경로를 쓴다.
  await context.addInitScript(() => {
    document.cookie = "sidebar:state=false; path=/";
  });
  const page = await context.newPage();
  try {
    await run(page);
    // 상단 헤더만 잘라내고 폭은 전체를 쓴다(사이드바는 접혀 있어 main이 x=0에서 시작).
    // 높이를 CLIP_HEIGHT로 고정하는 게 핵심이다 — 도움말의 사진 액자는 16:9 고정
    // (HelpStepShot의 aspect-video + object-cover)인데, 잘라내는 높이를 화면마다
    // 다르게 두면 종횡비가 어긋나 위아래(또는 좌우)가 액자에서 잘려나간다.
    // 뷰포트를 CLIP_HEIGHT보다 헤더 높이만큼 크게 잡아둔 덕에 항상 16:9가 남는다.
    const content = page.locator("header + main").first();
    const box = (await content.count()) > 0 ? await content.boundingBox() : null;
    // boundingBox는 뷰포트 기준이라 스크롤된 화면에서는 main의 top이 음수가 된다
    // (헤더가 sticky가 아니라 위로 스크롤 아웃됨). 0으로 클램프해야 clip이 유효하다.
    // header + main 구조가 아닌 화면(퀴즈 풀이 등, 상단바가 div.sticky)은 y=0이다.
    const y = box ? Math.max(0, Math.round(box.y)) : 0;
    return await page.screenshot({
      clip: { x: 0, y, width: VIEWPORT_WIDTH, height: CLIP_HEIGHT },
    });
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(PUBLIC_HELP_DIR, { recursive: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  log("dev 서버 기동 중 (mode=capture, 로컬 Supabase)...");
  const server = startDevServer();
  try {
    await waitForServer(BASE_URL);
    log(`dev 서버 준비 완료: ${BASE_URL}`);

    const browser = await chromium.launch({
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    });

    try {
      log("\n로그인 세션 준비");
      const teacherAuth = path.join(AUTH_DIR, "teacher.json");
      const student1Auth = path.join(AUTH_DIR, "student1.json");
      await loginAndSaveState(browser, F.TEACHER.email, F.SEED_PASSWORD, teacherAuth);
      await loginAndSaveState(browser, F.STUDENT1.email, F.SEED_PASSWORD, student1Auth);

      // 선언된 shot 슬롯 전부 수집
      const declared: { key: string; articleId: string; step: number }[] = [];
      for (const [id, article] of Object.entries(ARTICLES)) {
        if (ONLY_ARTICLES.length > 0 && !ONLY_ARTICLES.includes(id)) continue;
        (article.steps as readonly { shot?: unknown }[]).forEach((step, i) => {
          if (step.shot) declared.push({ key: `${id}:${i + 1}`, articleId: id, step: i + 1 });
        });
      }

      // 문서 필터가 걸린 상태에서는 다른 문서의 레시피가 전부 "고아"로 잡히므로
      // 필터가 없을 때만 검사한다.
      const orphanRecipes = Object.keys(RECIPES).filter((k) => !declared.some((d) => d.key === k));
      if (ONLY_ARTICLES.length === 0 && orphanRecipes.length) {
        log(`\n⚠ 선언되지 않은 레시피 (articles.ts에 shot이 없음): ${orphanRecipes.join(", ")}`);
      }

      log(
        `\n캡처 시작 — 선언된 슬롯 ${declared.length}개` +
          (ONLY_ARTICLES.length > 0 ? ` (문서 필터: ${ONLY_ARTICLES.join(", ")})` : ""),
      );
      const succeeded: string[] = [];
      const skipped: string[] = [];
      const failed: { key: string; error: string }[] = [];

      for (const { key, articleId, step } of declared) {
        const recipe = RECIPES[key];
        if (!recipe) {
          skipped.push(key);
          log(`  - ${key}: 레시피 없음 (건너뜀)`);
          continue;
        }
        const authFile =
          recipe.role === "teacher" ? teacherAuth : recipe.role === "student1" ? student1Auth : undefined;
        try {
          const raw = await runRecipe(browser, recipe.role, authFile, recipe.run);
          const fileName = path.basename(shotPath(articleId as HelpArticleId, step));
          const outPath = path.join(PUBLIC_HELP_DIR, fileName);
          await sharp(raw).resize({ width: 1600 }).png({ quality: 80, effort: 10, palette: true }).toFile(outPath);
          succeeded.push(key);
          log(`  ✓ ${key}`);
        } catch (err) {
          failed.push({ key, error: err instanceof Error ? err.message : String(err) });
          log(`  ✗ ${key}: ${err instanceof Error ? err.message : err}`);
        }
      }

      log(`\n완료 — 성공 ${succeeded.length} / 레시피없음 ${skipped.length} / 실패 ${failed.length}`);
      if (failed.length) {
        log("\n실패 목록:");
        failed.forEach((f) => log(`  - ${f.key}: ${f.error}`));
      }
    } finally {
      await browser.close();
    }
  } finally {
    killServerTree(server);
  }
}

main().catch((err) => {
  console.error("캡처 실패:", err);
  process.exit(1);
});
