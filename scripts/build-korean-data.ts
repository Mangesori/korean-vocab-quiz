/**
 * 어휘·문법 등급 데이터 → JSON 변환
 *
 * 출처가 축마다 다르다.
 *
 *   어휘 : 국립국어원 「국제 통용 한국어 표준 교육과정」 어휘 등급 목록(xlsx)
 *          https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=932
 *          "2017년 ... (4단계) 어휘, 문법 등급 목록_20180227_20201117 수정.xlsx"
 *          xlsx는 zip + XML이라 별도 파서 없이 읽는다(zip 해제만 외부에서 하고 XML은 직접 파싱).
 *
 *   문법 : 서울대 한국어 1A~6B 문법 목록 (scripts/data/snu-grammar.ts)
 *          국립국어원 문법 목록은 **이론적 표준**이라 실제 교실 순서와 어긋난다.
 *          3자 대조에서 국립국어원이 `-(으)면`을 A2, `-아야/어야 되다`를 B1으로 잡는 등
 *          초급 필수 문법을 뒤로 미루는 게 확인돼, 문법 축만 교실 순서(서울대)로 바꿨다.
 *          **어휘는 국립국어원 그대로 유지한다.**
 *
 * 두 목록 모두 사실상 갱신되지 않으므로, 매 빌드 파싱하지 않고 산출물 JSON을 저장소에 커밋한다.
 *
 * 실행:
 *   1) xlsx를 압축 해제 (PowerShell: [System.IO.Compression.ZipFile]::ExtractToDirectory)
 *   2) $env:NIKL_XLSX_DIR='<해제된 경로>'; npx tsx scripts/build-korean-data.ts
 *
 *   NIKL_XLSX_DIR 없이 돌리면 **어휘를 건너뛰고 문법만** 생성한다(기존 vocab*.json은 그대로 둔다).
 *   문법 쪽만 고칠 때 원본 엑셀 없이 검증할 수 있게 하려는 것이다.
 *
 *   어휘 최빈 100 : 국립국어원 2003년 「한국어 학습용 어휘 목록」(조남호) 사용 빈도 등급 목록(xlsx)
 *          https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=46&etc_seq=71
 *          "한국어학습용어휘등급표" — A(982)/B(2111)/C(2872), 열: 순위·단어·품사·풀이·등급.
 *          이 등급은 위 2017 교육과정과 축이 다르다(실제 사용 빈도 vs 교실 도입 순서) — 실측으로도
 *          "그렇다"(A1이면서 빈도A) vs "이렇다·서다·잡다·놓다"(빈도A지만 교육과정 2급) 처럼 갈린다.
 *          그래서 **두 목록의 교집합**(빈도A ∩ 교육과정 1급)을 순위로 정렬해 상위 100개를 뽑는다.
 *          NIKL_FREQ_XLSX_DIR 없이 돌리면 최빈 100 생성을 건너뛴다(기존 vocab-top100.json 유지).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expandBracket,
  expandSlash,
  splitCommaVariants,
  stripHomonymNumber,
  stripPosPrefix,
} from "./lib/grammar-notation.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "src", "lib", "korean", "data");

const XLSX_DIR = process.env.NIKL_XLSX_DIR;
const FREQ_XLSX_DIR = process.env.NIKL_FREQ_XLSX_DIR;

/** 국제 통용 한국어 표준 교육과정 1~6급 ↔ CEFR. TOPIK 등급·서울대 급수와도 같은 축이다. */
const GRADE_TO_CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Cefr = (typeof GRADE_TO_CEFR)[number];

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/** sharedStrings.xml → 인덱스 배열. <si>는 <t>가 여러 개로 쪼개질 수 있어 이어 붙인다. */
function loadSharedStrings(dir: string): string[] {
  const raw = readFileSync(join(dir, "xl", "sharedStrings.xml"), "utf8");
  const out: string[] = [];
  for (const si of raw.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let s = "";
    for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += t[1];
    out.push(unescapeXml(s).trim());
  }
  return out;
}

