import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading generate-quiz function...");

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

const DIFFICULTY_GUIDES: Record<string, string> = {
    "A1": `
   **A1 (TOPIK I 초급 1급)**: 
   - 서술/종결: -이에요/예요, -아요/어요, -았어요/었어요(과거), -지요?(확인), -네요(감탄)
   - 지시/장소: 이거/그거/저거, 여기/거기/저기
   - 조사: 은/는(주제), 이/가(주어/아니다), 을/를(목적), 도(포함), (이)나(명사), 에(위치/시간), 에서(장소/출발), 부터&까지, (으)로(방향/수단), 위&아래&앞&뒤
   - 부정: 안(부정), 이/가 아니다
   - 존재: 있어요/없어요
   - 희망: -고 싶다, -고 싶어하다
   - 계획/미래: -(으)ㄹ 거예요(미래), -(으)려고, -(으)려고 해요
   - 능력/숙련도: -(으)ㄹ 수 있다/없다, -(으)ㄹ 줄 알아요/몰라요, 못하다/잘하다/잘 못하다
   - 의무: -아야/어야 해요
   - 이유: -아서/어서(이유), -(으)니까
   - 조건: -(으)면
   - 대조/나열: -지만, 근데, -거나
   - 시간: -(으)ㄹ 때, -기 전, -(으)ㄴ 후
   - 진행: -고 있다
   - 높임: -(으)시다
   - 요청/권유: -(으)세요, -지 마세요, -(으)ㄹ까요?(권유)
   - 도움: -아/어 주다, -아/어 드릴까요?, -아/어 드릴게요, -아/어 주시겠어요?
   - 시도/경험: -아/어 보다
   - 비교: 보다 더
   - 수식: 형용사+-(으)ㄴ
   - 길이: 5-8단어`,

    "A2": `
   **A2 (TOPIK I 초중급 2급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 A2 문법 표현 중 하나를 반드시 포함하세요. **
   
   - 이유(심화): -기 때문에, -(으)ㄹ까 봐(걱정/이유)
   - 순서(연속 동작): -아서/어서(순서)
   - 동시동작/시간: -(으)면서, -는 동안에, -다가(전환), -(으)ㄴ 지(경과)
   - 배경/대조: -는데/-(으)ㄴ데(연결), -(으)ㄴ데요/-는데요(종결), 형용사+-(으)ㄴ데
   - 추측: -(으)ㄹ까요?(추측), -(으)ㄹ 거예요(추측), -(으)ㄹ 것 같다, -(으)ㄴ/는 것 같다
   - 제안/의지/권유: -(으)ㅂ시다, -(으)ㄹ래요, -(으)ㄹ게요, -겠어요, -는 게 좋겠다
   - 결심/약속/계획: -기로 하다, -(으)ㄹ까 하다
   - 희망: -았/었으면 좋겠다
   - 허락/금지: -아도/어도 되다, -(으)면 안 되다
   - 양보: -아도/어도
   - 변화: -게 되다, -아/어지다
   - 경험: -(으)ㄴ 적이 있다/없다
   - 명사화: -는 것
   - 간접화법: -다고 하다, -ㄴ/는다고 하다, -았/었다고 하다, -(으)ㄹ 거라고 하다, -자고 하다, -냐고 하다, -(으)라고 하다
   - 관형사형: (동사)+-는, (동사)+-(으)ㄴ, (동사)+-(으)ㄹ
   - 지식/인지: -(으)ㄴ/는지 알다
   - 길이: 8-12단어`,

    "B1": `
   **B1 (TOPIK II 중급 3급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 B1 문법 표현 중 하나를 반드시 포함하세요. 중급 수준의 연결어미와 표현을 사용해주세요.**

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
   - 길이: 10-15단어`,

    "B2": `
   **B2 (TOPIK II 중고급 4급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 B2 문법 표현 중 하나를 반드시 포함하세요. 고급 연결어미와 피동/사동 표현을 적극적으로 사용해주세요.**

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
   - 길이: 14-20단어`,

    "C1": `
   **C1 (TOPIK II 고급 5급 이상) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 C1 문법 표현 중 하나를 반드시 포함하세요. 격식체와 문어체 표현을 사용하여 고급스러운 문장을 만들어주세요.**

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
   - 길이: 16-24단어`,
   
    "C2": `
   **C2 (최고급) - 핵심 문법 필수 사용**:
   **규칙: 가능한 한 복잡하고 정교한 문장 구조를 사용하세요. 학술적이거나 전문적인 맥락의 어휘와 표현을 적극 사용해주세요.**

   - 사용 가능: 학술 용어, 전문 어휘, 관용 표현
   - 문법: 매우 복잡한 구조, 격식체
   - 길이: 16-28단어`
  };

