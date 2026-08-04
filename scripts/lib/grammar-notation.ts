/**
 * 문법 표기 정규화 공용 모듈
 *
 * 서울대 한국어 문법 목록과 프롬프트(`DIFFICULTY_GUIDES`)의 표기를 맞추기 위한
 * 순수 함수만 모아 둔다. 빌드(build-korean-data.ts)와 감사(audit-grammar-guide.ts)가
 * **같은 함수**를 써야 한 쪽만 고쳐서 생기는 불일치가 안 난다.
 */

/**
 * 품사 접두 제거 — 서울대 표기는 어떤 품사에 붙는지를 앞에 쓴다.
 *
 *   A/V-(으)면        → -(으)면
 *   V-(으)ㄹ게요       → -(으)ㄹ게요
 *   A-(으)ㄴ 것 같다   → -(으)ㄴ 것 같다
 *   N(이)라고 하다     → (이)라고 하다
 *
 * 단, `N`이 **문자열 중간에도** 나오는 항목(`N은/는 N이에요/예요`, `N부터 N까지`,
 * `V-는 N`)은 접두만 떼면 나머지 `N`이 그대로 남아 엉뚱한 키가 된다. 이런 항목은
 * 손대지 말고 원문을 그대로 돌려준다.
 * — 무리한 파싱으로 조용히 틀린 오매칭을 만드는 것보다, 눈에 보이는 매칭 실패(미확인)가 낫다.
 *
 * 하이픈은 **남긴다**(`A/V-(으)면` → `-(으)면`). 프롬프트 `DIFFICULTY_GUIDES`가
 * 하이픈을 붙여 쓰므로 사람 눈으로 대조하기 쉽고, 매칭 쪽은 `grammarKeys()`가
 * 선행 하이픈을 어차피 떼므로 결과가 달라지지 않는다.
 */
export function stripPosPrefix(s: string): string {
  const src = s.trim();

  // ── ① 한국어 품사 표기 ──────────────────────────────────────────────
  // 기준표(서울대)는 로마자로 쓰지만 **프롬프트는 한국어로 쓴다.**
  //   형용사+-(으)ㄴ  ↔  A-(으)ㄴ N
  //   (동사)+-는      ↔  V-는 N
  // 이걸 안 떼면 프롬프트 항목이 정방향 `미확인`으로, 기준표 항목이 역방향
  // `어디에도 없음`으로 **양쪽에서 중복 계상**된다(실측: A1·A2 합쳐 4항목 × 2방향).
  // 괄호 유무(`형용사+` / `(형용사)+`)와 `+` 앞뒤 공백을 모두 허용한다.
  const ko = src.replace(/^\(?(형용사|동사|명사)\)?\s*\+\s*/, "").trim();
  if (ko !== src) return ko || src;

  // ── ② 로마자 품사 표기 ──────────────────────────────────────────────
  const stripped = src.replace(/^[AVN](\/[AVN])*/, "").trim();
  if (stripped === src) return src; // 접두가 없었다
  // 뗀 나머지에 [AVN] 단독 토큰이 남아 있으면 포기하고 원문 반환.
  // (앞뒤가 영문자면 토큰이 아니라 다른 로마자 표기의 일부로 본다)
  if (/(^|[^A-Za-z])[AVN](?![A-Za-z])/.test(stripped)) return src;
  return stripped || src;
}

/**
 * 끝에 붙은 **수식받는 품사 토큰** 제거 — 관형사형 항목은 뒤에 피수식 명사를 적는 게
 * 서울대 표기 관례다. 그 ` N`을 안 떼면 프롬프트의 `-(으)ㄴ`과 영영 안 만난다.
 *
 *   A-(으)ㄴ N   →(stripPosPrefix 뒤)→ -(으)ㄴ      ← 프롬프트 `형용사+-(으)ㄴ`과 매칭
 *   V-는 N       →                    -는
 *   V-기(가) A   →                    -기(가)
 *   못 V         →                    못           ← 프롬프트 `못`과 매칭
 *
 * **원형은 반드시 함께 유지**한다(호출부에서 후보에 둘 다 넣는다). 뗀 형태만 쓰면
 * `N부터 N까지`처럼 토큰이 중간에도 있는 항목의 해석이 망가진다.
 *
 * 남는 조각이 1글자일 때는 떼는 토큰에 따라 갈린다:
 *   - `N`이 떨어지는 자리에는 **관형사**가 남을 수 있다(`이[그, 저] N` → `이`).
 *     이 `이`는 프롬프트의 주격조사 `이/가`와 같은 키가 되어 조용히 오매칭된다.
 *     → 1글자면 버린다.
 *   - `V`가 떨어지는 자리는 부정 부사뿐이다(전체 기준표에서 `안 V`·`못 V` 둘).
 *     → 1글자여도 살린다.
 *
 * 해당 없으면 `undefined`.
 */
