/**
 * 프롬프트의 `DIFFICULTY_GUIDES` 전수 대조 (로컬 전용)
 *
 * 배경: 실제 생성물 측정에서 **AI가 프롬프트를 정확히 따랐는데도 등급을 넘는** 현상이
 * 나왔다. 이 스크립트는 가이드의 모든 문법 항목을 등급 목록과 대조해 오배정을 찾는다.
 *
 * 기준은 **서울대 한국어 1A~6B 문법 목록**이다(grammar.json, scripts/data/snu-grammar.ts).
 * 처음엔 국립국어원 「국제 통용 한국어 표준 교육과정」을 썼는데, 그건 이론적 표준이라
 * 실제 교실 순서와 어긋났다 — `-(으)면`을 A2, `-아야/어야 되다`를 B1으로 잡는 식이라
 * 이 스크립트가 초급 필수 문법을 "등급 초과"로 잘못 지목했다.
 *
 * ── 두 방향을 모두 본다 ──────────────────────────────────────────────
 *
 *   정방향: 프롬프트의 각 항목 → 기준표 조회 → 목표 등급을 넘나?   (등급 초과)
 *   역방향: 기준표의 해당 급 항목 → 프롬프트 목록에 있나?          (누락 / 흩어짐)
 *
 * 정방향만 있으면 **"초과 0건"이 "충분하다"로 오독된다.** 목록이 비어 있어도 초과는
 * 0이다. 실제로 서울대 기준으로 초과를 0으로 만든 뒤에도 교사가 "A2 문법이 너무 적다"고
 * 지적했고 사실이었다(서울대는 급당 58~99항목, 프롬프트는 37~51항목). 그래서 역방향을
 * 붙였다.
 *
 * 이형태 슬래시는 반드시 `expandSlash`로 전개한다. 단순 `split("/")`을 쓰면
 * `-아야/어야 해요`가 `아`+`어야 해요`로 쪼개져 `-어야`(단독 연결어미)에 오매칭되고,
 * 그 결과 사용 빈도 1위 항목을 잘못 고칠 뻔했다. 이 파일의 회귀 방지 지점이다.
 *
 * Edge Function은 Deno URL import를 쓰므로 import하지 않고 소스에서 정규식으로 뽑는다.
 *
 * 실행: npx tsx scripts/audit-grammar-guide.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expandSlash,
  flattenOptionalParens,
  stripPosPrefix,
  stripTrailingPosToken,
  toDictionaryForm,
} from "./lib/grammar-notation.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "supabase", "functions", "generate-quiz", "index.ts");
const ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Cefr = (typeof ORDER)[number];

const grammarData = JSON.parse(
  readFileSync(join(HERE, "..", "src", "lib", "korean", "data", "grammar.json"), "utf8")
) as {
  builtAt?: string;
  items: { form: string; grade: number; aliases: string[]; category: string }[];
};

function grammarKeys(s: string): string[] {
  const raw = s.trim().replace(/<[^>]*>/g, "").trim();
  const base = raw
    .replace(/^[-\s]+/, "")
    .replace(/[-\s?!.]+$/, "")
    .trim();
  if (!base) return [];
  /**
   * **1글자 키는 어미와 조사를 반드시 갈라야 한다.**
   *
   * 어미 표기는 하이픈으로 시작하고(`-는` 관형사형) 조사는 안 붙인다(`는` 주제).
   * 하이픈을 무조건 떼면 둘이 같은 `는` 키가 되어, 기준표의 `V-는 N`(A2)이
   * 프롬프트 A1의 주제 조사 `은/는`에 걸려 **"A1에 A2 문법이 있다"는 가짜 등급 초과**가
   * 났다(실측). 2글자 이상은 이런 충돌이 없으니 지금처럼 하이픈을 뗀다 —
   * 프롬프트가 `-(으)면`처럼 하이픈을 붙이고 기준표가 `(으)로`처럼 안 붙이는
   * 표기 흔들림이 실제로 있기 때문이다.
   */
  const head = base.length === 1 && raw.startsWith("-") ? `-${base}` : base;
  const v = new Set<string>([head]);
  /**
   * 파생 변이형은 **2글자 이상일 때만** 채택한다.
   * 형태 괄호를 지우면 `(이)나`→`나`, `-(으)나`→`나` 처럼 서로 다른 문법이
   * 같은 1글자 키로 무너져 오매칭된다(실측: `(이)나`(A2 나열)와 `-(으)나`(B2 대조)가
   * 한 항목으로 잡혔다). 원형이 원래 1글자인 항목(`에`·`의`·`안`·`못`)은
   * `base`로 이미 들어가 있으므로 이 제한에 걸리지 않는다.
   */
  const derive = (x: string) => {
    const t = x.replace(/\s+/g, " ").trim();
    if (t.length >= 2) v.add(t);
  };

  /**
   * 구멍 ② — 괄호를 **종류별로** 처리한다.
   *
   * 먼저 선택 괄호(`(도)`·`(요)`·`(서)`…)의 괄호 문자만 지우고 내용은 남긴다.
   * 그러면 남은 괄호는 형태 괄호(`(으)`·`(이)`)뿐이므로, 아래 세 파생이
   * 각각 "뺀 형태 / 넣은 형태 / 자모 결합형"이 된다.
   *
   *   -(으)면서(도) → (으)면서도 → 면서도 · 으면서도 · 은/을… 해당없음
   *   -거든(요)     → 거든요     → (형태 괄호 없음, 전부 "거든요")
   *
   * 예전처럼 괄호 안을 통째로 지우는 파생은 **만들지 않는다.** 그게
   * `-(으)면서(도)`(C2)를 `-(으)면서`(A2)에, `-거든(요)`를 `-거든`(B2)에
   * 붙여 버린 원인이다.
   */
  const flat = flattenOptionalParens(base);
  derive(flat);
  derive(flat.replace(/\((으|이)\)/g, "")); // 형태 괄호 뺀 형태 (받침 없는 어간)
  derive(flat.replace(/[()]/g, "")); // 형태 괄호 넣은 형태 (받침 있는 어간)
  derive(
    flat
      .replace(/\(으\)ㄴ/g, "은").replace(/\(으\)ㄹ/g, "을")
      .replace(/\(으\)ㅁ/g, "음").replace(/\(으\)ㅂ/g, "읍")
      .replace(/\(이\)/g, "이")
  );
  return [...v].map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * **정방향과 역방향이 공유하는 단 하나의 키 생성 규칙.**
 *
 * 한쪽만 `expandSlash`를 쓰면 두 방향의 결과가 서로 모순된다 —
 * 정방향은 "미확인"인데 역방향은 "이 등급에 있음"으로 잡히는 식이다.
 * 기준표 쪽(`GRAMMAR`)도, 프롬프트 쪽(`PROMPT_INDEX`)도, 역방향 대조도
 * 전부 이 함수 하나만 쓴다.
 */
