import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * 문장 만들기 채점.
 *
 * 설계 원칙은 GRADING-CRITERIA.md 참조. 핵심은 하나다 —
 * **모델에게 점수를 묻지 않는다.** 모델은 오류를 찾아 심각도만 분류하고,
 * 감점 폭과 합격선은 이 파일의 상수로만 존재한다.
 *
 * 왜 이렇게 바꿨나 (2026-08-03):
 *   이전 공식은 총점 = 단어사용×0.4 + 문법×0.35 + 자연스러움×0.25 였는데,
 *   학생 대부분이 목표 단어는 제대로 써서 단어사용 점수가 거의 항상 높았다.
 *   그 결과 40점 바닥이 깔려 문법 오류가 있어도 통과하는 구조였고
 *   (실측: 단어사용 90점 이상이면 93% 합격), 의미가 틀린 문장을 떨어뜨릴
 *   축이 아예 없었다. 모델 넷을 비교해 봐도 오류 진단은 다 정확한데
 *   점수 배분만 제각각이었다 — 모델이 아니라 공식의 문제였다.
 *
 *   프롬프트에 숫자를 쓰지 않으므로 프롬프트와 코드가 어긋날 수 없다.
 *   (이전에는 regenerate_feedback 프롬프트만 합격선 60·가중치 0.4/0.4/0.2를
 *    쓰다가 코드에서 70·0.4/0.35/0.25로 덮어써지고 있었다.)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── 채점 상수 — 여기가 유일한 기준이다 ──────────────────────────────
/** 심각도별 감점. 시작 100점에서 뺀다. */
const DEDUCTION: Record<ErrorSeverity, number> = { major: 12, minor: 5 };
/** 합격선. 70 = "중대 오류 2개까지 봐준다"는 뜻이다(중대 2개 = 76점). */
const PASS_THRESHOLD = 70;
/** 치명적 판정(목표 단어 오용·결합 오류·의미 붕괴)이 있으면 점수 상한. */
const CRITICAL_SCORE_CAP = 65;
/** 채점 실패 표식 — QuizResultDialog가 이 문구로 실패한 시도를 걸러낸다. 바꾸지 말 것. */
const GRADING_FAILURE_FEEDBACK = "채점에 실패했습니다.";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 55000;

type ErrorSeverity = "major" | "minor";
type TargetWordVerdict = "ok" | "misused" | "collocation_error";

interface GradedError {
  text: string;
  severity: ErrorSeverity;
}

/** 모델이 돌려주는 것 — 숫자는 없다. */
interface RawGrade {
  targetWordVerdict: TargetWordVerdict;
  sentenceMeaningBroken: boolean;
  errors: GradedError[];
  modelAnswer: string;
  feedback: string;
}

/** 코드가 점수를 붙여 클라이언트로 내보내는 것. */
interface GradeResponse extends RawGrade {
  totalScore: number;
  isPassed: boolean;
}

interface GradeRequest {
  word: string;
  studentSentence: string;
  difficulty: string;
  problemId?: string;
}

interface BatchGradeRequest {
  problems: GradeRequest[];
  difficulty: string;
  translationLanguage?: string;
}

const DIFFICULTY_DESCRIPTIONS: Record<string, string> = {
  A1: "TOPIK 1급 (초급) - 기본 문법과 간단한 문장 구조",
  A2: "TOPIK 2급 (초중급) - 일상적인 표현과 기본 연결어미",
  B1: "TOPIK 3급 (중급) - 다양한 연결어미와 복잡한 문장 구조",
  B2: "TOPIK 4급 (중고급) - 고급 문법과 추상적 표현",
  C1: "TOPIK 5급 (고급) - 격식체와 학술적 표현",
  C2: "TOPIK 6급 (최고급) - 전문적이고 정교한 문장 구조",
};

