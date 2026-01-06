import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizRequest {
  words: string[];
  difficulty: string;
  translationLanguage: string;
  wordsPerSet: number;
  regenerateSingle?: boolean;
  apiProvider?: "openai" | "gemini" | "gemini-pro";
}

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "영어",
  zh_CN: "중국어 간체",
  zh_TW: "중국어 번체",
  ja: "일본어",
  vi: "베트남어",
  th: "태국어",
  id: "인도네시아어",
  es: "스페인어",
  fr: "프랑스어",
  de: "독일어",
  ru: "러시아어",
};

const generateDetailedPrompt = (words: string[], difficulty: string, languageName: string) => {
  return `당신은 한국어 교육 전문가입니다. 다음 단어들을 사용하여 ${difficulty} 수준의 빈칸 채우기 문제를 만들어주세요.

단어 목록 (기본형): ${words.join(', ')}

**중요: 위 단어 목록의 각 단어마다 정확히 1개씩, 총 ${words.length}개의 문제를 생성해주세요. 모든 단어가 반드시 사용되어야 합니다.**

중요 규칙:

0. **자연스러운 한국어 표현 사용 - 매우 중요!**:
   - ✅ 자연스러운 조합: "밥을 먹다", "식사하다", "집에 가다", "귀가하다", "옷을 입다"
   - ❌ 부자연스러운 조합: "식사를 먹다", "한국 언어를 배우다"
   - 난이도별 어휘 선택:
     * A1/A2: 일상 어휘 (밥을 먹다, 집에 가다, 옷을 입다)
     * B1/B2: 한자어 가능 (식사하다, 귀가하다, 착용하다)
     * C1/C2: 격식체 한자어 (용무를 보다, 복귀하다)

1. **난이도별 어휘 수준 (TOPIK 기준) - 매우 중요!**:
   
   **A1 (TOPIK I 초급 1급)**: 
   - 어휘: 먹다, 자다, 가다, 오다, 보다, 집, 학교, 친구, 가족, 물, 밥, 좋다, 크다, 작다
   - 기본 문법: -아요/어요, -ㅂ니다/습니다, -(이)가 아니다
   - 연결: -고, -지만, -아서/어서
   - 의지/희망: -고 싶다, -(으)ㄹ 거예요, -(으)ㄹ게요, -(으)러 가다/오다, -(으)려고
   - 능력: -(으)ㄹ 수 있다/없다
   - 과거: -았어요/었어요
   - 추측: -(으)ㄴ 것 같다, -(으)ㄹ 것 같다
   - 명령/권유: -(으)세요, -(으)ㅂ시다
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 5-8단어
   
   **A2 (TOPIK I 초중급 2급)**:
   - 어휘: 준비하다, 연습하다, 공부하다, 시장, 병원, 날씨, 계절, 편하다, 재미있다
   - 연결: -(으)니까, -(으)면, -(으)면서, -거나, -는데
   - 시간: -기 전에, -(으)ㄴ 후에, -(으)ㄹ 때, -(으)ㄴ 지
   - 의무: -아야/어야 하다/되다
   - 부정: -지 않다, -지 못하다, -지 말다
   - 경험: -(으)ㄴ 적이 있다/없다
   - 추측/확인: -(으)ㄴ데(요), 군요, 네요, -(이)지요?
   - 변화: -게 되다
   - 도움: -아/어 주다, -아/어 보다
   - 희망: -았/었으면 좋겠다
   - 기타: -기로 하다, -기 때문에, -(으)ㄹ까 하다, -(으)ㄹ까 봐, 는 게 좋겠다
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 9-12단어
   
   **B1 (TOPIK II 중급 3급)**:
   - 어휘: 계획, 경험, 의견, 문제, 환경, 건강, 발전하다, 변화하다, 증가하다, 중요하다
   - 연결어미: -느라고, -는 김에, -는 대신에, -는 바람에, -다가, -다가는, -다시피, -더니, -던
   - 추측/판단: -(으)ㄴ/는 것 같다, -(으)ㄴ가 보다, -나 보다, -(으)ㄹ 텐데
   - 목적/이유: -기 위해서, -(으)려면, -기 때문에, -는 덕분에, -(으)므로
   - 정도/비교: -(으)ㄹ 정도로, -는 만큼, -아/어서 그런지
   - 양보: -아도/어도, -지만, -(으)ㄴ데(도)
   - 나열: -(이)나, -거나
   - 피동/사동: -게 하다
   - 기타: -(으)ㄴ 채로, -는 걸 보니까, -는 법이다, -는 편이다, -는 중이다, -다 보니까, -다 보면
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ (필수!)
   - 길이: 13-17단어
   
   **B2 (TOPIK II 중고급 4급)**:
   - 어휘: 상황, 현상, 영향, 결과, 원인, 심각하다, 복잡하다, 다양하다, 강조하다
   - 고급 연결: -(으)므로, -는 통에, -(으)ㄹ수록, -는 한편, -는 반면에, -는 대로, -도록
   - 피동/사동: -게 하다, -게 되다
   - 추측/양태: -(으)ㄹ 텐데, -(으)ㄹ 모양이다, -(으)ㄹ 셈이다, -(으)ㄹ 리가 없다
   - 목적: -(으)ㄹ 겸 (해서)
   - 정도: -(으)ㄹ 만하다, -(으)ㄹ 뿐만 아니라, -(으)ㄹ 뿐이다, -만 못하다
   - 이유: -는 탓에, -(으)ㄴ/는 덕분에, -길래
   - 가정/조건: -(으)ㄹ지라도, -(으)ㄹ 테니까, -(으)면 되다
   - 후회: -(으)ㄹ걸 (그랬다), -(으)ㄹ 뻔하다
   - 의도: -(으)려다가, -(으)려던 참이다
   - 기타: -는 사이에, -는 수가 있다, -는 수밖에 없다, -(으)ㄴ/는 척하다, -곤 하다
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 18-23단어
   
   **C1 (TOPIK II 고급 5급 이상)**:
   - 어휘: 지속, 체계, 필수, 도출, 분석, 기여하다, 촉진하다, 저해하다, 효율적, 합리적
   - 고급 문법: -(으)ㄹ지라도, -던, -(으)ㄴ 바 있다, -(으)로 인해(서), -에 따라(서), -에 의해(서)
   - 격식체: -ㅂ니다/습니다, -는바, -고자
   - 인용: -다고 하다, -(으)라고 하다, -냐고 하다, -자고 하다
   - 회상: -더니, -더라, -더라고, -더라도, -던, -던가요, -던데
   - 강조: -(이)야말로, -는/은커녕, 마저, 조차
   - 나열/선택: -다거나, -(으)ㄹ까 말까, -든지
   - 비유: -듯이, -다시피
   - 한정: -(으)ㄴ/는 한, -(이)나 -(이)나 할 것 없이
   - 기타: -을/를 비롯한, -을/를 통해(서), -에 관해(서), -에 대해(서), -(으)ㄴ/는들, -기 십상이다
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 24-28단어
   
   **C2 (최고급)**:
   - 사용 가능: 학술 용어, 전문 어휘, 관용 표현
   - 문법: 매우 복잡한 구조, 격식체
   - 길이: 29+ 단어

2. **동사/형용사 문법 활용 - 매우 중요!**:
   동사/형용사는 다양한 문법으로 활용해주세요. 단순히 "-아요/어요"만 사용하지 마세요!
   
   **관형사형 (명사 수식) - 필수!**:
   - 현재: -는 (동사), -(으)ㄴ (형용사)
     예: "먹는 음식", "주요한 역할", "큰 집"
   - 과거: -(으)ㄴ
     예: "먹은 음식", "본 영화"
   - 미래: -(으)ㄹ
     예: "먹을 음식", "갈 곳"
   
   **다양한 어미 활용 (TOPIK 스크린샷 기준)**:
   - A1 (1급): -아요/어요, -ㅂ니다/습니다, -고, -지만, -아서/어서, -고 싶다, -(으)ㄹ 거예요, -(으)ㄹ 수 있다, -았어요/었어요, -(으)러 가다/오다, -(으)려고, -(으)ㄹ게요
   - A2 (2급): -(으)니까, -(으)면, -기 전에, -(으)ㄴ 후에, -(으)ㄹ 때, -아야/어야 하다, -(으)면서, -(으)ㄴ 적이 있다, -거나, -는데, -게 되다, -아/어 주다, -기로 하다, -(으)ㄹ까 하다
   - B1 (3급): -느라고, -기 위해서, -는 바람에, -기 때문에, -(으)ㄴ/는 것 같다, -다가, -는 김에, -는 덕분에, -는 대신에, -더니, -던, -다 보니까, -는 편이다, -는 중이다, -(으)ㄴ 채로
   - B2 (4급): -게 되다, -(으)므로, -(으)ㄹ수록, -는 반면에, -(으)ㄹ 뿐만 아니라, -는 탓에, -는 통에, -(으)ㄹ 텐데, -(으)ㄹ 모양이다, -(으)ㄹ 리가 없다, -(으)ㄹ 뻔하다, -곤 하다
   - C1 (5급 이상): -(으)ㄴ 바 있다, -(으)로 인해, -에 따라, -더니, -더라, -던, -고자, -(으)ㄹ지라도, -는/은커녕, 마저, 조차, -듯이, -(이)야말로

   **hint 작성 시 (문법 형태만 사용)**:
   - **관형사형**: "(으)ㄴ", "-는", "-(으)ㄹ" 
     * 중요: sentence에는 어미 포함 X!
     * ✅ 예: sentence: "경제에 ( ) 역할을...", answer: "주요한", hint: "(으)ㄴ"
     * ❌ 잘못: sentence: "경제에 ( )(으)ㄴ 역할을...", answer: "주요한", hint: "(으)ㄴ" (중복!)
   - **일반 활용**: "-아요/어요", "-기 전에", "-느라고", "-게 되다", "-았어요/었어요", "-(으)ㄴ 바 있다" 등
     * 예: sentence: "공부( ) 시간이 없었어요.", answer: "하느라고", hint: "-느라고"

3. **난이도별 문장 예시 (TOPIK 문법 활용)**:
   - A1 (1급): "저는 내일 학교에 ( ).", answer: "갈 거예요", hint: "-(으)ㄹ 거예요"
   - A2 (2급): "학교에 ( ) 밥 먹었어요.", answer: "가기 전에", hint: "-기 전에"
   - B1 (3급): "숙제를 ( ) 시간이 없었어요.", answer: "하느라고", hint: "-느라고"
   - B2 (4급): "노력( ) 실력이 늘어요.", answer: "할수록", hint: "-(으)ㄹ수록"
   - C1 (5급): "정책이 발전에 ( ).", answer: "기여한 바 있습니다", hint: "-(으)ㄴ 바 있다"

4. **word (기본형)는 입력받은 단어 그대로**

5. **answer (정답) - 매우 중요!**:
   - **명사 + 조사**: 조사 반드시 포함! (예: 지구력이, 발굽을, 산악지대로, 망자의)
     * ✅ 올바른 예: answer: "지구력이", sentence: "( ) 필요해요", hint: "이/가"
     * ❌ 잘못된 예: answer: "지구력", sentence: "( )이/가 필요해요", hint: "이/가" (조사가 sentence에 있으면 안 됨!)
     * ✅ 올바른 예: answer: "발굽을", sentence: "( ) 다쳐서", hint: "을/를"
     * ❌ 잘못된 예: answer: "발굽", sentence: "( )을/를 다쳐서", hint: "을/를"
     * ✅ 올바른 예: answer: "산악지대로", sentence: "( ) 이루어져", hint: "(으)로"
     * ❌ 잘못된 예: answer: "산악지대", sentence: "( )(으)로 이루어져", hint: "(으)로"
     * ✅ 올바른 예: answer: "망자의", sentence: "( ) 평화를", hint: "의"
     * ❌ 잘못된 예: answer: "망자", sentence: "( )의 평화를", hint: "의"
   - **동사/형용사**: hint에 표시된 문법 형태로 완전히 활용 (예: 발견됐어요, 올랐어요, 주요한)
     * 예: answer: "하느라고", hint: "-느라고"
     * 예: answer: "갈 거예요", hint: "-(으)ㄹ 거예요"

6. **sentence (문장) 작성 규칙 - 매우 중요!**:
   - **명사 + 조사**: 빈칸 ( ) 뒤에 조사 절대 쓰지 말기! 조사는 answer에 포함됨
     * ✅ 올바른 예: "마라톤을 잘하기 위해서는 ( ) 필요해요." (answer: "지구력이", hint: "이/가")
     * ❌ 잘못된 예: "마라톤을 잘하기 위해서는 ( )이/가 필요해요." (조사 중복!)
     * ✅ 올바른 예: "말이 거친 땅을 달리다가 ( ) 다쳐서" (answer: "발굽을", hint: "을/를")
     * ❌ 잘못된 예: "말이 거친 땅을 달리다가 ( )을/를 다쳐서" (조사 중복!)
   - **동사/형용사 - 관형사형일 때**: 빈칸 ( ) 뒤에 아무것도 쓰지 말고 바로 명사
     * ✅ 올바른 예: "경제에 ( ) 역할을...", "( ) 음식이..."
     * ❌ 잘못된 예: "경제에 ( )(으)ㄴ 역할을...", "( )(으)ㄴ 음식이...\" (중복 발생!)
   - **동사/형용사 - 일반 활용일 때**: 빈칸 ( ) 뒤에 문장 계속
   - **조사 중복 절대 금지!**
   - **문장 끝 마침표/물음표 필수**
   - **${difficulty} 어휘 수준 준수!**

7. **hint 규칙 - 매우 중요!**:
   - **명사 + 조사**: answer에 포함된 조사 패턴을 hint에 표시
     * 예: answer: "지구력이" → hint: "이/가"
     * 예: answer: "발굽을" → hint: "을/를"
     * 예: answer: "산악지대로" → hint: "(으)로"
     * 예: answer: "망자의" → hint: "의"
     * 예: answer: "학교에게" → hint: "에게"
     * 예: answer: "집에서" → hint: "에서"
   - **명사 + 조사가 없는 경우**: "" (빈 문자열)
     * 예: 시간 부사처럼 쓰이는 명사 (오늘, 내일, 어제 등) → hint: ""
     * 예: answer: "오늘", sentence: "저는 ( ) 회사에 가요." → hint: ""
   - **동사/형용사**: 문법 형태만 (예: "-았어요/었어요", "(으)ㄴ", "-는", "-기 전에")
   - 설명이나 의미 절대 쓰지 않기!

8. 문제 순서는 랜덤

응답 형식 (각 문제에 ${languageName} 번역 포함):
{
  "problems": [
    {
      "word": "기본형",
      "answer": "정답 (활용형)",
      "sentence": "${difficulty} 수준 어휘로 만든 문장 ( ).",
      "hint": "문법 형태만 또는 빈 문자열",
      "translation": "정답이 들어간 완전한 문장의 ${languageName} 번역"
    }
  ]
}

번역 규칙:
- ⚠️ 중요: translation에는 ( ) 사용 금지! 정답 단어가 들어간 완전한 문장으로 번역하세요
- 한국어 sentence의 ( )에 answer를 채운 완전한 문장을 ${languageName}로 번역
- 자연스러운 ${languageName} 문장으로 번역
- 학생이 문맥을 이해할 수 있도록 정확하게 번역

🚨 중요: 반드시 JSON 형식으로만 응답하세요!
- 어떤 설명문, 서론, 결론도 추가하지 마세요
- \`\`\`json 이나 \`\`\` 마크다운 코드 블록 사용 금지
- 오직 { "problems": [...] } JSON만 출력하세요
- 첫 글자는 반드시 { 로 시작해야 합니다`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: '인증에 실패했습니다.' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has teacher or admin role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: '프로필 정보를 가져올 수 없습니다.' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profileData.role !== 'teacher' && profileData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '퀴즈 생성 권한이 없습니다. 선생님 또는 관리자만 가능합니다.' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} (${profileData.role}) generating quiz`);

    const { words, difficulty, translationLanguage, wordsPerSet, regenerateSingle, apiProvider = "openai" }: QuizRequest = await req.json();
    
    const languageName = LANGUAGE_NAMES[translationLanguage] || "영어";
    const prompt = generateDetailedPrompt(words, difficulty, languageName);

    console.log(`Generating quiz using ${apiProvider} for ${words.length} words at ${difficulty} level`);

    let content: string;

    if (apiProvider === "gemini" || apiProvider === "gemini-pro") {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const modelName = apiProvider === "gemini-pro" ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.7,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (${modelName}):`, response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: [
            { 
              role: "system", 
              content: "You are a helpful assistant that generates Korean language learning quizzes. You must respond ONLY with valid JSON." 
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content;
    }

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    // Validate JSON starts correctly
    if (!jsonStr.startsWith("{")) {
      console.error("AI response not JSON:", jsonStr.substring(0, 200));
      throw new Error("AI가 JSON이 아닌 텍스트로 응답했습니다. 다시 시도해주세요.");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", jsonStr.substring(0, 200));
      throw new Error("AI 응답을 JSON으로 변환할 수 없습니다. 다시 시도해주세요.");
    }

    if (!parsed.problems || parsed.problems.length === 0) {
      throw new Error("생성된 문제가 없습니다");
    }

    // Shuffle problems (Fisher-Yates)
    const shuffledProblems = [...parsed.problems];
    for (let i = shuffledProblems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledProblems[i], shuffledProblems[j]] = [shuffledProblems[j], shuffledProblems[i]];
    }

    const problems: Problem[] = shuffledProblems.map((p: any, index: number) => ({
      id: `problem-${Date.now()}-${index}`,
      word: p.word,
      answer: p.answer,
      sentence: p.sentence,
      hint: p.hint || "",
      translation: p.translation,
    }));

    console.log(`Successfully generated ${problems.length} problems`);

    return new Response(
      JSON.stringify({ problems }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-quiz function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
