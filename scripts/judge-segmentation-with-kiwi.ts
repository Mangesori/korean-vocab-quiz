/**
 * Phase 2 — Kiwi를 심판으로 AI vs 휴리스틱 재채점
 *
 * 지난 compare-segmentation.ts는 "AI와 휴리스틱이 서로 얼마나 같은가"만 쟀다.
 * 이 스크립트는 "둘 중 누가 진짜 형태소 분석기(Kiwi)의 판정에 더 가까운가"를 잰다.
 *
 * 방법:
 *  - scripts/fixtures/wm-golden.json의 각 행(base_text + 저장된 AI 타일)을 읽는다.
 *  - 같은 base_text를 휴리스틱(parseSentenceToItems)에도 돌린다.
 *  - base_text를 Kiwi로 형태소 분석해 "어절마다 쪼개야 하는가/어디서 쪼개야 하는가"의
 *    정답(gold)을 만든다.
 *      · 어절 끝이 순수 조사 사슬(JKS/JKC/JKG/JKO/JKB/JKV/JKQ/JX/JC)이면 그 사슬 앞에서
 *        쪼갠다. 조사가 여러 개 겹쳐 있으면 조사마다 개별 타일.
 *      · 어절 끝이 서술격 조사 활용(VCP(+EP)*+EF/ETN/ETM, 예: "이에요","이었어요")이면
 *        그 전체를 통째로 한 타일(조사 취급)로 보고 그 앞에서 쪼갠다.
 *      · 둘 다 아니면(용언 어미, 부사 등) 쪼개지 않는다 — 어절 전체가 한 타일.
 *  - AI 타일 / 휴리스틱 타일을 같은 어절 경계로 그룹핑해서 "어간 길이"를 구하고,
 *    Kiwi가 정한 어간 길이와 같은지로 어절 단위 정답률을 낸다.
 *
 * 실행:
 *   npx tsx scripts/judge-segmentation-with-kiwi.ts
 *   (KIWI_MODEL_DIR 미지정 시 .kiwi-model/models/cong/base 기본값 사용)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as kiwiNlpNs from "kiwi-nlp";
import { parseSentenceToItems } from "../src/lib/korean/wordMagnet.ts";

const kiwiNlp: any = (kiwiNlpNs as any).KiwiBuilder ? kiwiNlpNs : (kiwiNlpNs as any).default;
const { KiwiBuilder } = kiwiNlp;

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(HERE, "fixtures", "wm-golden.json");

const KIWI_MODEL_DIR =
  process.env.KIWI_MODEL_DIR ?? join(HERE, "..", ".kiwi-model", "models", "cong", "base");
if (!existsSync(KIWI_MODEL_DIR)) {
  console.error(`Kiwi 모델을 찾지 못했습니다: ${KIWI_MODEL_DIR}`);
  process.exit(1);
}

type Tile = { content: string; isParticle: boolean };
type Token = { str: string; tag: string; position: number; length: number; wordPosition: number };

const PARTICLE_TAGS = new Set(["JKS", "JKC", "JKG", "JKO", "JKB", "JKV", "JKQ", "JX", "JC"]);
const COPULA_TAGS = new Set(["VCP", "EP", "EF", "ETN", "ETM"]);

/** 어절(공백 없는 base_text 상의 한 단어) 하나에 대한 Kiwi 기준 정답 경계. */
type GoldWord = {
  start: number; // base_text(공백 포함 원문) 상의 시작 offset
  end: number; // 끝 offset(문장부호 포함)
  stemLen: number; // 어간 길이(문장부호 제외한 core 기준)
  particleTiles: string[]; // 정답 조사 타일들(순서대로). copula면 원소 1개.
  coreLen: number; // core(문장부호 뗀 어절) 길이
};