/** 단건·배치가 공유하는 판정 규칙. GRADING-CRITERIA.md를 그대로 옮긴 것이다. */
const JUDGEMENT_RULES = `**판정 1 — 목표 단어를 제대로 썼는가 (targetWordVerdict)**

- "ok": 목표 단어를 의미·형태·결합 모두 올바르게 사용했다.
- "misused": 그 단어의 뜻으로 쓰지 않았다.
  예) '내리쬐다'는 강한 햇빛이 쏟아지는 것이라 "달빛이 내리쬐었어요"는 의미 오용이다.
- "collocation_error": 단어 자체는 맞지만 함께 와야 할 성분이 틀렸다.
  예) "개에 먹이를 줘요" (개**에게**), "사흘쯤 갔어요" (사흘쯤 **있었어요**)
  목표 단어가 구(句)인 경우('청소기를 돌리다', '10분이 걸리다') 구 전체가 맞아야 한다.

**판정 2 — 문장 전체 의미가 무너졌는가 (sentenceMeaningBroken)**

기준은 하나다: **수정하면 뜻이 바뀌는가.**
- 어휘나 구조를 갈아끼워야 뜻이 복원되면 true.
  예) "옷 가게에서 판지를 샀아요" → '바지'. 판지(cardboard)와 바지(pants)는 다른 뜻이다.
  예) "전기가 없는 것을 살 수 없어요" → '없으면'. 뜻이 완전히 달라진다.
- 조사·어미·표기만 손보면 되고 뜻은 그대로면 false.
  예) "매년에" → "매년", "가깝은" → "가까운", "쑫았어" → "쏟아서" 모두 false.

**애매하면 false로 둔다.** 원어민이 읽고 학생 의도대로 이해된다면 무너진 것이 아니다.
확실히 다른 뜻으로 읽힐 때만 true.

**판정 3 — 나머지 오류 (errors)**

목표 단어와 무관한 오류를 심각도와 함께 나열한다.
- "major": 동사·형용사 활용 오류, 목표 단어의 표기 오류, 시제 오류
- "minor": 명사 오타, 부수적인 조사 오류, 구어체 축약('젤', '넘'), 반말체, 외래어 표기

**오류를 세는 단위 — 중요**

오류 1건 = 학생이 저지른 실수 1개. **그 실수에서 파생된 부작용을 따로 세지 마세요.**
> "커피를 쑫았어 지금 청소기를 돌려요"는 '쏟아서'의 표기 오류 **하나**다.
> 이걸 '쏟았어'(종결형)로 잘못 읽고 "연결어미가 없다", "반말과 존댓말이 섞였다"까지
> 세면 하나의 실수가 셋이 된다. 감점이 개수에 비례하므로 그대로 점수가 틀어진다.

판별법: **수정 문장에서 고친 자리의 개수**와 errors 개수가 같아야 한다.

**오류로 세면 안 되는 것**

- 고유명사·브랜드명. 모르는 이름을 활용형 오류로 단정하지 마세요.
  예) "맵당라멘이 젤 매워요"의 '맵당라면'은 실재하는 브랜드다.
- 문법 용어의 메타언어적 사용. "춤은 명사예요"는 올바른 문장이다.

**수정 문장 (modelAnswer)**

위에서 지적한 오류만 고친 한국어 문장. 지적하지 않은 요소(시제, 어휘 선택 등)는
절대 바꾸지 마세요. 오류가 하나도 없으면 학생 문장을 그대로 반환합니다.
영어 번역이나 "Example:" 같은 접두어를 붙이지 마세요.`;

const jsonRules = (targetLang: string) => `🚨 출력 규칙
- JSON만 출력하세요. 마크다운 코드 블록 금지.
- 점수를 매기지 마세요. 숫자 필드는 없습니다. 판정과 오류 목록만 내면 됩니다.
- feedback은 반드시 ${targetLang}로, 격려하는 톤으로 2-3문장.`;

function generateSingleGradingPrompt(
  word: string,
  studentSentence: string,
  difficulty: string,
  targetLang: string
): string {
  const desc = DIFFICULTY_DESCRIPTIONS[difficulty] || DIFFICULTY_DESCRIPTIONS["A1"];

  return `당신은 한국어 교육 전문가입니다. 학생이 주어진 단어를 사용해 만든 문장을 검토해주세요.

이 과제는 **어휘 습득**을 확인하는 것이지 작문 시험이 아닙니다.

**검토 대상**
- 단어 (기본형): ${word}
- 학생 문장: ${studentSentence}
- 요구 난이도: ${difficulty} (${desc})
- 피드백 언어: ${targetLang}

${JUDGEMENT_RULES}

**응답 형식**
{
  "targetWordVerdict": "ok" | "misused" | "collocation_error",
  "sentenceMeaningBroken": true | false,
  "errors": [{ "text": "오류 설명 (한국어)", "severity": "major" | "minor" }],
  "modelAnswer": "오류를 고친 한국어 문장",
  "feedback": "${targetLang}로 2-3문장"
}

${jsonRules(targetLang)}
- 첫 글자는 반드시 { 입니다.`;
}

