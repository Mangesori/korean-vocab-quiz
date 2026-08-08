/**
 * 어휘 등급 커버리지 + 통사 지표 측정 (로컬 전용 상시 도구)
 *
 * 교사 UI에 배지를 만들지 않기로 했으므로, 이 스크립트가 등급 통제 상태를 재는
 * **유일한 계측기**다. 프롬프트를 고칠 때마다 다시 돌려 전후를 비교한다.
 *
 * 측정 대상은 "선생님이 입력한 단어를 뺀 나머지 어휘"다.
 * 난이도 A2를 골랐다면 입력 단어가 C1이어도 상관없고, 그 단어로 만든 문장에
 * 함께 들어간 다른 단어가 A2 이하면 된다.
 *
 * 실행:
 *   $env:SUPABASE_URL=...; $env:SUPABASE_SERVICE_KEY=...; $env:KIWI_MODEL_DIR=...
 *   npx tsx scripts/measure-baseline.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as kiwiNlpNs from "kiwi-nlp";
import { expandSlash } from "./lib/grammar-notation.ts";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

// CJS/ESM interop — 심볼이 최상위 또는 .default 아래에 온다.
const kiwiNlp: any = (kiwiNlpNs as any).KiwiBuilder ? kiwiNlpNs : (kiwiNlpNs as any).default;
const { KiwiBuilder } = kiwiNlp;

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, KIWI_MODEL_DIR } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !KIWI_MODEL_DIR) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY / KIWI_MODEL_DIR 환경변수가 필요합니다.");
  process.exit(1);
}

// ── 등급 데이터 ────────────────────────────────────────────────────────
const vocabData = JSON.parse(
  readFileSync(join(HERE, "..", "src", "lib", "korean", "data", "vocab.json"), "utf8")
) as { words: Record<string, number>; gradeToCefr: Record<string, string> };
const VOCAB = vocabData.words;
const CEFR_TO_GRADE: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

// ── 문법 등급 색인 ─────────────────────────────────────────────────────
const grammarData = JSON.parse(
  readFileSync(join(HERE, "..", "src", "lib", "korean", "data", "grammar.json"), "utf8")
) as { items: { form: string; grade: number; aliases: string[] }[] };

/**
 * 문법 표기를 대조용 키로 정규화한다.
 * 프롬프트 hint는 `-(으)ㄹ 수 있다`처럼 쓰고 목록은 `-을 수 있다`처럼 쓰기도 해서,
 * 괄호를 넣은 형태와 뺀 형태를 모두 키로 넣는다.
 */
function grammarKeys(s: string): string[] {
  // 앞뒤 하이픈과 문장부호를 떼어낸다.
  //   프롬프트: "-(으)ㄹ까요?"  국립국어원: "-을까" / 이형태 "-ㄹ까요"  → 물음표만 달랐다
  //   국립국어원 선어말어미는 "-었-" 처럼 뒤에도 하이픈이 붙는다
  const base = s
    .trim()
    .replace(/^[-\s]+/, "")
    .replace(/[-\s?!.]+$/, "")
    .replace(/<[^>]*>/g, "") // "<유의> -은 뒤에" 같은 주석 표기 제거
    .trim();
  if (!base) return [];

  const variants = new Set<string>([base]);
  variants.add(base.replace(/\([^)]*\)/g, "")); // (으)ㄹ → ㄹ
  variants.add(base.replace(/[()]/g, "")); // (으)ㄹ → 으ㄹ
  // (으)+자음 → 으와 결합한 음절. 국립국어원 대표형이 이 형태다((으)ㄴ 후에 → 은 후에)
  variants.add(
    base
      .replace(/\(으\)ㄴ/g, "은")
      .replace(/\(으\)ㄹ/g, "을")
      .replace(/\(으\)ㅁ/g, "음")
      .replace(/\(으\)ㅂ/g, "읍")
      .replace(/\(이\)/g, "이")
  );
  return [...variants].map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** 키 → 최저 등급 (같은 표기가 여러 등급이면 낮은 쪽을 쓴다 = 관대한 방향) */