export function stripTrailingPosToken(s: string): string | undefined {
  const m = s.trim().match(/^(.*\S)\s+([AVN])$/);
  if (!m) return undefined;
  const rest = m[1].trim();
  if (!rest) return undefined;
  if (m[2] === "N" && rest.length < 2) return undefined; // 관형사 오매칭 방지
  return rest;
}

/**
 * **선택 괄호**의 괄호 문자만 제거하고 내용은 남긴다.
 *
 * 괄호는 두 가지 뜻으로 쓰이는데 예전 코드는 이걸 안 갈라서 `괄호 안을 통째로 지운`
 * 변형까지 만들었고, 그 바람에 **서로 다른 문법이 같은 키로 무너졌다.**
 *
 *   | 괄호 종류 | 내용      | 뜻                        | 처리                     |
 *   |----------|----------|---------------------------|-------------------------|
 *   | 형태 괄호 | `으`·`이` | 받침 유무로 들어가고 빠짐    | 넣은/뺀 형태 **둘 다**    |
 *   | 선택 괄호 | 그 외     | 붙으면 **다른 항목**일 수 있음 | 괄호만 제거, 내용은 유지  |
 *
 * 실제 붕괴 사례:
 *   -(으)면서(도) (C2 양보)   → "면서"  ┐ 같은 키가 되어 C2 항목이
 *   -(으)면서     (A2 동시동작) → "면서"  ┘ "A2 목록에 있음"으로 잘못 잡혔다
 *   -거든요 (B1) 와 -거든 (B2) 도 `(요)`를 빼는 변형을 만들면 그대로 무너진다.
 *
 * 이 함수는 형태 괄호를 **손대지 않고 그대로 둔다.** 넣은/뺀 형태 생성은 호출부가
 * 이 결과에 `(으)`·`(이)` 처리를 이어서 한다.
 *
 *   -(으)면서(도) → (으)면서도      (→ 호출부에서 면서도 / 으면서도)
 *   -거든(요)     → 거든요          (→ "거든"은 절대 안 나온다)
 */
export function flattenOptionalParens(s: string): string {
  return s.replace(/\(([^)]*)\)/g, (m, inner: string) =>
    inner === "으" || inner === "이" ? m : inner
  );
}

/**
 * 활용형 → 사전형 대응표 (구멍 ③).
 *
 * 프롬프트는 **해요체 활용형**으로, 기준표는 **사전형**으로 쓴다.
 *   프롬프트 -아야/어야 해요   ↔   기준표 -아/어야 되다/하다
 *                    ↑ 하다 ≠ 해요 에서 끊긴다
 *
 * ⚠ **편집거리·유사도 같은 퍼지 매칭은 금지.** 과거에 `-아야/어야 해요`를
 * `-아/어야`(단독 연결어미, B1)에 오매칭시켜 "A1에 B1 문법이 있다"는 오판을 냈고,
 * 그게 실사용 22회 최다 빈도 항목이라 그대로 고쳤으면 큰 실수가 될 뻔했다.
 * 그래서 **경계가 분명한 표만** 쓰고, 이 정규화는 (느슨한 매칭과 달리) **판정에 쓴다.**
 * ⇒ **표에 없는 것은 변환하지 않는다.** 규칙이 추측으로 번지면 안 된다.
 */