const generateDetailedPrompt = (words: string[], difficulty: string, languageName: string) => {
  const selectedGuide = DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];

  return `당신은 한국어 교육 전문가입니다. 다음 단어들을 사용하여 ${difficulty} 수준의 빈칸 채우기 문제를 만들어주세요.

단어 목록 (기본형): ${words.join(', ')}

**중요: 위 단어 목록의 각 단어마다 정확히 1개씩, 총 ${words.length}개의 문제를 생성해주세요. 모든 단어가 반드시 사용되어야 합니다.**

중요 규칙:

0. **자연스러운 한국어 표현 사용 - 매우 중요!**:
   - ✅ 자연스러운 조합: "밥을 먹다", "식사하다", "한국어를 배우다", "집에 가다", "귀가하다", "옷을 입다"
   - ❌ 부자연스러운 조합: "식사를 먹다", "한국 언어를 배우다"
   - 난이도별 어휘 선택:
${selectedGuide}

1. **난이도별 어휘 수준 (TOPIK 기준) - 매우 중요!**:
${selectedGuide}

2. **문법 다양성 및 자연스러움 준수 사항 (매우 중요!)**:
   - **제1원칙: 문법 활용 필수**: 위 난이도별 문법 목록에 있는 표현을 *반드시* 사용해야 합니다. '문장이 어색해질 것 같다'는 이유로 단순한 기본 문법(서술/종결)으로 도피하지 마세요. 해당 문법이 자연스럽게 쓰일 수 있는 상황을 설정하여 문장을 만드세요.
   - **다양한 문법 활용 (반복 지양)**: 퀴즈 세트 내에서 동일한 문법 표현이 계속 반복되지 않도록 하세요. 위 목록에 있는 다양한 문법들을 골고루 섞어서 사용하세요. (예: 1번 문제는 '-기 때문에', 2번 문제는 '-다가' 등)

3. **동사/형용사 문법 활용 - 매우 중요!**:
   동사/형용사는 다양한 문법으로 활용해주세요. 단순히 "-아요/어요"만 사용하지 마세요!
   
   **관형사형 (명사 수식) - 필수!**:
   - 현재: -는 (동사), -(으)ㄴ (형용사)
     예: "먹는 음식", "주요한 역할", "큰 집"
   - 과거: -(으)ㄴ
     예: "먹은 음식", "본 영화"
   - 미래: -(으)ㄹ
     예: "먹을 음식", "갈 곳"

   **hint 작성 시 (문법 형태만 사용)**:
   - **관형사형**: "(으)ㄴ", "-는", "-(으)ㄹ" 
     * 중요: sentence에는 어미 포함 X!
     * ✅ 예: sentence: "경제에 ( ) 역할을...", answer: "주요한", hint: "(으)ㄴ"
     * ❌ 잘못: sentence: "경제에 ( )(으)ㄴ 역할을...", answer: "주요한", hint: "(으)ㄴ" (중복!)
   - **일반 활용**: "-아요/어요", "-기 전에", "-느라고", "-게 되다", "-았어요/었어요", "-(으)ㄴ 바 있다" 등
     * 예: sentence: "공부( ) 시간이 없었어요.", answer: "하느라고", hint: "-느라고"

4. **난이도별 문장 예시 (TOPIK 문법 활용)**:
   - A1 (1급): "저는 내일 학교에 ( ).", answer: "갈 거예요", hint: "-(으)ㄹ 거예요"
   - A2 (2급): "학교에 ( ) 밥 먹었어요.", answer: "가기 전에", hint: "-기 전에"
   - B1 (3급): "숙제를 ( ) 시간이 없었어요.", answer: "하느라고", hint: "-느라고"
   - B2 (4급): "노력( ) 실력이 늘어요.", answer: "할수록", hint: "-(으)ㄹ수록"
   - C1 (5급): "정책이 발전에 ( ).", answer: "기여한 바 있습니다", hint: "-(으)ㄴ 바 있다"

5. **word (기본형)는 입력받은 단어 그대로**

6. **answer (정답) - 매우 중요!**:
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

7. **sentence (문장) 작성 규칙 - 매우 중요!**:
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

8. **hint 규칙 - 매우 중요!**:
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
     * **복합 구성(중요!)**: 보조 용언이나 관용 표현 뒤에 어미가 결합된 경우, 반드시 '기본 문법 + 어미' 형태로 표시해주세요.
       - 예: "가기로 했습니다" (기로 하다 + 습니다) -> hint: "-기로 하다 + 습니다"
       - 예: "좋지 않아서" (지 않다 + 아서) -> hint: "-지 않다 + 아서/어서"
       - 예: "할 수 있었어요" (ㄹ 수 있다 + 었을) -> hint: "-(으)ㄹ 수 있다 + 았어요/었어요"
       - 예: "칠 줄 알았어요" (-(으)ㄹ 줄 알다 + 았어요/었어요) -> hint: "-(으)ㄹ 줄 알다 + 았어요/었어요"
   - 설명이나 의미 절대 쓰지 않기!

9. **문제 순서**: 입력받은 단어 목록 순서대로 문제를 생성하세요. (선생님 미리보기용. 학생이 풀 때는 자동으로 섞입니다)

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

🚨🚨🚨 번역 규칙 - 매우 중요! 🚨🚨🚨:
- ⚠️ translation에는 ( ) 사용 금지! 정답 단어가 들어간 완전한 문장으로 번역하세요
- 한국어 sentence의 ( )에 answer를 채운 완전한 문장을 ${languageName}로 번역
- 🔴 **필수: 정답에 해당하는 부분을 반드시 대괄호 []로 감싸주세요!** 🔴
  * 이것은 선택사항이 아닙니다. 모든 translation에서 answer에 해당하는 부분을 대괄호로 표시해야 합니다.
  * 예시 1: 한국어 answer가 "학생이라서"이면 → translation: "Because I'm [a student], I don't have much money."
  * 예시 2: 한국어 answer가 "마음에 들면"이면 → translation: "If I [like] that outfit, I'll buy it right away."
  * 예시 3: 한국어 answer가 "예쁜"이면 → translation: "I want to buy a [pretty] bag."
  * 예시 4: 한국어 answer가 "무료로"이면 → translation: "You can get into the museum [for free] today since it's a public holiday."
  * 예시 5: 한국어 answer가 "알리기 전에"이면 → translation: "I told my parents about my college acceptance before [telling] my friends."
- 대괄호는 정답에 해당하는 부분만 감싸세요 (중첩 금지)
- 대괄호를 빠뜨리면 안 됩니다! 모든 문제의 translation에 반드시 대괄호가 있어야 합니다!
- 자연스러운 ${languageName} 문장으로 번역
- 학생이 문맥을 이해할 수 있도록 정확하게 번역

🚨 중요: 반드시 JSON 형식으로만 응답하세요!
- 어떤 설명문, 서론, 결론도 추가하지 마세요
- \`\`\`json 이나 \`\`\` 마크다운 코드 블록 사용 금지
- 오직 { "problems": [...] } JSON만 출력하세요
- 첫 글자는 반드시 { 로 시작해야 합니다`;
};