/** Kiwi 토큰열 + 원문에서 어절별 정답 경계를 뽑는다. */
function buildGoldWords(text: string, tokens: Token[]): GoldWord[] {
  // 어절 = 공백 기준. 각 어절의 [start,end) offset을 원문에서 직접 구한다.
  const words: { start: number; end: number }[] = [];
  {
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length) break;
      const start = i;
      while (i < text.length && !/\s/.test(text[i])) i++;
      words.push({ start, end: i });
    }
  }

  return words.map(({ start, end }) => {
    // 이 어절 범위 안에 들어오는 토큰들
    const wtoks = tokens.filter((t) => t.position >= start && t.position < end);
    // 문장부호(S*) 접미사는 경계 판정에서 제외한다(어느 쪽 구현이든 마지막 타일에 붙임).
    let coreEnd = end;
    while (wtoks.length && wtoks[wtoks.length - 1].tag.startsWith("S")) {
      coreEnd = wtoks[wtoks.length - 1].position;
      wtoks.pop();
    }
    const coreLen = coreEnd - start;

    if (wtoks.length <= 1) {
      // 형태소가 1개 이하 → 쪼갤 수 없음(그 자체가 조사인 극히 드문 경우 포함, 무시)
      return { start, end, stemLen: coreLen, particleTiles: [], coreLen };
    }

    // 1) 꼬리 조사 사슬
    let runStart = wtoks.length;
    while (runStart > 0 && PARTICLE_TAGS.has(wtoks[runStart - 1].tag)) runStart--;
    if (runStart < wtoks.length && runStart > 0) {
      const stemLen = wtoks[runStart].position - start;
      const particleTiles = wtoks.slice(runStart).map((t) => t.str);
      return { start, end, stemLen, particleTiles, coreLen };
    }

    // 2) 서술격 조사 활용(코풀라) 사슬 — VCP를 반드시 포함해야 함
    let cRunStart = wtoks.length;
    while (cRunStart > 0 && COPULA_TAGS.has(wtoks[cRunStart - 1].tag)) cRunStart--;
    const hasVcp = wtoks.slice(cRunStart).some((t) => t.tag === "VCP");
    if (cRunStart < wtoks.length && cRunStart > 0 && hasVcp) {
      const stemLen = wtoks[cRunStart].position - start;
      const particleContent = text.slice(wtoks[cRunStart].position, coreEnd);
      return { start, end, stemLen, particleTiles: [particleContent], coreLen };
    }

    // 3) 그 외(용언 어미·부사 등) → 안 쪼갬
    return { start, end, stemLen: coreLen, particleTiles: [], coreLen };
  });
}

/** 타일 리스트(AI 또는 휴리스틱)를 원문 어절 경계로 그룹핑해 어절별 stemLen을 구한다. */
function tileStemLensByWord(tiles: Tile[], goldWords: GoldWord[]): (number | null)[] {
  // 타일을 이어붙인 문자열은 원문의 공백 제거본과 같아야 한다(호출 전에 보장).
  // 각 어절의 coreLen(문장부호 제외)만큼 타일을 소비하면서, 그 어절 내에서
  // "맨 앞 비조사 타일의 길이"를 stemLen으로 본다. 어절 전체가 조사 타일뿐이면
  // (드묾, 예: 의존명사 없이 조사만) stemLen=0.
  const out: (number | null)[] = [];
  let ti = 0;
  let offsetInTile = 0; // 현재 타일에서 이미 소비한 글자 수(타일이 어절 경계를 걸치는 경우는 없음이 정상)

  for (const gw of goldWords) {
    let remaining = gw.coreLen;
    let stemLen: number | null = null;
    let consumedInWord = 0;
    let sawParticle = false;

    while (remaining > 0 && ti < tiles.length) {
      const tile = tiles[ti];
      const tileRemaining = tile.content.length - offsetInTile;
      // 문장부호가 붙은 마지막 타일은 coreLen보다 길 수 있다 — core 부분만 센다.
      const take = Math.min(tileRemaining, remaining);
      // 문장부호 등 core를 초과하는 부분이 있는지 확인하기 위해, 타일의 core 기여분만 계산
      if (!tile.isParticle && !sawParticle) {
        stemLen = (stemLen ?? 0) + take;
      } else {
        sawParticle = true;
      }
      remaining -= take;
      consumedInWord += take;
      offsetInTile += take;
      if (offsetInTile >= tile.content.length) {
        ti++;
        offsetInTile = 0;
      }
    }
    // 문장부호가 마지막 타일에 붙어 있으면 타일 소비를 마저 끝낸다(다음 어절과 안 섞이게).
    if (ti < tiles.length && offsetInTile > 0 && offsetInTile < tiles[ti].content.length) {
      // 부호까지 포함해 타일 전체를 마저 소비(다음 어절 시작은 다음 타일부터)
      ti++;
      offsetInTile = 0;
    }
    out.push(consumedInWord === gw.coreLen ? stemLen ?? 0 : null); // null = 정렬 실패(이상 케이스)
  }
  return out;
}