const PREDICATE_DICTIONARY: Record<string, string> = {
  // 하다
  해요: "하다", 했어요: "하다", 합니다: "하다", 할까요: "하다", 하세요: "하다", 해: "하다",
  // 되다
  돼요: "되다", 됐어요: "되다", 됩니다: "되다",
  // 있다 / 없다
  있어요: "있다", 있습니다: "있다",
  없어요: "없다", 없습니다: "없다",
  // 알다 / 모르다
  알아요: "알다", 압니다: "알다",
  몰라요: "모르다", 모릅니다: "모르다",
  // 주다 (겸양형 포함 — 프롬프트 A1이 `-아/어 드릴게요` 계열을 쓴다)
  줘요: "주다", 주세요: "주다", 드릴게요: "주다", 드릴까요: "주다", 주시겠어요: "주다",
  // 보다
  봐요: "보다", 보세요: "보다",
  // 이다 / 아니다
  이에요: "이다", 예요: "이다", 입니다: "이다",
  아니에요: "아니다", 아닙니다: "아니다",
};

/**
 * 선어말어미·접사 활용형 → 접사형.
 *
 * 기준표는 선어말어미를 `-았/었-`·`-(으)시-`처럼 **하이픈 접사**로 싣는데
 * 프롬프트는 `-았어요/었어요`·`-(으)시다`처럼 **완성된 꼴**로 쓴다.
 * 기준표 쪽 끝 하이픈은 키 생성 과정에서 이미 떨어지므로(`-았-` → `았`),
 * 프롬프트 쪽에서 종결어미를 떼어 주면 두 표기가 만난다.
 */
const AFFIX_DICTIONARY: Record<string, string> = {
  았어요: "았", 었어요: "었", 았습니다: "았", 었습니다: "었",
  겠어요: "겠", 겠습니다: "겠",
  "(으)시다": "(으)시",
};

/**
 * 띄어쓰기만 다른 표기 (예외 목록).
 *
 * 규범상 `-고 싶어 하다`가 맞지만 프롬프트는 `-고 싶어하다`로 붙여 썼다.
 * 근본 해결은 프롬프트 문구 수정이고 여기 표는 **감사가 유령을 만들지 않게 하는
 * 임시 대응**이다. 일반적인 공백 무시 규칙은 절대 넣지 않는다 —
 * `만 하다`(B1)와 `-(으)ㄹ 만하다`(B1)처럼 공백이 곧 구분인 항목이 있다.
 */
const SPACING_EXCEPTIONS: Record<string, string> = {
  싶어하다: "싶어 하다",
};

/** 긴 접미사부터 본다 — `했어요`가 `해`보다 먼저 잡혀야 한다. */
const SUFFIX_RULES: [string, string][] = Object.entries({
  ...PREDICATE_DICTIONARY,
  ...AFFIX_DICTIONARY,
  ...SPACING_EXCEPTIONS,
}).sort((a, b) => b[0].length - a[0].length);

/**
 * 끝의 활용형을 사전형/접사형으로 바꾼 문자열을 돌려준다. 해당 없으면 입력 그대로.
 *
 * 후보를 **추가**하는 용도다(원형도 반드시 함께 유지). 문말 부호는 비교 전에만 떼고
 * 결과에는 되붙이지 않는다 — 키 생성 단계에서 어차피 떨어진다.
 */
export function toDictionaryForm(s: string): string {
  const src = s.trim();
  const body = src.replace(/[?!.]+$/, "").trim();
  for (const [from, to] of SUFFIX_RULES) {
    if (body.length > from.length && body.endsWith(from)) {
      return body.slice(0, -from.length) + to;
    }
    if (body === from) return to;
  }
  return src;
}

/**
 * 동형어 번호 제거 — 서울대 원문은 **같은 형태가 다른 급에서 다른 의미로** 나올 때
 * 끝에 번호를 붙여 구분한다.
 *
 *   N(이)나 1                  → N(이)나            (2A: 선택 '커피나 차')
 *   N(이)나 2                  → N(이)나            (3A: 수량 강조 '세 잔이나')
 *   A-(으)ㄴ데, V-는데, N인데 1  → A-(으)ㄴ데, V-는데, N인데
 *
 * 이 번호를 그대로 두면 프롬프트의 `(이)나`가 `N(이)나 1`과 절대 매칭되지 않는다.
 * 서울대 원본(`SNU_GRAMMAR`)은 출처 추적을 위해 손대지 않고 여기서만 뗀다.
 *
 * **끝에 공백으로 떨어진 숫자만** 지운다(`\s+\d+$`). 넓게 잡으면 정상 표기를 망친다:
 *   V-(으)ㄹ 생각[계획, 예정]이다   ← 숫자 없음, 그대로
 *   N(이)면 N, N(이)면 N          ← 숫자 없음, 그대로
 */