function keySet(s: string): Set<string> {
  const out = new Set<string>();
  for (const alt of expandSlash(s).map((x) => x.trim()).filter(Boolean)) {
    /**
     * 한 항목에서 뽑는 표기 변형들. **원형은 항상 남긴다** — 아래 변형은 전부
     * "추가 후보"이지 "대체"가 아니다. 대체로 쓰면 표기 해석이 어긋난 순간
     * 조용히 틀린 매칭이 된다.
     */
    const forms = new Set<string>([alt]);

    // 구멍 ① — 끝의 수식받는 품사 토큰(`A-(으)ㄴ N` → `A-(으)ㄴ`).
    for (const f of [...forms]) {
      const t = stripTrailingPosToken(f);
      if (t) forms.add(t);
    }
    // 품사 접두 제거. 로마자(`N(이)라고 하다` → `(이)라고 하다`)와
    // 한국어(`형용사+-(으)ㄴ` → `-(으)ㄴ`) 양쪽. 기준표는 빌드 때 로마자 접두가
    // 이미 떨어져 있고 프롬프트는 한국어로 쓰므로, 둘 다 여기서 만나게 한다.
    // 끝 토큰을 먼저 뗀 뒤라야 `A-(으)ㄴ N`이 접두 제거의 안전장치에 걸리지 않는다.
    for (const f of [...forms]) {
      const bare = stripPosPrefix(f);
      if (bare !== f) forms.add(bare);
    }
    // 구멍 ③ — 활용형을 사전형/접사형으로. 명시적 대응표에 있는 것만 바뀐다.
    for (const f of [...forms]) {
      const dict = toDictionaryForm(f);
      if (dict !== f) forms.add(dict);
    }

    for (const f of forms) for (const k of grammarKeys(f)) out.add(k);
  }
  return out;
}

