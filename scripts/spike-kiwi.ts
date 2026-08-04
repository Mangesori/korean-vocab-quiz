/**
 * Phase 0 — kiwi-nlp 스파이크 (로컬 전용)
 *
 * 목적 두 가지:
 *  1) Node에서 Kiwi가 실제로 뜨는지, 태그·offset이 설계 가정대로인지 확인
 *  2) 프롬프트가 손으로 처리하던 예외(많이/쓰기로/낮아졌다고)가 자동 해결되는지 실측
 *
 * 모델은 브라우저에 못 싣지만(약 104MB) 로컬 스크립트에서는 무관하다.
 * 모델 준비:
 *   gh release download v0.23.2 --repo bab2min/Kiwi --pattern "kiwi_model_v0.23.2_base.tgz"
 *   tar -xzf kiwi_model_v0.23.2_base.tgz
 *   → models/cong/base/ 아래 파일들
 *
 * 실행:
 *   $env:KIWI_MODEL_DIR='<...>/models/cong/base'
 *   npx tsx scripts/spike-kiwi.ts
 */
// kiwi-nlp는 dist/*.js가 ESM 문법인데 package.json에 "type":"module"이 없다.
// 그래서 Node ESM 로더가 named export를 못 찾는다
// (`import { KiwiBuilder } from "kiwi-nlp"` → does not provide an export named).
// 네임스페이스로 받으면 정상 동작한다.
// CJS/ESM interop 때문에 실제 심볼이 최상위에 올 수도, `.default` 아래에 올 수도 있다.
import * as kiwiNlpNs from "kiwi-nlp";
const kiwiNlp: any = (kiwiNlpNs as any).KiwiBuilder ? kiwiNlpNs : (kiwiNlpNs as any).default;
const KiwiBuilder = kiwiNlp?.KiwiBuilder;
if (!KiwiBuilder) {
  console.error("KiwiBuilder 해석 실패. 네임스페이스 키:", Object.keys(kiwiNlpNs as any));
  process.exit(1);
}
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WASM_PATH = require.resolve("kiwi-nlp/dist/kiwi-wasm.wasm");

const MODEL_DIR = process.env.KIWI_MODEL_DIR;
if (!MODEL_DIR) {
  console.error("KIWI_MODEL_DIR 환경변수가 필요합니다.");
  process.exit(1);
}

/** 현재 프롬프트가 손으로 예외 처리하던 케이스 + 기본 확인용 */
const CASES = [
  "많이",
  "쓰기로",
  "낮아졌다고",
  "학생이",
  "저는",
  "바로",
  "하나",
  "보이는",
  "얇은",
  "똑같이",
  "요즘 운동하고 싶지만 시간이 없어요.",
  "밥 먹기 전에 손을 씻으세요.",
  "그 옷이 마음에 들면 바로 살 거예요.",
];

async function main() {
  console.log(`WASM : ${WASM_PATH}`);
  console.log(`MODEL: ${MODEL_DIR}\n`);

  const modelFiles: Record<string, Uint8Array> = {};
  for (const name of readdirSync(MODEL_DIR)) {
    modelFiles[name] = new Uint8Array(readFileSync(join(MODEL_DIR, name)));
  }
  console.log(`모델 파일 ${Object.keys(modelFiles).length}개 로드: ${Object.keys(modelFiles).join(", ")}\n`);

  const t0 = Date.now();
  const builder = await KiwiBuilder.create(WASM_PATH);
  console.log(`KiwiBuilder 생성 ${Date.now() - t0}ms · wasm 버전 ${builder.version()}`);

  const t1 = Date.now();
  const kiwi = await builder.build({
    modelFiles,
    // 사전을 끄면 로딩이 빨라진다. 분절 품질에는 큰 영향이 없다(고유명사 인식만 약해짐).
    loadDefaultDict: false,
    loadTypoDict: false,
    loadMultiDict: false,
  });
  console.log(`Kiwi 인스턴스 빌드 ${Date.now() - t1}ms · ready=${kiwi.ready()}\n`);

  console.log("═".repeat(70));
  for (const text of CASES) {
    const tokens = kiwi.tokenize(text);
    console.log(`\n"${text}"`);
    for (const t of tokens) {
      // position/length가 원문 슬라이스와 일치하는지 = 설계 불변식의 근거
      const slice = text.slice(t.position, t.position + t.length);
      const ok = slice === t.str ? "" : `  ⚠ slice="${slice}"`;
      console.log(
        `   ${t.str.padEnd(8)} ${t.tag.padEnd(6)} pos=${String(t.position).padStart(2)} len=${t.length} word=${t.wordPosition}${ok}`
      );
    }
  }
  console.log("\n" + "═".repeat(70));

  // 불변식 전수 확인: 모든 토큰이 원문 슬라이스로 복원되는가
  let mismatch = 0;
  for (const text of CASES) {
    for (const t of kiwi.tokenize(text)) {
      if (text.slice(t.position, t.position + t.length) !== t.str) mismatch++;
    }
  }
  console.log(`\n원문 슬라이스 불일치 토큰: ${mismatch}건`);
  console.log(mismatch === 0 ? "→ 불변식 성립: 타일을 원문 슬라이스로 만들 수 있다\n" : "→ 불변식 깨짐: 설계 수정 필요\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