/** 워크시트 → 행 배열(열 문자 → 값). 빈 셀은 키 자체가 없다. */
function loadSheet(dir: string, file: string, shared: string[]): Record<string, string>[] {
  const raw = readFileSync(join(dir, "xl", "worksheets", file), "utf8");
  const rows: Record<string, string>[] = [];
  for (const rowM of raw.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Record<string, string> = {};
    // 빈 셀은 `<c r="F4" s="5"/>` 처럼 self-closing이다. 이걸 처리하지 않으면
    // 빈 셀에서 매칭이 시작돼 `</c>`를 찾아 **다음 셀까지 삼키고**, 속성은 빈 셀
    // 것(t="s" 없음)을 쓰므로 값이 sharedString 인덱스가 아니라 숫자 리터럴로 들어간다.
    for (const cM of rowM[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner] = cM;
      if (inner === undefined) continue; // self-closing = 빈 셀
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (!vM) continue;
      // t="s"면 sharedStrings 인덱스, 아니면 리터럴
      row[col] = / t="s"/.test(attrs) ? (shared[Number(vM[1])] ?? "") : unescapeXml(vM[1]);
    }
    if (Object.keys(row).length) rows.push(row);
  }
  return rows;
}

/** "1급" → 1 */
const parseGrade = (s: string | undefined): number | null => {
  const m = s?.match(/(\d)\s*급/);
  return m ? Number(m[1]) : null;
};

/**
 * 표제어 정규화 — 원본에는 **동형어 번호**가 붙어 있다.
 *   "가다01" → 가다        "먹다02" → 먹다
 *   "오늘02/오늘01" → 오늘  "계속02/계속01" → 계속
 * 슬래시로 여러 형태가 묶인 경우도 있어 각각 분리한 뒤 번호를 뗀다.
 *
 * 이걸 안 하면 흔한 단어일수록 동형어 번호가 붙어 있어서 조회가 통째로 실패한다
 * (실측: 내용어의 47%가 '미등재'로 빠졌다).
 */
function normalizeHeadwords(raw: string): string[] {
  return raw
    .split("/")
    .map((s) => s.trim().replace(/\d{2}$/, "").trim())
    .filter(Boolean);
}

type GrammarItem = {
  form: string;
  grade: number;
  cefr: Cefr;
  category: string;
  aliases: string[];
  meaning: string;
};

/** 서울대 문법 모듈. 다른 작업과 병렬로 만들어지므로 없을 수 있다 → 동적 import로 안내한다. */
type SnuModule = {
  VOLUME_GRADE: Record<string, number>;
  /** 출처 페이지의 원본 줄 수(전사 충실성 기준). 배열 길이와 다르다 — snu-grammar.ts 주석 참조. */
  SOURCE_LINE_COUNTS: Record<string, number>;
  EXPECTED_COUNTS: Record<string, number>;
  SOURCE_URLS: Record<string, string>;
  SNU_GRAMMAR: Record<string, string[]>;
  TEACHER_OVERRIDES: { form: string; grade: number; note: string }[];
};

async function loadSnu(): Promise<SnuModule | null> {
  try {
    return (await import("./data/snu-grammar.ts")) as unknown as SnuModule;
  } catch (e) {
    console.error("\n⚠ scripts/data/snu-grammar.ts를 불러올 수 없습니다 — 문법 생성을 건너뜁니다.");
    console.error(`   ${(e as Error).message}\n`);
    return null;
  }
}

/**
 * 서울대 문법 목록 → grammar.json 항목.
 *
 * 스키마 `{ form, grade, cefr, aliases, category, meaning }`는 반드시 유지한다.
 * scripts/measure-baseline.ts와 scripts/audit-grammar-guide.ts가 이 형태를 읽는다.
 * (`category`/`meaning`은 서울대 목록에 없어 빈 문자열이지만, 필드 자체는 남긴다.)
 */