const GRAMMAR = new Map<string, number>();
/**
 * 결합형 폴백을 적용할 수 있는 앞조각 = 선어말어미(-았-, -었-, -겠-, -으시-).
 * 아무 위치에서나 쪼개면 `여기` → `여`+`기` 처럼 문법이 아닌 어휘까지 매칭된다(실측 오탐).
 *
 * 주의: 서울대 목록에는 `category`가 없어(빈 문자열) 이 집합은 **비어 있다.**
 * 그래도 문제가 없다 — 서울대 목록은 선어말어미를 단독 항목으로 싣지 않고
 * `-았/었어요`처럼 결합된 종결형으로 싣기 때문에, 애초에 쪼갤 필요가 없다.
 * 집합이 비면 아래 폴백 루프가 자연히 돌지 않으므로 코드는 그대로 둔다.
 * (국립국어원 목록으로 되돌릴 일이 생기면 이 집합이 다시 채워진다.)
 */
const PREFINAL = new Set<string>();
for (const item of grammarData.items) {
  for (const form of [item.form, ...item.aliases]) {
    for (const k of keySet(form)) {
      const prev = GRAMMAR.get(k);
      if (prev === undefined || item.grade < prev) GRAMMAR.set(k, item.grade);
      if (item.category.includes("선어말")) PREFINAL.add(k);
    }
  }
}

/** 어떤 키로 매칭됐는지도 돌려준다 — 프로덕션 프롬프트를 고치기 전에 근거를 눈으로 확인해야 한다. */
function lookup(fragment: string): { grade: number; via: string } | undefined {
  let best: { grade: number; via: string } | undefined;
  const take = (g: number | undefined, via: string) => {
    if (g !== undefined && (best === undefined || g < best.grade)) best = { grade: g, via };
  };
  for (const k of keySet(fragment)) take(GRAMMAR.get(k), k);
  if (best !== undefined) return best;
  // 결합형 폴백 (선어말어미 + 종결어미)
  for (const alt of expandSlash(fragment).map((s) => s.trim()).filter(Boolean)) {
    const base = alt.trim().replace(/^[-\s]+/, "").replace(/[-\s?!.]+$/, "");
    for (let i = 1; i < base.length; i++) {
      const lk = base.slice(0, i);
      if (!PREFINAL.has(lk)) continue; // 선어말어미로 시작할 때만 분해
      const l = GRAMMAR.get(lk);
      const r = GRAMMAR.get(base.slice(i));
      if (l !== undefined && r !== undefined) take(Math.max(l, r), `${lk}+${base.slice(i)}`);
    }
  }
  return best;
}

// ── 가이드 파싱 ──────────────────────────────────────────────────────
const src = readFileSync(SRC, "utf8");
/** `"A1": \`...\`,` 형태의 템플릿 리터럴을 등급별로 뽑는다 */
function extractGuides(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/"(A1|A2|B1|B2|C1|C2)":\s*`([\s\S]*?)`/g)) out[m[1]] = m[2];
  return out;
}

/**
 * 항목 끝의 설명 괄호만 떼어낸다. `(으)`·`(이)` 같은 형태 표기는 남긴다.
 *
 * 안쪽에 **슬래시·쉼표·공백·느낌표**가 들어간 설명도 떼야 한다.
 * 예전 정규식(`\([가-힣]{2,}\)$`)은 한글만 허용해서 `에(위치/시간)`·`이/가(주어/아니다)`·
 * `(으)로(방향/수단)`·`-(으)ㄹ까 봐(걱정/이유)`·`-(으)ㄹ (필수!)`가 통째로 남았고,
 * 그 결과 이 항목들이 전부 정방향 `미확인` + 역방향 `어디에도 없음`으로 이중 계상됐다.
 * (A1 조사 대부분이 여기 걸렸다 — 사각지대의 가장 큰 단일 원인이었다.)
 *
 * 첫 글자는 반드시 한글이고 안쪽 길이가 2 이상이어야 한다 →
 * `(으)`·`(이)`·`(요)`·`(도)` 같은 1글자 형태 표기는 그대로 살아남는다.
 *
 * **띄어 쓴 괄호는 건드리지 않는다.** 설명 괄호는 항목에 붙여 쓰지만
 * (`-네요(감탄)`·`(으)로(방향/수단)`), 띄어 쓴 괄호는 문법 표기의 일부다 —
 * `-(으)ㄹ걸 (그랬다)`·`-(으)ㄹ 겸 (해서)`는 기준표 표기와 글자까지 같다.
 * 이걸 떼면 선택 괄호 규칙(구멍 ②)과 맞물려 기준표의 `-(으)ㄹ걸 (그랬다)`가
 * 프롬프트에 있는데도 `어디에도 없음`으로 잡힌다.
 * 단 `(필수!)` 같은 **편집 지시**는 띄어 썼어도 항목이 아니므로 뗀다(느낌표로 식별).
 */
