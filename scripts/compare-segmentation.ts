/**
 * Phase 0 / Phase 1 — 워드마그넷 분절 비교
 *
 * 프로덕션 `word_magnet_problems`의 저장된 타일(= segment-korean 엣지 함수가 AI로 만든 결과)과
 * 기존 휴리스틱 `parseSentenceToItems()`의 결과를 대조한다.
 *
 * 답하려는 질문: **AI 호출이 실제로 값을 하고 있는가?**
 * 거의 같다면 segment-korean(Claude Haiku 호출)을 삭제해도 품질 손실이 없다.
 *
 * 실행:
 *   $env:SUPABASE_URL='https://<ref>.supabase.co'
 *   $env:SUPABASE_SERVICE_KEY='<service_role key>'
 *   npx tsx scripts/compare-segmentation.ts
 *
 * 산출물: scripts/fixtures/wm-golden.json (이후 회귀 비교 기준)
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 앱이 실제로 쓰는 휴리스틱을 그대로 import 한다(복제하면 드리프트가 생긴다).
import { parseSentenceToItems } from "../src/lib/korean/wordMagnet.ts";

type StoredTile = { content: string; isParticle: boolean };
type Row = {
  id: string;
  quiz_id: string;
  problem_id: string;
  base_text: string;
  items: StoredTile[];
};

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(HERE, "fixtures", "wm-golden.json");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/** 타일 배열을 비교 가능한 형태로 정규화 (저장분에는 id 등 부가 필드가 있을 수 있다) */
const norm = (tiles: { content: string; isParticle: boolean }[]) =>
  tiles.map((t) => ({ content: t.content, isParticle: !!t.isParticle }));

const contentsOf = (tiles: StoredTile[]) => tiles.map((t) => t.content).join("");
const stripSpaces = (s: string) => s.replace(/\s+/g, "");