export function stripHomonymNumber(s: string): string {
  return s.trim().replace(/\s+\d+$/, "").trim();
}

/**
 * 쉼표로 묶인 변이형 분리 — 전사 과정에서 대부분의 변이형은 한 줄씩 분리됐지만
 * 일부는 한 항목에 여러 형태가 묶인 채로 남았다.
 *
 *   A-(으)ㄴ데, V-는데, N인데  → A-(으)ㄴ데 / V-는데 / N인데
 *   A-다, V-ㄴ/는다, N(이)다   → A-다 / V-ㄴ/는다 / N(이)다
 *   V-는 대로, N대로           → V-는 대로 / N대로
 *
 * 쉼표가 있다고 다 쪼개면 안 된다. 두 겹으로 막는다.
 *
 * 1) **대괄호 안 쉼표 마스킹** — 대괄호는 교체 가능한 어휘를 나열하는 표기라
 *    그 안의 쉼표는 구분자가 아니다. 마스킹 후 최상위 쉼표만 본다.
 *      N 개[병, 잔, 그릇]  ·  이[그, 저] N  ·  설사[설령, 가령] A/V-다(고) 해도
 *
 * 2) **모든 조각이 문법 형태처럼 보일 때만** 분리 — 조각이 `[AVN]`으로 시작하거나
 *    하이픈을 포함해야 한다. 이 기준 하나로 아래가 자동으로 걸러진다.
 *      누구나, 언제나, 어디나, 무엇이나, 무슨 N(이)나  ← '누구나'가 탈락 → 분리 안 함
 *      A/V-지(요), 뭐                              ← '뭐'가 탈락 → 분리 안 함
 *    (`N(이)면 N, N(이)면 N`은 두 조각이 같아 분리해도 결과가 같다 — 무해.)
 *
 * 분리 대상이 아니면 입력 하나를 그대로 돌려준다.
 */
export function splitCommaVariants(s: string): string[] {
  const src = s.trim();
  if (!src.includes(",")) return [src];

  // 대괄호 구간을 같은 길이의 자리표시자로 덮어 인덱스를 보존한다.
  const masked = src.replace(/\[[^\]]*\]/g, (m) => " ".repeat(m.length));

  const parts: string[] = [];
  let last = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== ",") continue;
    parts.push(src.slice(last, i));
    last = i + 1;
  }
  parts.push(src.slice(last));

  const trimmed = parts.map((p) => p.trim()).filter(Boolean);
  if (trimmed.length < 2) return [src]; // 최상위 쉼표가 없었다(전부 대괄호 안)

  const looksLikeForm = (p: string) => /^[AVN]/.test(p) || p.includes("-");
  if (!trimmed.every(looksLikeForm)) return [src];

  return [...new Set(trimmed)];
}

/** 후보 폭발 방지 상한. 슬래시 2개(=최대 4개)까지만 실제로 쓰인다. */
const MAX_CANDIDATES = 8;