const stripAnnotation = (s: string) =>
  s
    .replace(/\s*\([^)]*![^)]*\)\s*$/, "") // 편집 지시: -(으)ㄹ (필수!)
    .replace(/(?<=\S)\([가-힣][가-힣/·,\s!]+\)\s*$/, "") // 붙여 쓴 설명 괄호
    .trim();

/** 문법 항목이 아닌 줄(어휘·길이·자유서술)은 건너뛴다 */
const SKIP_LABEL = /^(길이|어휘|사용 가능|문법)$/;

function parseItems(guide: string): { label: string; item: string }[] {
  const out: { label: string; item: string }[] = [];
  for (const line of guide.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("- ")) continue;
    const body = t.slice(2);
    const colon = body.indexOf(":");
    if (colon < 0) continue;
    const label = body.slice(0, colon).trim();
    if (SKIP_LABEL.test(label)) continue;
    for (const raw of body.slice(colon + 1).split(",")) {
      // `&`는 프롬프트가 한 칸에 여러 항목을 욱여넣을 때 쓰는 구분자다
      // (`부터&까지`, `한테&께`, `하고&와/과`, `위&아래&앞&뒤`).
      // 예전엔 통째로 **버렸는데**, 그 바람에 `부터`·`까지`·`한테`·`께`·`하고` 같은
      // 실제 A1 조사가 감사에서 사라져 역방향이 "프롬프트에 없다"고 오보했다.
      // 버리지 말고 쪼갠다. 문법이 아닌 조각(`위`·`아래`)은 `미확인`으로 드러나면 된다
      // — 조용히 사라지는 것보다 미확인으로 보이는 게 낫다.
      for (const piece of stripAnnotation(raw).split("&")) {
        const item = piece.trim();
        if (item) out.push({ label, item });
      }
    }
  }
  return out;
}

// ── 전 등급 역색인 ───────────────────────────────────────────────────
/**
 * 6개 가이드를 **먼저 전부** 파싱해 `정규화키 → 그 키가 등장하는 등급들`을 만든다.
 *
 * 등급별로 따로 처리하면 "이 문법이 다른 등급 목록에 있다"를 알 수 없다.
 * 그러면 역방향에서 `흩어짐(이동해야 함)`과 `완전 누락(추가해야 함)`을 못 가르는데,
 * 이 둘은 처방이 완전히 다르다.
 *
 * 한 키가 여러 등급에 나올 수 있다(`-(으)ㄴ`·`-는` 관형사형은 B1/B2/C1에 모두 있다).
 * 그래서 값이 `Set<Cefr>`이다.
 */
const guides = extractGuides();
const parsedGuides = new Map<Cefr, { label: string; item: string }[]>();
const PROMPT_INDEX = new Map<string, Set<Cefr>>();

for (const level of ORDER) {
  const guide = guides[level];
  if (!guide) continue;
  const items = parseItems(guide);
  parsedGuides.set(level, items);
  for (const { item } of items) {
    for (const k of keySet(item)) {
      let set = PROMPT_INDEX.get(k);
      if (!set) PROMPT_INDEX.set(k, (set = new Set()));
      set.add(level);
    }
  }
}

// ── 정방향: 프롬프트 항목이 목표 등급을 넘나 ─────────────────────────
console.log("\n═══ DIFFICULTY_GUIDES vs 서울대 한국어 문법 등급 대조 ═══");
console.log(`기준표 빌드 시각: ${grammarData.builtAt ?? "(불명)"}  |  기준표 항목 ${grammarData.items.length}개\n`);

const summary: Record<
  string,
  {
    total: number; ok: number; over: number; unknown: number;
    refTotal: number; here: number; elsewhere: number; missing: number;
  }
> = {};

/** 정방향 미확인 목록 — 역방향 `어디에도 없음`과 교차하려고 전역에 모아 둔다. */
const allUnknown: { level: Cefr; item: string; label: string }[] = [];
/** 역방향 완전 누락 목록 — 위와 교차한다. */
const allMissing: { level: Cefr; form: string }[] = [];