const GRAMMAR = new Map<string, number>();
for (const item of grammarData.items) {
  for (const form of [item.form, ...item.aliases]) {
    for (const k of grammarKeys(form)) {
      const prev = GRAMMAR.get(k);
      if (prev === undefined || item.grade < prev) GRAMMAR.set(k, item.grade);
    }
  }
}

/**
 * hint 문자열을 조각으로 나눈다. 프롬프트 §5 규칙:
 *   명사 → 조사만 ("에", "을/를")
 *   용언 → 문법 형태 ("-기 전에")
 *   복합 → "기본 문법 + 종결 어미" ("-기로 하다 + 습니다")
 * `/`는 이형태 표기이므로 어느 쪽이든 맞으면 매칭으로 본다.
 *
 * 전개는 반드시 `expandSlash`로 한다. 단순 `split("/")`은 `-아야/어야 해요`를
 * `아` + `어야 해요`로 쪼개 `-어야`(단독 연결어미)에 오매칭시킨다(실측 오판).
 */
function lookupHintGrade(fragment: string): number | undefined {
  const alts = expandSlash(fragment).map((s) => s.trim()).filter(Boolean);
  let best: number | undefined;
  const take = (g: number | undefined) => {
    if (g !== undefined && (best === undefined || g < best)) best = g;
  };

  for (const alt of alts) {
    for (const k of grammarKeys(alt)) take(GRAMMAR.get(k));
  }
  if (best !== undefined) return best;

  // 결합형 폴백. hint는 "-았어요/었어요"처럼 선어말어미와 종결어미를 붙여 쓰는데,
  // 목록은 "-었-"(선어말)과 "-어"(종결, 이형태 -어요)로 따로 싣는다.
  // 두 조각으로 갈라 **양쪽 다 목록에 있으면** 매칭으로 보고 더 높은 등급을 택한다
  // (둘 중 어려운 쪽이 그 문법의 난이도를 결정하므로).
  for (const alt of alts) {
    const base = alt.trim().replace(/^[-\s]+/, "").replace(/[-\s?!.]+$/, "");
    for (let i = 1; i < base.length; i++) {
      const left = GRAMMAR.get(base.slice(0, i));
      const right = GRAMMAR.get(base.slice(i));
      if (left !== undefined && right !== undefined) {
        const combined = Math.max(left, right);
        if (best === undefined || combined < best) best = combined;
      }
    }
  }
  return best;
}

/**
 * 내용어 태그. 조사(J*)·어미(E*)·부호(S*)는 등급이 없으므로 제외한다.
 * NNP(고유명사)/NNB(의존명사)/NP(대명사)도 등급 대상이 아니다.
 */
const CONTENT_TAGS = new Set(["NNG", "VV", "VA", "MAG", "MAJ", "MM", "NR", "XR"]);
/** 분모에서 아예 빼는 태그 — 고유명사·외국어·한자·숫자 */
const EXCLUDED_TAGS = new Set(["NNP", "SL", "SH", "SN"]);
/** 용언 파생 접미사: 앞 어근과 합쳐 동사/형용사가 된다 (공부+하 → 공부하다) */
const VERB_SUFFIX = new Set(["XSV", "XSA"]);
/** 명사 파생: 앞 어근과 합쳐 명사가 된다 (선생+님, 움직이+ㅁ) */
const NOUN_SUFFIX = new Set(["XSN", "ETN"]);
/** 통사 지표용 */
const EC = "EC";
const ETM = "ETM";

type Token = { str: string; tag: string; position: number; length: number; wordPosition: number };

type Unit = {
  surface: string; // 원문 슬라이스 (움직임, 공부해)
  root: string; // 첫 형태소 원형 (움직이, 공부)
  rootTag: string;
  joined: string; // 접미사까지 이은 원형 (공부하)
  kind: "plain" | "verbDeriv" | "nounDeriv";
};