async function fetchAll(): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("word_magnet_problems")
      .select("id, quiz_id, problem_id, base_text, items")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`조회 실패: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as unknown as Row[]));
    if (data.length < PAGE) break;
  }
  return out;
}

function main(rows: Row[]) {
  // 저장된 items가 비어 있는 행은 비교 대상이 아니다(AI/휴리스틱 어느 쪽도 안 거친 상태).
  const usable = rows.filter((r) => Array.isArray(r.items) && r.items.length > 0 && r.base_text);
  const skipped = rows.length - usable.length;

  let identical = 0;
  const particleOnly: Row[] = []; // 경계는 같고 isParticle 표시만 다름
  const boundaryDiff: Row[] = []; // 타일 경계 자체가 다름
  const aiBroken: Row[] = []; // 저장된 타일을 이어붙이면 원문이 안 나옴(기존 데이터 결함)

  for (const r of usable) {
    const stored = norm(r.items);
    const heur = norm(parseSentenceToItems(r.base_text));

    if (stripSpaces(stored.map((t) => t.content).join("")) !== stripSpaces(r.base_text)) {
      aiBroken.push(r);
      continue;
    }

    const sameBoundary = contentsOf(stored) === contentsOf(heur);
    const sameFlags =
      stored.length === heur.length &&
      stored.every((t, i) => t.isParticle === heur[i].isParticle);

    if (sameBoundary && sameFlags) identical++;
    else if (sameBoundary) particleOnly.push(r);
    else boundaryDiff.push(r);
  }

  const n = usable.length;
  const pct = (x: number) => (n ? ((x / n) * 100).toFixed(1) : "0.0");

  console.log("\n═══ 워드마그넷 분절 비교: 저장된 AI 결과 vs 기존 휴리스틱 ═══\n");
  console.log(`전체 행            ${rows.length}`);
  console.log(`  비교 제외(빈 items) ${skipped}`);
  console.log(`  비교 대상          ${n}\n`);
  console.log(`완전 일치           ${identical}  (${pct(identical)}%)`);
  console.log(`조사 표시만 다름     ${particleOnly.length}  (${pct(particleOnly.length)}%)`);
  console.log(`타일 경계가 다름     ${boundaryDiff.length}  (${pct(boundaryDiff.length)}%)`);
  console.log(`저장분 자체 손상     ${aiBroken.length}  (${pct(aiBroken.length)}%)\n`);

  const sample = (label: string, list: Row[], limit = 12) => {
    if (!list.length) return;
    console.log(`\n── ${label} (최대 ${limit}건) ──`);
    for (const r of list.slice(0, limit)) {
      const stored = norm(r.items);
      const heur = norm(parseSentenceToItems(r.base_text));
      const fmt = (tiles: StoredTile[]) =>
        tiles.map((t) => (t.isParticle ? `[${t.content}]` : t.content)).join(" ");
      console.log(`  원문 : ${r.base_text}`);
      console.log(`  AI   : ${fmt(stored)}`);
      console.log(`  휴리 : ${fmt(heur)}\n`);
    }
  };

  // ── 불일치의 성격 분해 ───────────────────────────────────────────
  // 프롬프트(segment-korean)는 "조사만 분리하고 어미는 절대 분리하지 말라"고 지시한다.
  // AI가 조사라고 표시한 조각이 실제로는 어미인 경우 = AI가 자기 규칙을 어긴 것.
  const ENDINGS = new Set([
    // 연결/종결 어미와 전성어미 (조사가 아님)
    "고", "지만", "는", "ㄴ", "은", "다고", "라고", "면", "면서", "니까", "어서", "아서",
    "기", "게", "도록", "려고", "으려고", "구나", "네요", "군요", "지요", "죠",
    "예요", "이에요", "이라서", "이어서", "여서", "세요", "으세요", "습니다", "ㅂ니다",
    "았어요", "었어요", "겠어요", "을까요", "ㄹ까요", "는데", "은데", "ㄴ데", "던", "더라고요",
  ]);

  let aiSplitMore = 0;
  let heurSplitMore = 0;
  let sameCount = 0;
  let aiEndingAsParticle = 0; // AI가 어미를 조사로 표시한 행 수
  const heurOnlyBad: Row[] = []; // AI는 안 쪼갰는데 휴리스틱만 쪼갠 행

  for (const r of boundaryDiff) {
    const stored = norm(r.items);
    const heur = norm(parseSentenceToItems(r.base_text));
    if (stored.length > heur.length) aiSplitMore++;
    else if (stored.length < heur.length) heurSplitMore++;
    else sameCount++;

    const storedParticles = new Set(stored.filter((t) => t.isParticle).map((t) => t.content.replace(/[.?!]$/, "")));
    const heurParticles = new Set(heur.filter((t) => t.isParticle).map((t) => t.content));
    if ([...storedParticles].some((p) => ENDINGS.has(p))) aiEndingAsParticle++;
    if ([...heurParticles].some((p) => !storedParticles.has(p))) heurOnlyBad.push(r);
  }

  console.log("── 불일치 86건의 성격 ──");
  console.log(`AI가 더 잘게 쪼갬        ${aiSplitMore}`);
  console.log(`휴리스틱이 더 잘게 쪼갬   ${heurSplitMore}`);
  console.log(`타일 수는 같고 경계만 다름 ${sameCount}`);
  console.log(`\nAI가 '어미'를 조사로 표시 ${aiEndingAsParticle}  ← 프롬프트 규칙 위반`);
  console.log(`휴리스틱만 쪼갠 조각 존재  ${heurOnlyBad.length}\n`);

  sample("타일 경계가 다름", boundaryDiff);
  sample("휴리스틱만 쪼갬 (휴리스틱 오류 후보)", heurOnlyBad, 15);
  sample("조사 표시만 다름", particleOnly);
  sample("저장분 자체 손상", aiBroken, 5);

  console.log("\n※ [ ] 표시가 조사(isParticle=true) 타일입니다.\n");

  mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
  writeFileSync(
    GOLDEN_PATH,
    JSON.stringify(
      {
        dumpedAt: new Date().toISOString(),
        total: rows.length,
        rows: usable.map((r) => ({
          problem_id: r.problem_id,
          base_text: r.base_text,
          items: norm(r.items),
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`골든 파일 저장: ${GOLDEN_PATH}\n`);
}

fetchAll()
  .then(main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