serve(async (req) => {
  console.log("Request received:", req.method, req.url); // Log every request

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 130000); // 130 second timeout

      try {
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
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gemini API error (${modelName}):`, response.status, errorText);
          throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }


    } else {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 130000); // 130 second timeout

      try {
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
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

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
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }


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

    // Keep problems in original order (same as input words)
    const orderedProblems: any[] = [];
    const availableProblems = [...parsed.problems];
    
    for (const word of words) {
      const matchIndex = availableProblems.findIndex((p: any) => p.word.trim() === word.trim());
      if (matchIndex !== -1) {
        orderedProblems.push(availableProblems[matchIndex]);
        availableProblems.splice(matchIndex, 1);
      } else {
        // If exact match not found, store null to fill later
        orderedProblems.push(null);
      }
    }

    // Fill any unmatched slots with remaining problems
    for (let i = 0; i < orderedProblems.length; i++) {
      if (orderedProblems[i] === null) {
        if (availableProblems.length > 0) {
          orderedProblems[i] = availableProblems.shift();
        }
      }
    }
    
    // Filter out any remaining nulls (in case AI generated fewer problems than requested)
    const validProblems = orderedProblems.filter(p => p !== null);
    
    // If we still have available problems (AI generated more than requested?), append them?
    // The prompt asks for exact count. If we have extras, we might as well include them if they are good, 
    // or ignore them to match strict count. 
    // Let's just use what we have matched + filled.

    const problems: Problem[] = validProblems.map((p: any, index: number) => ({
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