/**
 * 등급 조회 — 후보 순서가 핵심이다.
 *
 * 표층형을 무조건 먼저 보면 안 된다. `가/VV`(가다)의 표층은 "가"인데 목록에 C1짜리
 * 동음이의 표제어 "가"가 있어서 82회나 오매칭됐다. 용언은 **원형+다를 먼저** 봐야 한다.
 *
 * 반대로 파생명사는 표층형이 정답이다. `움직임`은 명사 4급으로 등재돼 있는데
 * Kiwi는 `움직이/VV + ㅁ/ETN`으로 쪼개므로 원형(움직이다)을 먼저 보면 다른 등급이 나온다.
 */
function lookupGrade(u: Unit): number | undefined {
  let candidates: string[];
  switch (u.kind) {
    case "nounDeriv": // 선생님, 움직임 — 표층형이 곧 표제어
      candidates = [u.surface, u.joined, u.root + "다", u.root];
      break;
    case "verbDeriv": // 공부해 → 공부하다, 없으면 어근 공부
      candidates = [u.joined + "다", u.root + "다", u.root, u.surface];
      break;
    default:
      // 용언이면 원형+다 우선, 체언이면 표층 우선.
      candidates =
        u.rootTag === "VV" || u.rootTag === "VA" || u.rootTag === "XR"
          ? [u.root + "다", u.surface, u.root]
          : [u.surface, u.root, u.root + "다"];
  }
  for (const c of candidates) {
    const g = VOCAB[c];
    if (g !== undefined) return g;
  }
  return undefined;
}

/**
 * 토큰 열에서 내용어 단위를 뽑는다.
 * XSV/XSA는 직전 어근과 결합해 하나로 센다(`공부/NNG + 하/XSV` → 공부하다).
 * ETN(명사형 전성어미)도 직전 용언과 합쳐 파생명사로 본다(`움직이/VV + ㅁ/ETN` → 움직임).
 */
function extractContentUnits(tokens: Token[], sentence: string): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (EXCLUDED_TAGS.has(t.tag)) continue;
    if (!CONTENT_TAGS.has(t.tag)) continue;

    let end = t.position + t.length;
    let joined = t.str;
    let kind: Unit["kind"] = "plain";
    // 뒤따르는 파생 접미사를 흡수한다. 종류에 따라 조회 순서가 달라지므로 구분해 둔다.
    for (let j = i + 1; j < tokens.length; j++) {
      const n = tokens[j];
      if (VERB_SUFFIX.has(n.tag)) {
        end = Math.max(end, n.position + n.length);
        joined += n.str;
        kind = "verbDeriv";
        i = j;
      } else if (NOUN_SUFFIX.has(n.tag)) {
        end = Math.max(end, n.position + n.length);
        joined += n.str;
        kind = "nounDeriv";
        i = j;
      } else break;
    }
    units.push({
      surface: sentence.slice(t.position, end),
      root: t.str,
      rootTag: t.tag,
      joined,
      kind,
    });
  }
  return units;
}

