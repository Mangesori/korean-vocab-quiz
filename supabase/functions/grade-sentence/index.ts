import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading grade-sentence function...");

interface GradeRequest {
  word: string;
  studentSentence: string;
  difficulty: string;
  problemId?: string;
}

// 일괄 채점 요청
interface BatchGradeRequest {
  problems: GradeRequest[];
  difficulty: string;
  translationLanguage?: string;
}

interface GradeResponse {
  wordUsageScore: number;
  grammarScore: number;
  naturalnessScore: number;
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
}

const DIFFICULTY_DESCRIPTIONS: Record<string, string> = {
  A1: "TOPIK 1급 (초급) - 기본 문법과 간단한 문장 구조",
  A2: "TOPIK 2급 (초중급) - 일상적인 표현과 기본 연결어미",
  B1: "TOPIK 3급 (중급) - 다양한 연결어미와 복잡한 문장 구조",
  B2: "TOPIK 4급 (중고급) - 고급 문법과 추상적 표현",
  C1: "TOPIK 5급 (고급) - 격식체와 학술적 표현",
  C2: "TOPIK 6급 (최고급) - 전문적이고 정교한 문장 구조",
};

const generateSingleGradingPrompt = (
  word: string,
  studentSentence: string,
  difficulty: string,
  translationLanguage: string
) => {
  const difficultyDesc = DIFFICULTY_DESCRIPTIONS[difficulty] || DIFFICULTY_DESCRIPTIONS["A1"];

  return `당신은 한국어 교육 전문가입니다. 학생이 주어진 단어를 사용하여 작성한 문장을 채점해주세요.

**채점 대상:**
- 단어 (기본형): ${word}
- 학생 문장: ${studentSentence}
- 요구 난이도: ${difficulty} (${difficultyDesc})
- 피드백 및 해설 언어: ${translationLanguage}

**채점 기준 (각 0-100점):**

1. **단어 사용 (wordUsageScore)**:
   - 주어진 단어가 문장에 포함되어 있는가?
   - 단어가 올바른 활용형으로 사용되었는가?
   - 단어의 의미가 문맥에 맞게 사용되었는가?
   - 100점: 완벽하게 올바른 사용
   - 70-99점: 사용했으나 약간의 문제가 있음
   - 0-69점: 단어를 사용하지 않았거나 완전히 잘못 사용

2. **문법 정확성 (grammarScore)**:
   - 조사 사용이 올바른가?
   - 어미 활용이 정확한가?
   - 문장 구조가 문법적으로 맞는가?
   - 100점: 문법 오류 없음
   - 80-99점: 사소한 문법 오류
   - 50-79점: 의미 전달은 되지만 문법 오류가 있음
   - 0-49점: 심각한 문법 오류

3. **자연스러움 (naturalnessScore)**:
   - 한국어 원어민이 실제로 사용할 법한 표현인가?
   - 어색하거나 부자연스러운 표현이 없는가?
   - 난이도에 맞는 표현을 사용했는가?
   - 100점: 매우 자연스러움
   - 70-99점: 대체로 자연스러움
   - 50-69점: 이해는 되지만 어색함
   - 0-49점: 부자연스러움

**응답 형식 (JSON만 출력):**
{
  "wordUsageScore": 숫자,
  "grammarScore": 숫자,
  "naturalnessScore": 숫자,
  "totalScore": 세 점수의 가중 평균 (단어사용 40%, 문법 35%, 자연스러움 25%),
  "feedback": "구체적인 피드백을 ${translationLanguage}로 작성. 잘한 점과 개선할 점을 2-3문장으로 설명. totalScore가 100점이 아닌 경우 반드시 마지막에 'Model Answer: [수정된 문장]' 형태로 모범 답안을 포함. 모범 답안은 학생의 문장을 기반으로 틀린 부분만 수정한 문장이어야 하며, 완전히 다른 새로운 문장을 만들면 안 됨.",
  "modelAnswer": "학생이 제출한 문장을 바탕으로 틀린 부분만 수정한 교정 문장. 학생 문장의 구조와 의미를 최대한 유지하면서 문법, 조사, 활용형 등의 오류만 수정. totalScore가 100점이면 학생 문장을 그대로 반환.",
  "isPassed": totalScore >= 70
}

🚨 중요:
- 반드시 JSON 형식으로만 응답하세요
- 마크다운 코드 블록 사용 금지
- 첫 글자는 반드시 { 로 시작해야 합니다
- 피드백("feedback" 내용)은 반드시 ${translationLanguage}로 번역해서 작성하세요
- modelAnswer는 반드시 학생 문장("${studentSentence}")을 기반으로 수정한 것이어야 합니다. 학생 문장과 완전히 다른 새로운 문장을 만들지 마세요.`;
};