function generateBatchGradingPrompt(
  problems: { word: string; studentSentence: string }[],
  difficulty: string,
  targetLang: string
): string {
  const desc = DIFFICULTY_DESCRIPTIONS[difficulty] || DIFFICULTY_DESCRIPTIONS["A1"];
  const list = problems
    .map((p, i) => `${i + 1}. 단어: "${p.word}" / 학생 문장: "${p.studentSentence}"`)
    .join("\n");

  return `당신은 한국어 교육 전문가입니다. 학생이 만든 문장 여러 개를 한꺼번에 검토해주세요.

이 과제는 **어휘 습득**을 확인하는 것이지 작문 시험이 아닙니다.

**요구 난이도:** ${difficulty} (${desc})
**피드백 언어:** ${targetLang}

**검토 대상**
${list}

${JUDGEMENT_RULES}

**응답 형식** (배열, 입력과 같은 순서로 정확히 ${problems.length}개)
[
  {
    "targetWordVerdict": "ok" | "misused" | "collocation_error",
    "sentenceMeaningBroken": true | false,
    "errors": [{ "text": "오류 설명 (한국어)", "severity": "major" | "minor" }],
    "modelAnswer": "오류를 고친 한국어 문장",
    "feedback": "${targetLang}로 2-3문장"
  }
]

${jsonRules(targetLang)}
- 첫 글자는 반드시 [ 입니다.`;
}

/** 선생님이 추천 문장을 고쳤을 때 그 기준으로 다시 판정한다. */
function generateRegradePrompt(
  word: string,
  studentSentence: string,
  teacherAnswer: string,
  targetLang: string
): string {
  return `당신은 한국어 교육 전문가입니다. 선생님이 학생 문장을 검토하고 정답 기준 문장을 제시했습니다.
이 기준에 비추어 학생 문장을 다시 판정해주세요.

- 단어 (기본형): ${word}
- 학생 문장: ${studentSentence}
- 선생님이 제시한 정답 문장: ${teacherAnswer}
- 피드백 언어: ${targetLang}

${JUDGEMENT_RULES}

**추가 지시**
- modelAnswer는 선생님이 제시한 문장(${teacherAnswer})을 그대로 사용하세요.
- errors는 학생 문장과 선생님 문장의 차이를 근거로 작성하세요.

**응답 형식**
{
  "targetWordVerdict": "ok" | "misused" | "collocation_error",
  "sentenceMeaningBroken": true | false,
  "errors": [{ "text": "오류 설명 (한국어)", "severity": "major" | "minor" }],
  "modelAnswer": "${teacherAnswer}",
  "feedback": "${targetLang}로 2-3문장"
}

${jsonRules(targetLang)}
- 첫 글자는 반드시 { 입니다.`;
}

// ── 점수 계산 — 모델이 아니라 여기가 정한다 ─────────────────────────

/** 모델 응답을 신뢰하지 않고 형태를 맞춘다. */
function normalizeRaw(input: unknown, fallbackSentence: string): RawGrade {
  const r = (input ?? {}) as Record<string, unknown>;

  const verdict = r.targetWordVerdict;
  const targetWordVerdict: TargetWordVerdict =
    verdict === "misused" || verdict === "collocation_error" ? verdict : "ok";

  const errors: GradedError[] = Array.isArray(r.errors)
    ? r.errors
        .map((e) => {
          const item = (e ?? {}) as Record<string, unknown>;
          const text = typeof item.text === "string" ? item.text.trim() : String(item ?? "").trim();
          const severity: ErrorSeverity = item.severity === "major" ? "major" : "minor";
          return { text, severity };
        })
        .filter((e) => e.text !== "")
    : [];

  const modelAnswer =
    typeof r.modelAnswer === "string" && r.modelAnswer.trim() !== ""
      ? r.modelAnswer.trim()
      : fallbackSentence;

  return {
    targetWordVerdict,
    sentenceMeaningBroken: r.sentenceMeaningBroken === true,
    errors,
    modelAnswer,
    feedback: typeof r.feedback === "string" ? r.feedback.trim() : "",
  };
}

/**
 * 100점에서 심각도만큼 깎는다. 치명적 판정이 있으면 점수와 무관하게 불합격이고,
 * 점수도 CRITICAL_SCORE_CAP 이하로 눌러 "합격선을 넘었는데 불합격"이라는
 * 모순된 화면이 나오지 않게 한다.
 */
function computeGrade(raw: RawGrade): GradeResponse {
  const hasCritical = raw.targetWordVerdict !== "ok" || raw.sentenceMeaningBroken;

  const deducted = raw.errors.reduce((sum, e) => sum + (DEDUCTION[e.severity] ?? DEDUCTION.minor), 0);
  let totalScore = Math.max(0, Math.min(100, 100 - deducted));
  if (hasCritical) totalScore = Math.min(totalScore, CRITICAL_SCORE_CAP);

  return {
    ...raw,
    totalScore,
    isPassed: !hasCritical && totalScore >= PASS_THRESHOLD,
  };
}

function failedGrade(studentSentence: string): GradeResponse {
  return {
    targetWordVerdict: "ok",
    sentenceMeaningBroken: false,
    errors: [],
    modelAnswer: studentSentence,
    feedback: GRADING_FAILURE_FEEDBACK,
    totalScore: 0,
    isPassed: false,
  };
}

// ── Claude 호출 ────────────────────────────────────────────────────