for (const level of ORDER) {
  const items = parsedGuides.get(level);
  if (!items) continue;
  const target = ORDER.indexOf(level) + 1;

  const over: { item: string; grade: number; label: string; via: string }[] = [];
  const unknown: { item: string; label: string }[] = [];
  let ok = 0;

  for (const { label, item } of items) {
    const hit = lookup(item);
    if (hit === undefined) unknown.push({ item, label });
    else if (hit.grade > target) over.push({ item, grade: hit.grade, label, via: hit.via });
    else ok++;
  }
  for (const u of unknown) allUnknown.push({ level, ...u });

  // ── 역방향: 기준표의 이 급 항목이 프롬프트에 있나 ──
  const ref = grammarData.items.filter((i) => i.grade === target);
  const here: string[] = [];
  const elsewhere: { form: string; levels: Cefr[] }[] = [];
  const missing: string[] = [];

  for (const item of ref) {
    const keys = new Set<string>();
    for (const f of [item.form, ...item.aliases]) for (const k of keySet(f)) keys.add(k);
    const found = new Set<Cefr>();
    for (const k of keys) for (const lv of PROMPT_INDEX.get(k) ?? []) found.add(lv);

    if (found.has(level)) here.push(item.form);
    else if (found.size) {
      elsewhere.push({ form: item.form, levels: ORDER.filter((l) => found.has(l)) });
    } else missing.push(item.form);
  }
  for (const m of missing) allMissing.push({ level, form: m });

  summary[level] = {
    total: items.length, ok, over: over.length, unknown: unknown.length,
    refTotal: ref.length, here: here.length, elsewhere: elsewhere.length, missing: missing.length,
  };

  console.log(`━━ ${level} (프롬프트 ${items.length}항목 / 기준표 ${ref.length}항목) ━━`);
  console.log(`   [정방향] 기준 이하 ${ok}   등급 초과 ${over.length}   미확인 ${unknown.length}`);
  if (over.length) {
    console.log(`   ⚠ 등급 초과 — 이 항목들이 ${level} 목록에 있으면 안 된다:`);
    for (const o of over.sort((a, b) => b.grade - a.grade))
      console.log(
        `       ${o.item.padEnd(22)} → ${ORDER[o.grade - 1]}  [${o.label}]  매칭키="${o.via}"`
      );
  }
  if (unknown.length) {
    console.log(`   ? 미확인 (목록 표기 차이일 수 있음): ${unknown.map((u) => u.item).join(", ")}`);
  }

  console.log(
    `   [역방향] 이 등급에 있음 ${here.length}   다른 등급에 있음 ${elsewhere.length}   어디에도 없음 ${missing.length}`
  );
  if (elsewhere.length) {
    console.log(`   ↔ 다른 등급에 있음 — 흩어졌다. ${level}로 옮길지 판단할 것:`);
    for (const e of elsewhere)
      console.log(`       ${e.form.padEnd(26)} → 현재 ${e.levels.join("·")} 목록에 있음`);
  }
  if (missing.length) {
    console.log(`   ✗ 어디에도 없음 — 6개 가이드 전체에 없다. 추가 후보 ${missing.length}건:`);
    for (const m of missing) console.log(`       ${m}`);
  }
  console.log("");
}

// ── 느슨한 매칭: 미확인 × 어디에도 없음 교차 ─────────────────────────
/**
 * ⚠ **이 절은 보고 전용이다. 절대 판정(등급 초과/누락 결정)에 쓰지 말 것.**
 *
 * 이유: 느슨하게 자르면 조용히 틀린다. 과거에 `-아야/어야 해요`를 `-어야`(단독
 * 연결어미, B1)에 오매칭시켜 "A1 목록에 B1 문법이 있다"는 오판을 냈다. 사용 빈도
 * 1위 항목이라 그대로 고쳤으면 프로덕션 프롬프트를 잘못 고칠 뻔했다.
 * 그래서 정식 판정은 위쪽의 엄격한 `keySet()` 교집합만 쓰고, 여기서는
 * **사람이 눈으로 확인할 후보 쌍만** 뽑는다.
 *
 * 이 절이 필요한 이유는 그 반대쪽 위험 때문이다 — `미확인`은 "판정 못 함"인데
 * 실무에서 "통과"처럼 취급돼 왔다. 등급별 미확인 수가 그대로 사각지대 크기다.
 * 미확인 항목이 사실은 역방향 `어디에도 없음` 항목과 **같은 문법의 다른 표기**라면,
 * 둘 다 유령이다(프롬프트에는 있는데 감사에 안 잡히고, 기준표에는 있는데 누락으로 잡힘).
 */
const CONJUGATION_TAIL = /(습니다|ㅂ니다|이에요|예요|어요|아요|해요|하다|되다|이다|다|요)$/;