async function main() {
  // ── Kiwi ─────────────────────────────────────────────────────────
  const modelFiles: Record<string, Uint8Array> = {};
  for (const name of readdirSync(KIWI_MODEL_DIR!)) {
    modelFiles[name] = new Uint8Array(readFileSync(join(KIWI_MODEL_DIR!, name)));
  }
  const builder = await KiwiBuilder.create(require.resolve("kiwi-nlp/dist/kiwi-wasm.wasm"));
  const kiwi = await builder.build({
    modelFiles,
    loadDefaultDict: false,
    loadTypoDict: false,
    loadMultiDict: false,
  });
  const tokenize = (s: string): Token[] => kiwi.tokenize(s) as Token[];

  // ── 데이터 ───────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, difficulty, words, problems, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`조회 실패: ${error.message}`);

  type Stat = {
    quizzes: number;
    problems: number;
    inRange: number;
    total: number;
    unknown: number;
    excludedByInput: number;
    words: number[]; // 문장당 어절 수
    ec: number[];
    etm: number[];
    over: Map<string, { grade: number; count: number }>;
    unk: Map<string, { tag: string; count: number }>;
    // 문법(hint 자기 신고) 축
    hintFrags: number;
    hintMatched: number;
    hintOver: Map<string, { grade: number; count: number }>;
    hintUnmatched: Map<string, number>;
  };
  const stats = new Map<string, Stat>();
  const blank = (): Stat => ({
    quizzes: 0, problems: 0, inRange: 0, total: 0, unknown: 0, excludedByInput: 0,
    words: [], ec: [], etm: [], over: new Map(), unk: new Map(),
    hintFrags: 0, hintMatched: 0, hintOver: new Map(), hintUnmatched: new Map(),
  });

  for (const q of data ?? []) {
    const difficulty = (q as any).difficulty as string;
    const target = CEFR_TO_GRADE[difficulty];
    if (!target) continue;
    const problems = ((q as any).problems ?? []) as {
      sentence?: string; answer?: string; word?: string; hint?: string;
    }[];
    if (!Array.isArray(problems) || !problems.length) continue;

    const st = stats.get(difficulty) ?? blank();
    stats.set(difficulty, st);
    st.quizzes++;

    // 선생님 입력 단어 → 내용어 형태소 집합(원형 기준). 표층 비교는 쓰지 않는다.
    const inputLemmas = new Set<string>();
    for (const w of (((q as any).words ?? []) as string[])) {
      for (const u of extractContentUnits(tokenize(w), w)) {
        inputLemmas.add(u.root);
        inputLemmas.add(u.joined);
        inputLemmas.add(u.surface);
      }
    }

    for (const p of problems) {
      // 빈칸 문장은 ( )가 있으므로 정답을 채워 완성 문장으로 만든다.
      const sentence = (p.sentence ?? "").replace(/\(\s*\)/g, p.answer ?? "").trim();
      if (!sentence) continue;
      st.problems++;

      const tokens = tokenize(sentence);
      st.words.push(sentence.split(/\s+/).filter(Boolean).length);
      st.ec.push(tokens.filter((t) => t.tag === EC).length);
      st.etm.push(tokens.filter((t) => t.tag === ETM).length);

      // 문법 축 — hint가 자기 신고한 문법을 등급 목록과 대조한다.
      // 정답에 쓴 문법만 적히므로 sentence 쪽 문법은 잡히지 않는다(구조적 한계).
      for (const frag of (p.hint ?? "").split("+").map((s) => s.trim()).filter(Boolean)) {
        st.hintFrags++;
        const g = lookupHintGrade(frag);
        if (g === undefined) {
          st.hintUnmatched.set(frag, (st.hintUnmatched.get(frag) ?? 0) + 1);
          continue;
        }
        st.hintMatched++;
        if (g > target) {
          const prev = st.hintOver.get(frag);
          st.hintOver.set(frag, { grade: g, count: (prev?.count ?? 0) + 1 });
        }
      }

      // 이 문제의 대상 단어도 제외 집합에 넣는다.
      const localExclude = new Set(inputLemmas);
      if (p.word) {
        for (const u of extractContentUnits(tokenize(p.word), p.word)) {
          localExclude.add(u.root);
          localExclude.add(u.joined);
          localExclude.add(u.surface);
        }
      }

      for (const u of extractContentUnits(tokens, sentence)) {
        if (localExclude.has(u.root) || localExclude.has(u.joined) || localExclude.has(u.surface)) {
          st.excludedByInput++;
          continue;
        }
        st.total++;
        const g = lookupGrade(u);
        if (g === undefined) {
          // 미등재는 관대하게 통과시킨다. 2017년 목록이라 신어·복합어가 빠져 있어
          // 초과로 잡으면 오탐이 쏟아진다. 대신 따로 센다.
          st.unknown++;
          st.inRange++;
          const key = `${u.surface}|${u.joined}`;
          const pu = st.unk.get(key);
          st.unk.set(key, { tag: `${u.rootTag}/${u.kind}`, count: (pu?.count ?? 0) + 1 });
          continue;
        }
        if (g <= target) st.inRange++;
        else {
          const prev = st.over.get(u.surface);
          st.over.set(u.surface, { grade: g, count: (prev?.count ?? 0) + 1 });
        }
      }
    }
  }

  // ── 출력 ─────────────────────────────────────────────────────────
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) + "%" : "—");
  const ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  // 프롬프트 DIFFICULTY_GUIDES의 `길이:` 값 (측정 대조용) — supabase/functions/_shared/grammar.ts
  // LEVEL_SENTENCE_LENGTH와 반드시 같은 숫자를 유지한다.
  const LEN_GUIDE: Record<string, string> = {
    A1: "5-8", A2: "7-10", B1: "9-13", B2: "12-17", C1: "16-24", C2: "16-28",
  };

  console.log("\n═══ 어휘 등급 커버리지 베이스라인 ═══");
  console.log("(선생님 입력 단어는 제외하고 나머지 어휘만 측정)\n");
  console.log("난이도  퀴즈  문제  커버리지   미등재   어절수(권장)      EC    ETM  |  hint매칭  문법초과");
  console.log("─".repeat(100));
  const report: Record<string, unknown> = {};
  for (const d of ORDER) {
    const s = stats.get(d);
    if (!s) continue;
    console.log(
      `${d.padEnd(6)} ${String(s.quizzes).padStart(4)} ${String(s.problems).padStart(5)}  ` +
        `${pct(s.inRange, s.total).padStart(7)}  ${pct(s.unknown, s.total).padStart(7)}  ` +
        `${mean(s.words).toFixed(1).padStart(5)} (${LEN_GUIDE[d]})`.padEnd(16) +
        `${mean(s.ec).toFixed(2).padStart(6)} ${mean(s.etm).toFixed(2).padStart(6)}  |  ` +
        `${pct(s.hintMatched, s.hintFrags).padStart(7)}  ` +
        `${pct([...s.hintOver.values()].reduce((a, b) => a + b.count, 0), s.hintMatched).padStart(7)}`
    );
    report[d] = {
      quizzes: s.quizzes, problems: s.problems,
      coverage: s.total ? s.inRange / s.total : null,
      unknownRate: s.total ? s.unknown / s.total : null,
      contentWords: s.total, excludedByInput: s.excludedByInput,
      avgWords: mean(s.words), avgEC: mean(s.ec), avgETM: mean(s.etm),
      topOver: [...s.over.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30)
        .map(([w, v]) => ({ word: w, grade: v.grade, count: v.count })),
    };
  }

  for (const d of ORDER) {
    const s = stats.get(d);
    if (!s?.over.size) continue;
    const top = [...s.over.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);
    console.log(`\n── ${d} 등급 초과 어휘 (빈도순) ──`);
    console.log("  " + top.map(([w, v]) => `${w}(${ORDER[v.grade - 1]})×${v.count}`).join("  "));
  }

  // 문법 축 상세 — 매칭률이 낮으면 이 지표 자체를 신뢰하면 안 된다.
  for (const d of ORDER) {
    const s = stats.get(d);
    if (!s?.hintFrags) continue;
    const over = [...s.hintOver.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const unm = [...s.hintUnmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log(`\n── ${d} 문법(hint) ──`);
    if (over.length)
      console.log("  등급 초과: " + over.map(([f, v]) => `"${f}"(${ORDER[v.grade - 1]})×${v.count}`).join("  "));
    else console.log("  등급 초과: 없음");
    if (unm.length) console.log("  미매칭   : " + unm.map(([f, c]) => `"${f}"×${c}`).join("  "));
  }

  // 미등재 진단 — 비율이 높으면 조회 로직 문제일 가능성이 크다(목록은 1만 단어다).
  for (const d of ["A1", "A2"]) {
    const s = stats.get(d);
    if (!s?.unk.size) continue;
    const top = [...s.unk.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25);
    console.log(`\n── ${d} 미등재 상위 (표층|원형/태그 ×횟수) ──`);
    for (const [key, v] of top) {
      const [surface, lemma] = key.split("|");
      console.log(`  ${surface} | ${lemma}/${v.tag} ×${v.count}`);
    }
  }

  const outPath = join(HERE, "fixtures", `baseline-${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ measuredAt: new Date().toISOString(), byDifficulty: report }, null, 2), "utf8");
  console.log(`\n결과 저장: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