async function callClaude(prompt: string, systemInstruction: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        // Sonnet 5는 adaptive thinking이 기본이고 thinking도 이 예산을 나눠 쓴다.
        max_tokens: MAX_TOKENS,
        // temperature는 넣지 말 것 — Sonnet 5는 기본값이 아닌 sampling 파라미터를 400으로 거부한다.
        // effort: 학생이 화면에서 기다리는 동기 호출이라 기본값 high보다 낮춘다.
        output_config: { effort: "medium" },
        system: systemInstruction,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    // adaptive thinking이 켜지면 content[0]이 thinking 블록일 수 있다.
    // 인덱스로 집지 말고 type === "text"인 블록을 찾아야 한다.
    const content = data.content?.find(
      (block: { type?: string; text?: string }) => block?.type === "text"
    )?.text;

    if (!content) throw new Error("No content received from AI");

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    return jsonStr;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

const SYSTEM_INSTRUCTION =
  "You are a Korean language education expert. You classify errors in student sentences. " +
  "You never assign numeric scores. Respond only in valid JSON with no markdown.";

// ── 핸들러 ─────────────────────────────────────────────────────────

serve(async (req) => {
  console.log("Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const reqBody = await req.json();
    const targetLang = reqBody.translationLanguage || "English";

    // 재채점 모드: 선생님이 추천 문장을 수정했을 때
    if (reqBody.regenerate_feedback === true) {
      const { word, studentSentence, modelAnswer } = reqBody;
      if (!word || !studentSentence || !modelAnswer) {
        return json({ error: "word, studentSentence, modelAnswer는 필수입니다." }, 400);
      }

      const jsonStr = await callClaude(
        generateRegradePrompt(word, studentSentence, modelAnswer, targetLang),
        SYSTEM_INSTRUCTION
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // 판정을 못 얻었으면 점수를 건드리지 않는다. 피드백만 돌려주면
        // 클라이언트가 점수 갱신을 건너뛴다(QuizResultDialog는 totalScore 유무로 분기).
        return json({ feedback: jsonStr.trim() });
      }

      const graded = computeGrade(normalizeRaw(parsed, studentSentence));
      // 선생님이 제시한 문장이 기준이므로 modelAnswer는 덮어쓰지 않는다.
      return json({ ...graded, modelAnswer });
    }

    // 일괄 채점 모드
    if (reqBody.problems && Array.isArray(reqBody.problems)) {
      const { problems, difficulty } = reqBody as BatchGradeRequest;
      if (!problems.length || !difficulty) {
        return json({ error: "problems 배열과 difficulty는 필수입니다." }, 400);
      }

      console.log(`Batch grading ${problems.length} sentences at ${difficulty}, feedback in ${targetLang}`);

      const jsonStr = await callClaude(
        generateBatchGradingPrompt(
          problems.map((p) => ({ word: p.word, studentSentence: p.studentSentence })),
          difficulty,
          targetLang
        ),
        SYSTEM_INSTRUCTION
      );

      let parsedList: unknown[];
      try {
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) {
          console.error("AI returned non-array JSON:", jsonStr.substring(0, 500));
          throw new Error("Expected JSON array response from AI");
        }
        parsedList = parsed;
      } catch (parseError) {
        console.error("JSON parse failed. Raw AI response:", jsonStr.substring(0, 1000));
        throw new Error(
          `AI returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      if (parsedList.length !== problems.length) {
        console.warn(`Result count mismatch: expected ${problems.length}, got ${parsedList.length}`);
      }

      const results = problems.map((p, i) => ({
        problemId: p.problemId || `problem_${i}`,
        ...(i < parsedList.length
          ? computeGrade(normalizeRaw(parsedList[i], p.studentSentence))
          : failedGrade(p.studentSentence)),
      }));

      console.log(`Batch grading complete: ${results.length} results`);
      return json({ results });
    }

    // 단일 채점 모드
    const { word, studentSentence, difficulty }: GradeRequest = reqBody;
    if (!word || !studentSentence || !difficulty) {
      return json({ error: "word, studentSentence, difficulty는 필수입니다." }, 400);
    }

    console.log(`Grading "${word}" at ${difficulty}, feedback in ${targetLang}`);

    const jsonStr = await callClaude(
      generateSingleGradingPrompt(word, studentSentence, difficulty, targetLang),
      SYSTEM_INSTRUCTION
    );
    const graded = computeGrade(normalizeRaw(JSON.parse(jsonStr), studentSentence));

    console.log(
      `Grading complete: ${graded.totalScore}점 (${graded.isPassed ? "합격" : "불합격"}), ` +
        `목표단어=${graded.targetWordVerdict}, 의미붕괴=${graded.sentenceMeaningBroken}, 오류=${graded.errors.length}건`
    );

    return json(graded);
  } catch (error) {
    console.error("Error in grade-sentence function:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