function buildGrammar(snu: SnuModule): GrammarItem[] {
  const { VOLUME_GRADE, SOURCE_LINE_COUNTS, EXPECTED_COUNTS, SNU_GRAMMAR, TEACHER_OVERRIDES } = snu;

  // 오버라이드 키도 stripPosPrefix를 거친다. 데이터가 `V-(으)ㄹ게요`이고 오버라이드가
  // `-(으)ㄹ게요`면 원문 비교로는 안 걸리기 때문이다.
  const overrides = new Map<string, { grade: number; note: string; raw: string }>();
  for (const o of TEACHER_OVERRIDES) {
    overrides.set(stripPosPrefix(o.form), { grade: o.grade, note: o.note, raw: o.form });
  }
  const overrideHits = new Set<string>();

  // form → { grade, aliases }. 같은 form이 여러 권에 나오면 **가장 낮은 급**을 채택한다
  // (어휘와 같은 원칙 — 게이트가 아니라 측정 지표이므로 관대한 방향이 오탐을 줄인다).
  const merged = new Map<string, { grade: number; aliases: Set<string> }>();
  const countByVolume: Record<string, number> = {};

  for (const volume of Object.keys(SNU_GRAMMAR)) {
    const forms = SNU_GRAMMAR[volume] ?? [];
    countByVolume[volume] = forms.length;
    const volumeGrade = VOLUME_GRADE[volume];
    if (!volumeGrade) {
      console.warn(`⚠ VOLUME_GRADE에 ${volume}권이 없습니다 — 건너뜁니다.`);
      continue;
    }

    for (const raw of forms) {
      // 동형어 번호(`N(이)나 1`의 끝 " 1")는 form을 만들기 전에 뗀다. 안 그러면
      // 같은 형태가 급마다 다른 키가 되어 프롬프트의 `(이)나`와 영영 매칭되지 않는다.
      const base = stripHomonymNumber(raw);
      const form = stripPosPrefix(base);
      if (!form) continue;

      const ov = overrides.get(form);
      if (ov) overrideHits.add(form);
      const grade = ov ? ov.grade : volumeGrade;

      // 별칭 씨앗 = 원문 기준 form + 쉼표로 묶인 변이형 각각.
      // `form`은 원문 표기를 유지해야 출처 추적이 되므로 변이형은 별칭으로만 넣는다.
      //   "A-(으)ㄴ데, V-는데, N인데" → form은 그대로, 별칭에 -(으)ㄴ데 / -는데 / 인데
      const variants = splitCommaVariants(base);
      const seeds = variants.length > 1 ? [form, ...variants.map(stripPosPrefix)] : [form];

      // 이형태(슬래시)와 교체형(대괄호)을 전개해 별칭으로 넣는다.
      // 대괄호 → 슬래시 순서로 돌려 `-(으)ㄹ 생각[계획]이다` 같은 조합도 잡는다.
      const aliases = new Set<string>();
      for (const seed of seeds) {
        if (!seed) continue;
        for (const b of expandBracket(seed)) for (const e of expandSlash(b)) aliases.add(e);
      }
      aliases.delete(form);

      const prev = merged.get(form);
      if (prev) {
        if (grade < prev.grade) prev.grade = grade;
        for (const a of aliases) prev.aliases.add(a);
      } else {
        merged.set(form, { grade, aliases });
      }
    }
  }

  // ── 검증 1: 권별 개수 대조 (불일치해도 빌드는 계속한다) ──
  //
  // 두 기대값을 **나란히** 찍는다. 예전에는 EXPECTED_COUNTS 하나만 있었는데 그 값이
  // 실제 수집값과 같게 적혀 있어 대조가 항상 통과했다 — 자기 자신을 검증하는 셈이라
  // 안전망이 죽어 있었다. 이제 역할을 나눈다.
  //   출처줄 = SOURCE_LINE_COUNTS : 출처 페이지의 원본 항목 번호 수(전사 충실성 기준)
  //   배열   = EXPECTED_COUNTS    : 변이형을 쪼갠 뒤 배열 길이(회귀 감지용)
  console.log("권별 문법 항목 수 (실제 / 배열기대 / 출처줄)");
  let mismatch = 0;
  let sumActual = 0;
  let sumExpected = 0;
  let sumSource = 0;
  for (const volume of Object.keys(EXPECTED_COUNTS)) {
    const actual = countByVolume[volume] ?? 0;
    const expected = EXPECTED_COUNTS[volume];
    const source = SOURCE_LINE_COUNTS?.[volume] ?? 0;
    const mark = actual === expected ? " " : "⚠";
    if (actual !== expected) mismatch++;
    sumActual += actual;
    sumExpected += expected;
    sumSource += source;
    console.log(
      `  ${mark} ${volume}  ${String(actual).padStart(3)} / ${String(expected).padStart(3)} / ${String(source).padStart(3)}`
    );
  }
  console.log(`     합  ${String(sumActual).padStart(3)} / ${String(sumExpected).padStart(3)} / ${String(sumSource).padStart(3)}`);
  console.log(
    `  → 출처 원본 ${sumSource}줄이 변이형 분리로 ${sumExpected}개가 됐다 (+${sumExpected - sumSource}). ` +
      `한 줄이 여러 형태를 묶고 있던 항목을 쪼갠 결과다.`
  );
  if (mismatch) {
    console.warn(`⚠ 권별 개수 불일치 ${mismatch}건 — 항목이 지워졌거나 중복 추가됐을 수 있습니다.`);
  }
  console.log("");

  // ── 검증 2: 교사 오버라이드 적용 여부 ──
  const missed = TEACHER_OVERRIDES.filter((o) => !overrideHits.has(stripPosPrefix(o.form)));
  console.log(`교사 오버라이드 ${TEACHER_OVERRIDES.length}건 중 적용 ${overrideHits.size}건`);
  if (missed.length) {
    console.warn("⚠ 적용되지 않은 오버라이드 — 표기가 데이터와 다릅니다:");
    for (const o of missed) {
      console.warn(`     "${o.form}" (정규화: "${stripPosPrefix(o.form)}") → ${o.grade}급  ${o.note}`);
    }
  }
  console.log("");

  const items: GrammarItem[] = [...merged.entries()]
    .map(([form, v]) => ({
      form,
      grade: v.grade,
      cefr: GRADE_TO_CEFR[v.grade - 1],
      category: "", // 서울대 목록에는 분류가 없다
      aliases: [...v.aliases],
      meaning: "", // 서울대 목록에는 뜻풀이가 없다
    }))
    .sort((a, b) => a.grade - b.grade || a.form.localeCompare(b.form, "ko"));

  // ── 검증 3: 등급별 개수 ──
  console.log("등급별 문법 항목 수");
  for (let g = 1; g <= 6; g++) {
    console.log(`  ${g}급(${GRADE_TO_CEFR[g - 1]})  ${items.filter((i) => i.grade === g).length}`);
  }
  console.log("");

  return items;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // 최빈 100(아래)이 등급1 어휘가 필요하므로, 이번 실행에서 새로 만들지 않아도
  // 저장소에 커밋된 vocab.json에서 읽어 둔다.
  let vocab: Record<string, number> = {};
  try {
    vocab = JSON.parse(readFileSync(join(OUT_DIR, "vocab.json"), "utf8")).words;
  } catch {
    // 최초 실행이라 vocab.json이 아직 없다 — NIKL_XLSX_DIR로 새로 만들 것이다.
  }

  // ── 어휘 (국립국어원 sheet1) — C=등급, D=어휘, E=품사 ──────────────
  if (!XLSX_DIR) {
    console.warn("⚠ NIKL_XLSX_DIR가 없어 어휘 생성을 건너뜁니다 (vocab.json / vocab-pos.json 유지).\n");
  } else {
    const shared = loadSharedStrings(XLSX_DIR);
    console.log(`sharedStrings ${shared.length}개 로드\n`);

    const vocabRows = loadSheet(XLSX_DIR, "sheet1.xml", shared).slice(1); // 헤더 제거
    vocab = {};
    const posOf: Record<string, Set<string>> = {};
    let vocabSkipped = 0;

    for (const r of vocabRows) {
      const grade = parseGrade(r["C"]);
      const rawWord = r["D"]?.trim();
      if (!grade || !rawWord) {
        vocabSkipped++;
        continue;
      }
      for (const word of normalizeHeadwords(rawWord)) {
        // 같은 표제어가 여러 등급에 있으면 가장 낮은(쉬운) 등급을 채택한다.
        // 동형어 번호를 떼면 중복이 생기는데(예: 개01=1급, 개03=3급), 학습자가 이미
        // 배운 등급으로 보는 게 관대한 방향이고 게이트가 아니라 측정 지표이므로
        // 오탐을 줄이는 쪽이 낫다.
        if (vocab[word] === undefined || grade < vocab[word]) vocab[word] = grade;
        if (r["E"]) (posOf[word] ??= new Set()).add(r["E"].trim());
      }
    }

    const byGrade = (n: number) => Object.values(vocab).filter((g) => g === n).length;
    console.log("등급별 어휘 수 (누적)");
    let cum = 0;
    for (let g = 1; g <= 6; g++) {
      cum += byGrade(g);
      console.log(
        `  ${g}급(${GRADE_TO_CEFR[g - 1]})  ${String(byGrade(g)).padStart(5)}  누적 ${String(cum).padStart(6)}`
      );
    }
    console.log(`\n총 표제어 ${Object.keys(vocab).length} (원본 행 ${vocabRows.length}, 건너뜀 ${vocabSkipped})\n`);

    // 어휘 메타는 **국립국어원 그대로** 둔다. 문법만 출처가 바뀌었다.
    const vocabMeta = {
      source: "국립국어원 2017 국제 통용 한국어 표준 교육과정 적용 연구(4단계) 어휘 등급 목록",
      sourceUrl: "https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=932",
      gradeToCefr: Object.fromEntries(GRADE_TO_CEFR.map((c, i) => [i + 1, c])),
      builtAt: new Date().toISOString(),
      note: "이 파일은 scripts/build-korean-data.ts가 생성한다. 직접 수정하지 말 것.",
    };

    writeFileSync(join(OUT_DIR, "vocab.json"), JSON.stringify({ ...vocabMeta, words: vocab }, null, 0), "utf8");
    writeFileSync(
      join(OUT_DIR, "vocab-pos.json"),
      JSON.stringify(
        { ...vocabMeta, pos: Object.fromEntries(Object.entries(posOf).map(([w, s]) => [w, [...s]])) },
        null,
        0
      ),
      "utf8"
    );
  }

  // ── 어휘 최빈 100 (조남호 2003 sheet1) — A=순위, B=단어, C=품사, D=풀이, E=등급 ──
  if (!FREQ_XLSX_DIR) {
    console.warn("⚠ NIKL_FREQ_XLSX_DIR가 없어 최빈 100 생성을 건너뜁니다 (vocab-top100.json 유지).\n");
  } else if (Object.keys(vocab).length === 0) {
    console.warn("⚠ 1급 어휘가 없어(vocab.json 미존재) 최빈 100 생성을 건너뜁니다.\n");
  } else {
    const freqShared = loadSharedStrings(FREQ_XLSX_DIR);
    const freqRows = loadSheet(FREQ_XLSX_DIR, "sheet1.xml", freqShared).slice(1); // 헤더 제거

    // clean word → 빈도 A등급 중 최소 순위(=가장 빈번한 뜻)와 그 품사.
    // 표제어에 동형어 번호가 붙어 있다(가격03, 놓다01) — normalizeHeadwords로 뗀다.
    // 순위가 빈칸인 행(고유명사 등, 빈도 조사 없이 등급만 매긴 항목)은 건너뛴다.
    const freqRankA = new Map<string, { rank: number; pos: string }>();
    let freqSkipped = 0;
    for (const r of freqRows) {
      const grade = r["E"]?.trim();
      const rawWord = r["B"]?.trim();
      // 순위 칸이 빈 문자열이면(고유명사 등, 빈도 조사 없이 등급만 매김) Number("") === 0이
      // 되어 "가장 빈번함"으로 오인된다 — r["A"] 자체가 비어 있는지 먼저 걸러야 한다.
      if (grade !== "A" || !rawWord || !r["A"]) {
        freqSkipped++;
        continue;
      }
      const rank = Number(r["A"]);
      if (!Number.isFinite(rank) || rank <= 0) {
        freqSkipped++;
        continue;
      }
      for (const word of normalizeHeadwords(rawWord)) {
        const prev = freqRankA.get(word);
        if (!prev || rank < prev.rank) freqRankA.set(word, { rank, pos: r["C"]?.trim() ?? "" });
      }
    }
    console.log(`빈도 A등급 표제어 ${freqRankA.size}개 (원본 행 ${freqRows.length}, 건너뜀 ${freqSkipped})`);

    const grade1 = new Set(Object.entries(vocab).filter(([, g]) => g === 1).map(([w]) => w));
    const inGrade1 = [...freqRankA.entries()].filter(([w]) => grade1.has(w));
    const excluded = [...freqRankA.entries()]
      .filter(([w]) => !grade1.has(w))
      .sort((a, b) => a[1].rank - b[1].rank);
    console.log(
      `  ∩ 교육과정 1급 = ${inGrade1.length}개 (교육과정 1급이 아니라 제외 ${excluded.length}개, 예: ` +
        `${excluded.slice(0, 8).map(([w, v]) => `${w}(${v.rank})`).join(", ")})`
    );

    const top100 = inGrade1
      .sort((a, b) => a[1].rank - b[1].rank)
      .slice(0, 100)
      .map(([word, v]) => ({ word, rank: v.rank, pos: v.pos }));

    if (top100.length < 100) {
      console.warn(`⚠ 교집합이 100개 미만이다 (${top100.length}개) — 상위 100 요청을 다 채우지 못했다.`);
    }
    console.log(`  최빈 100 확정: 1위 "${top100[0]?.word}" ~ 100위 "${top100[99]?.word}"(순위 ${top100[99]?.rank})\n`);

    const top100Meta = {
      source:
        "국립국어원 2003 「한국어 학습용 어휘 목록」(조남호) 사용 빈도 A등급 ∩ 2017 국제 통용 한국어 표준 교육과정 1급(A1)",
      sourceUrls: {
        frequency: "https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=46&etc_seq=71",
        curriculum: "https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=932",
      },
      method:
        "빈도 A등급(982개, 실제 말뭉치 사용 빈도 조사 기반) 표제어와 vocab.json의 1급(A1) 표제어의 " +
        "교집합을 빈도 순위로 정렬해 상위 100개를 뽑았다. 두 등급은 축이 달라(사용 빈도 vs 교실 도입 " +
        "순서) 빈도A이지만 1급이 아닌 단어(예: 이렇다·서다·잡다·놓다)는 제외된다.",
      builtAt: new Date().toISOString(),
      note: "이 파일은 scripts/build-korean-data.ts가 생성한다. 직접 수정하지 말 것.",
    };

    writeFileSync(
      join(OUT_DIR, "vocab-top100.json"),
      JSON.stringify({ ...top100Meta, words: top100 }, null, 2),
      "utf8"
    );
  }

  // ── 문법 (서울대 한국어 1A~6B) ────────────────────────────────────
  const snu = await loadSnu();
  if (!snu) {
    console.error("문법 데이터가 없어 grammar.json은 갱신하지 않았습니다.");
    if (!XLSX_DIR) process.exit(1); // 아무것도 못 만들었으면 실패로 끝낸다
    return;
  }

  const grammar = buildGrammar(snu);
  console.log(`문법 항목 ${grammar.length}\n`);

  const grammarMeta = {
    source: "서울대학교 한국어 1A~6B 문법 목록",
    sourceUrl: Object.values(snu.SOURCE_URLS ?? {})[0] ?? "",
    sourceUrls: snu.SOURCE_URLS ?? {},
    gradeToCefr: Object.fromEntries(GRADE_TO_CEFR.map((c, i) => [i + 1, c])),
    builtAt: new Date().toISOString(),
    note:
      "이 파일은 scripts/build-korean-data.ts가 scripts/data/snu-grammar.ts에서 생성한다. 직접 수정하지 말 것. " +
      "권→급 매핑과 교사 오버라이드는 snu-grammar.ts에 있다.",
  };

  writeFileSync(join(OUT_DIR, "grammar.json"), JSON.stringify({ ...grammarMeta, items: grammar }, null, 2), "utf8");
  console.log(`출력: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