/**
 * 이형태 슬래시 전개.
 *
 * **단순 `split("/")`을 쓰면 안 된다.** `아/어요`를 그냥 쪼개면 `아`라는 무의미한
 * 조각이 나온다. 실제로 이것 때문에 `-아야/어야 해요`가 `-어야`(단독 연결어미)에
 * 오매칭돼 "A1에 B1 문법이 있다"는 오판이 났다. 사용 빈도 1위 항목이라 그대로
 * 고쳤으면 잘못된 수정이 될 뻔했다.
 *
 * 규칙 — 왼쪽 길이만큼 오른쪽을 잘라 **공통 꼬리**를 얻는다:
 *   tail = right.slice(left.length)      // right가 더 짧으면 빈 문자열
 *   candidates = [left + tail, right]
 *
 *   았/었어요      → 았어요, 었어요        (tail = "어요")
 *   아야/어야 되다 → 아야 되다, 어야 되다  (tail = " 되다")
 *   은/는          → 은, 는                (tail = "")
 *
 * 보정 두 가지를 더 둔다(둘 다 위 검증 케이스를 그대로 통과시킨다):
 *
 * 1) **공통 접두 분리** — 슬래시 앞 전체를 left로 쓰면 `-았/었어요`가
 *    left="-았"(2자)이 되어 tail이 "요"로 잘린다. 선행 하이픈과 마지막 공백까지는
 *    이형태가 아니라 공통 접두이므로 떼어 두었다가 양쪽 후보에 다시 붙인다.
 *    (`-(으)ㄹ 수 있다/없다` → prefix="-(으)ㄹ 수 ", left="있다", right="없다")
 *
 * 2) **어절 경계 보정** — left가 오른쪽 첫 어절보다 길면 길이 규칙이 어절을
 *    가로질러 자른다(`(으)ㄴ/는 것 같다` → tail=" 같다"로 "것"이 사라진다).
 *    이 경우엔 오른쪽 첫 어절 전체를 이형태로 보고 나머지를 꼬리로 쓴다.
 *
 * 슬래시가 여러 개면 왼쪽부터 순차로(재귀) 전개한다. 3개 이상이면 조합이 커지고
 * 표기 해석도 불확실해지므로 전개를 포기하고 원문 하나만 돌려준다.
 */
export function expandSlash(s: string): string[] {
  const src = s.trim();
  const slashCount = (src.match(/\//g) ?? []).length;
  if (slashCount === 0) return [src];
  if (slashCount > 2) return [src]; // 해석 불확실 — 오매칭보다 매칭 실패가 낫다

  const i = src.indexOf("/");
  const leftAll = src.slice(0, i);
  const right = src.slice(i + 1);
  if (!leftAll || !right) return [src];

  // ── 공통 접두 분리 ──
  let prefix = "";
  let left = leftAll;
  if (left.startsWith("-")) {
    prefix = "-";
    left = left.slice(1);
  }
  const sp = left.lastIndexOf(" ");
  if (sp >= 0) {
    prefix += left.slice(0, sp + 1);
    left = left.slice(sp + 1);
  }
  if (!left) return [src];

  // ── 꼬리 계산 (어절 경계 보정 포함) ──
  const spaceAt = right.indexOf(" ");
  const firstWordLen = spaceAt >= 0 ? spaceAt : right.length;
  const tail = left.length > firstWordLen ? right.slice(firstWordLen) : right.slice(left.length);

  const out = new Set<string>();
  for (const c of [prefix + left + tail, prefix + right]) {
    const t = c.trim();
    if (!t) continue;
    // 남은 슬래시를 재귀로 전개한다. 후보마다 슬래시가 최소 1개 줄어드니 반드시 끝난다.
    if (t.includes("/")) for (const sub of expandSlash(t)) out.add(sub);
    else out.add(t);
    if (out.size >= MAX_CANDIDATES) break;
  }
  return out.size ? [...out] : [src];
}

/**
 * 대괄호 표기 전개 — `V-(으)ㄹ 생각[계획, 예정]이다` 처럼 교체 가능한 명사를
 * 대괄호로 묶어 쓴다. 대표형(대괄호 제거)과 각 대체형을 모두 돌려준다.
 *
 *   V-(으)ㄹ 생각[계획, 예정]이다
 *     → -(으)ㄹ 생각이다, -(으)ㄹ 계획이다, -(으)ㄹ 예정이다
 *
 * 대괄호가 없으면 입력 하나만 돌려준다.
 */
export function expandBracket(s: string): string[] {
  const src = s.trim();
  const m = src.match(/^(.*?)([^\s\[\]]*)\[([^\]]+)\](.*)$/);
  if (!m) return [src];
  const [, head, base, inner, rest] = m;
  const out = new Set<string>([`${head}${base}${rest}`.replace(/\s+/g, " ").trim()]);
  for (const alt of inner.split(/[,·、]/).map((x) => x.trim()).filter(Boolean)) {
    out.add(`${head}${alt}${rest}`.replace(/\s+/g, " ").trim());
  }
  return [...out].filter(Boolean);
}