const generateBatchGradingPrompt = (
  problems: { word: string; studentSentence: string }[],
  difficulty: string,
  translationLanguage: string
) => {
  const difficultyDesc = DIFFICULTY_DESCRIPTIONS[difficulty] || DIFFICULTY_DESCRIPTIONS["A1"];

  const problemsList = problems
    .map((p, i) => `${i + 1}. 단어: "${p.word}" / 학생 문장: "${p.studentSentence}"`)
    .join("\n");

  return `당신은 한국어 교육 전문가입니다. 학생이 주어진 단어를 사용하여 작성한 여러 문장을 한꺼번에 채점해주세요.

**요구 난이도:** ${difficulty} (${difficultyDesc})
**피드백 및 해설 언어:** ${translationLanguage}

**채점 대상 문장들:**
${problemsList}

**채점 기준 (각 0-100점):**

1. **단어 사용 (wordUsageScore)**: 단어가 올바른 활용형으로, 문맥에 맞게 사용되었는가?
2. **문법 정확성 (grammarScore)**: 조사, 어미 활용, 문장 구조가 정확한가?
3. **자연스러움 (naturalnessScore)**: 원어민이 실제로 사용할 법한 자연스러운 표현인가?

**응답 형식 (JSON 배열만 출력):**
[
  {
    "wordUsageScore": 숫자,
    "grammarScore": 숫자,
    "naturalnessScore": 숫자,
    "totalScore": 가중 평균 (단어사용 40%, 문법 35%, 자연스러움 25%),
    "feedback": "구체적인 피드백을 ${translationLanguage}로 2-3문장 작성. totalScore가 100점이 아니면 'Model Answer: [수정된 문장]' 포함. 학생 문장을 기반으로 틀린 부분만 수정.",
    "modelAnswer": "학생 문장을 바탕으로 틀린 부분만 수정한 교정 문장. 100점이면 학생 문장 그대로 반환. 반환 형태는 오직 수정된 문장 텍스트.",
    "isPassed": totalScore >= 70
  },
  ...
]

🚨 중요:
- 반드시 JSON 배열 형식으로만 응답하세요
- 배열 순서는 입력 문장 순서와 동일해야 합니다 (총 ${problems.length}개)
- 마크다운 코드 블록 사용 금지
- 첫 글자는 반드시 [ 로 시작해야 합니다
- 피드백은 격려하는 톤으로 작성하세요
- modelAnswer는 반드시 해당 학생 문장을 기반으로 수정한 것이어야 합니다
🚨 안내: 피드백 설명은 반드시 ${translationLanguage} 언어로 제공하세요.`;
};

function validateAndClampResult(result: GradeResponse): GradeResponse {
  result.wordUsageScore = Math.min(100, Math.max(0, result.wordUsageScore || 0));
  result.grammarScore = Math.min(100, Math.max(0, result.grammarScore || 0));
  result.naturalnessScore = Math.min(100, Math.max(0, result.naturalnessScore || 0));
  result.totalScore = Math.round(
    result.wordUsageScore * 0.4 +
    result.grammarScore * 0.35 +
    result.naturalnessScore * 0.25
  );
  result.isPassed = result.totalScore >= 70;
  return result;
}

async function callClaude(prompt: string, systemInstruction: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
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
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("No content received from AI");
    }

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

serve(async (req) => {
  console.log("Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    const targetLang = reqBody.translationLanguage || "English"; // Default to English if not provided

    // 일괄 채점 모드: problems 배열이 있는 경우
    if (reqBody.problems && Array.isArray(reqBody.problems)) {
      const { problems, difficulty } = reqBody as BatchGradeRequest;

      if (!problems.length || !difficulty) {
        return new Response(
          JSON.stringify({ error: "problems 배열과 difficulty는 필수입니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Batch grading ${problems.length} sentences at ${difficulty} level, feedback in ${targetLang}`);

      const prompt = generateBatchGradingPrompt(
        problems.map((p) => ({ word: p.word, studentSentence: p.studentSentence })),
        difficulty,
        targetLang
      );

      const systemInstruction = "You are a Korean language education expert. You grade student sentences accurately and provide helpful feedback. Respond only in valid JSON array format.";
      const jsonStr = await callClaude(prompt, systemInstruction);

      let results: GradeResponse[];
      try {
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) {
          console.error("AI returned non-array JSON:", jsonStr.substring(0, 500));
          throw new Error("Expected JSON array response from AI");
        }
        results = parsed;
      } catch (parseError) {
        console.error("JSON parse failed. Raw AI response:", jsonStr.substring(0, 1000));
        throw new Error(`AI returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // 결과 수가 문제 수와 맞는지 확인
      if (results.length !== problems.length) {
        console.warn(`Result count mismatch: expected ${problems.length}, got ${results.length}`);
      }

      // 각 결과를 검증하고 클램핑
      const validatedResults = results.map((r) => validateAndClampResult(r));

      // problemId 매핑
      const responseData = problems.map((p, i) => ({
        problemId: p.problemId || `problem_${i}`,
        ...validatedResults[i] || {
          wordUsageScore: 0,
          grammarScore: 0,
          naturalnessScore: 0,
          totalScore: 0,
          feedback: "채점에 실패했습니다.",
          modelAnswer: "",
          isPassed: false,
        },
      }));

      console.log(`Batch grading complete: ${responseData.length} results`);

      return new Response(JSON.stringify({ results: responseData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 단일 채점 모드 (기존 호환성 유지)
    const { word, studentSentence, difficulty }: GradeRequest = reqBody;

    if (!word || !studentSentence || !difficulty) {
      return new Response(
        JSON.stringify({ error: "word, studentSentence, difficulty는 필수입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Grading sentence for word "${word}" at ${difficulty} level, feedback in ${targetLang}`);

    const prompt = generateSingleGradingPrompt(word, studentSentence, difficulty, targetLang);
    const systemInstruction = "You are a Korean language education expert. You grade student sentences accurately and provide helpful feedback. Respond only in valid JSON format.";
    const jsonStr = await callClaude(prompt, systemInstruction);

    const gradeResult: GradeResponse = JSON.parse(jsonStr);
    const validatedResult = validateAndClampResult(gradeResult);

    console.log(`Grading complete: ${validatedResult.totalScore}점 (${validatedResult.isPassed ? "합격" : "불합격"})`);

    return new Response(JSON.stringify(validatedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in grade-sentence function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