async function main() {
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as {
    rows: { problem_id: string; base_text: string; items: Tile[] }[];
  };

  const modelFiles: Record<string, Uint8Array> = {};
  for (const name of readdirSync(KIWI_MODEL_DIR)) {
    modelFiles[name] = new Uint8Array(readFileSync(join(KIWI_MODEL_DIR, name)));
  }
  const builder = await KiwiBuilder.create(require.resolve("kiwi-nlp/dist/kiwi-wasm.wasm"));
  const kiwi = await builder.build({
    modelFiles,
    loadDefaultDict: false,
    loadTypoDict: false,
    loadMultiDict: false,
  });

  let totalWords = 0;
  let aiCorrect = 0;
  let heurCorrect = 0;
  let bothCorrect = 0;
  let bothWrong = 0;
  let onlyAiCorrect: { text: string; word: string; gold: GoldWord; ai: Tile[]; heur: Tile[] }[] = [];
  let onlyHeurCorrect: { text: string; word: string; gold: GoldWord; ai: Tile[]; heur: Tile[] }[] = [];

  for (const row of golden.rows) {
    const text = row.base_text;
    const tokens = kiwi.tokenize(text) as Token[];
    const goldWords = buildGoldWords(text, tokens);

    const aiTiles = row.items;
    const heurTiles = parseSentenceToItems(text).map((it) => ({
      content: it.content,
      isParticle: it.isParticle,
    }));

    const aiStems = tileStemLensByWord(aiTiles, goldWords);
    const heurStems = tileStemLensByWord(heurTiles, goldWords);

    goldWords.forEach((gw, i) => {
      totalWords++;
      const aiOk = aiStems[i] === gw.stemLen;
      const heurOk = heurStems[i] === gw.stemLen;
      if (aiOk) aiCorrect++;
      if (heurOk) heurCorrect++;
      if (aiOk && heurOk) bothCorrect++;
      if (!aiOk && !heurOk) bothWrong++;
      if (aiOk && !heurOk && onlyAiCorrect.length < 30) {
        onlyAiCorrect.push({ text, word: text.slice(gw.start, gw.end), gold: gw, ai: aiTiles, heur: heurTiles });
      }
      if (heurOk && !aiOk && onlyHeurCorrect.length < 30) {
        onlyHeurCorrect.push({ text, word: text.slice(gw.start, gw.end), gold: gw, ai: aiTiles, heur: heurTiles });
      }
    });
  }

  const pct = (n: number) => ((n / totalWords) * 100).toFixed(1);
  console.log("\n═══ Kiwi 심판 — 어절 단위 경계 정답률 ═══\n");
  console.log(`문장 수            ${golden.rows.length}`);
  console.log(`어절(비교 단위) 수  ${totalWords}\n`);
  console.log(`AI    일치         ${aiCorrect}  (${pct(aiCorrect)}%)`);
  console.log(`휴리스틱 일치       ${heurCorrect}  (${pct(heurCorrect)}%)`);
  console.log(`둘 다 일치         ${bothCorrect}  (${pct(bothCorrect)}%)`);
  console.log(`둘 다 불일치       ${bothWrong}  (${pct(bothWrong)}%)`);
  console.log(`AI만 정답          ${onlyAiCorrect.length >= 30 ? "30+" : onlyAiCorrect.length}`);
  console.log(`휴리스틱만 정답     ${onlyHeurCorrect.length >= 30 ? "30+" : onlyHeurCorrect.length}\n`);

  const fmtTiles = (tiles: Tile[]) =>
    tiles.map((t) => (t.isParticle ? `[${t.content}]` : t.content)).join(" ");

  console.log("── AI만 정답인 사례(휴리스틱이 틀림, 최대 30건) ──");
  for (const c of onlyAiCorrect) {
    console.log(`  원문: ${c.text}`);
    console.log(`  어절: "${c.word}" → 정답 어간길이=${c.gold.stemLen}, 조사=[${c.gold.particleTiles.join(",")}]`);
    console.log(`  AI  : ${fmtTiles(c.ai)}`);
    console.log(`  휴리: ${fmtTiles(c.heur)}\n`);
  }

  console.log("── 휴리스틱만 정답인 사례(AI가 틀림, 최대 30건) ──");
  for (const c of onlyHeurCorrect) {
    console.log(`  원문: ${c.text}`);
    console.log(`  어절: "${c.word}" → 정답 어간길이=${c.gold.stemLen}, 조사=[${c.gold.particleTiles.join(",")}]`);
    console.log(`  AI  : ${fmtTiles(c.ai)}`);
    console.log(`  휴리: ${fmtTiles(c.heur)}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