function looseForms(s: string): Set<string> {
  const out = new Set<string>();
  for (const alt of expandSlash(s).map((x) => x.trim()).filter(Boolean)) {
    for (const k of grammarKeys(alt)) {
      const flat = k.replace(/\s+/g, ""); // 공백 무시
      const cands = new Set<string>([
        flat,
        flat.replace(/\([^)]*\)/g, ""),     // (으)·(이) 통째로 제거
        flat.replace(/[()]/g, ""),          // 괄호만 제거
        flat.replace(/\[[^\]]*\]/g, ""),    // 대괄호 대체형 제거
        flat.replace(/[()\[\]]/g, ""),
      ]);
      for (const c of [...cands]) {
        let t = c;
        for (let i = 0; i < 2 && t.length > 2; i++) {
          const n = t.replace(CONJUGATION_TAIL, ""); // 활용어미 제거
          if (n === t || n.length < 2) break;
          t = n;
        }
        cands.add(t);
      }
      for (const c of cands) if (c.length >= 2) out.add(c);
    }
  }
  return out;
}

const pairs: { unknown: (typeof allUnknown)[number]; missing: (typeof allMissing)[number]; how: string }[] = [];
for (const u of allUnknown) {
  const uf = looseForms(u.item);
  for (const m of allMissing) {
    const mf = looseForms(m.form);
    let how = "";
    for (const a of uf) {
      if (mf.has(a)) { how = `동일="${a}"`; break; }
    }
    if (!how) {
      // 접두 일치는 **짧은 쪽에 완성형 음절이 2개 이상 + 길이차 2 이하**일 때만 본다.
      // 관형사형 `-(으)ㄴ`·`-는`·`-(으)ㄹ`은 음절이 1개뿐이라(`으`) 여기서 걸러진다.
      // 이 조건이 없으면 그 셋이 같은 자모로 시작하는 기준표 항목 수십 개와 전부
      // 짝지어져(실측 128쌍 중 100쌍이 이 셋이었다) 진짜 후보가 파묻힌다.
      const syl = (x: string) => (x.match(/[가-힣]/g) ?? []).length;
      outer: for (const a of uf) {
        for (const b of mf) {
          const [short, long] = a.length <= b.length ? [a, b] : [b, a];
          if (syl(short) < 2 || long.length - short.length > 2) continue;
          if (long.startsWith(short)) { how = `접두="${short}"`; break outer; }
        }
      }
    }
    if (how) pairs.push({ unknown: u, missing: m, how });
  }
}

console.log("═══ 표기 불일치 후보 (느슨한 매칭 — 보고 전용, 판정에 쓰지 말 것) ═══");
console.log("정방향 '미확인' × 역방향 '어디에도 없음' 교차. 같은 문법의 다른 표기라면 둘 다 유령이다.\n");
if (!pairs.length) {
  console.log("   (후보 없음)\n");
} else {
  for (const p of pairs) {
    const flag = p.unknown.level === p.missing.level ? "  " : "⚠ "; // 등급이 다르면 더 의심스럽다
    console.log(
      `   ${flag}프롬프트[${p.unknown.level}] ${p.unknown.item.padEnd(24)} ~ 기준표[${p.missing.level}] ${p.missing.form.padEnd(24)} ${p.how}`
    );
  }
  console.log(`\n   총 ${pairs.length}쌍. 사람이 확인해 표기를 통일할 것.\n`);
}

// ── 요약 ─────────────────────────────────────────────────────────────
console.log("═══ 요약 ═══");
console.log("                 ── 정방향(프롬프트→기준표) ──   ── 역방향(기준표→프롬프트) ──");
console.log("등급   프롬프트   기준이하   초과   미확인   기준표   있음   다른등급   없음");
for (const level of ORDER) {
  const s = summary[level];
  if (!s) continue;
  console.log(
    `${level.padEnd(6)} ${String(s.total).padStart(6)} ${String(s.ok).padStart(10)} ${String(s.over).padStart(6)} ${String(s.unknown).padStart(8)} ` +
    `${String(s.refTotal).padStart(8)} ${String(s.here).padStart(6)} ${String(s.elsewhere).padStart(10)} ${String(s.missing).padStart(6)}`
  );
}
console.log("");
console.log("※ '초과 0'은 '어렵지 않다'는 뜻일 뿐 '충분하다'는 뜻이 아니다. 목록이 비어도 초과는 0이다.");
console.log("※ '미확인'은 '통과'가 아니라 '판정 못 함'이다. 그 수가 곧 사각지대 크기다.");
console.log("");
