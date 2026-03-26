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
  apiProvider?: "openai" | "gemini" | "gemini-pro" | "claude";
  // 새 퀴즈 유형
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  recordingMode?: "read" | "listen" | "mixed";
  recordingModes?: Array<{ wordIndex: number; mode: "read" | "listen" }>;
  // 빈칸 채우기 생성 건너뛰기 (기존 퀴즈에 문장 만들기/녹음만 추가할 때)
  skipFillBlank?: boolean;
}

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

interface SentenceMakingProblem {
  problem_id: string;
  word: string;
  word_meaning: string;
  model_answer: string;
}

interface RecordingProblem {
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
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

// 문법 카테고리 줄을 랜덤 셔플하여 AI의 나열 순서 편향을 제거
function shuffleGrammarGuide(guide: string): string {
  const lines = guide.split('\n');
  const grammarLines: string[] = [];
  const otherLines: { index: number; line: string }[] = [];

  // 문법 카테고리 줄과 나머지 줄 분리
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('- ') &&
      !trimmed.startsWith('- 길이:') &&
      !trimmed.startsWith('- 어휘:') &&
      !trimmed.startsWith('- 사용 가능:') &&
      !trimmed.startsWith('- 문법:')
    ) {
      grammarLines.push(line);
    } else {
      otherLines.push({ index: i, line });
    }
  });

  // Fisher-Yates 셔플
  for (let i = grammarLines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grammarLines[i], grammarLines[j]] = [grammarLines[j], grammarLines[i]];
  }

  // 재조합: 나머지 줄은 원래 위치에, 문법 줄은 셔플된 순서로 삽입
  const result: string[] = new Array(lines.length);
  otherLines.forEach(({ index, line }) => { result[index] = line; });
  let gi = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === undefined) {
      result[i] = grammarLines[gi++];
    }
  }

  return result.join('\n');
}

const generateDetailedPrompt = (words: string[], difficulty: string, languageName: string) => {
  const selectedGuide = shuffleGrammarGuide(DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"]);

  return `당신은 한국어 교육 전문가이자 TOPIK 문제 출제 전문가입니다.
주어진 단어들로 ${difficulty} 수준의 빈칸 채우기 문제를 출제하세요.

📋 단어 목록 (기본형): ${words.join(', ')}
→ 각 단어마다 정확히 1개씩, 총 ${words.length}개의 문제를 입력 순서대로 생성하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§1. 핵심 원칙: 자연스러움 최우선
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· 가장 중요한 것은 한국인이 실제 일상에서 말하는 것처럼 자연스러운 문장을 만드는 것입니다.
· 문법은 자연스러운 문장 안에 녹아들어야 하며, 문법을 보여주기 위해 문장을 억지로 만들지 마세요.
· "이 상황에서 한국 사람이 정말 이렇게 말할까?"를 항상 자문하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§2. 문장 생성 프로세스 (반드시 이 순서를 따르세요)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Step 1 - 상황 구상] 각 단어에 대해 한국인이 일상에서 자연스럽게 사용할 만한 구체적인 상황을 먼저 떠올리세요.
  · 학교, 직장, 카페, 여행, 요리, 운동, 쇼핑, 건강, 날씨, 친구/가족 관계, 취미 등 다양한 맥락을 활용하세요.
  · 단어마다 서로 다른 상황을 설정하세요. 비슷한 소재가 반복되면 안 됩니다.

[Step 2 - 문법 선택 및 문장 완성] Step 1에서 떠올린 상황에 가장 자연스럽게 어울리는 문법을 §3 가이드에서 선택하여 문장을 완성하세요.
  · 문법 카테고리 분산: 문제마다 서로 다른 카테고리(이유, 시간, 추측, 양보, 연결 등)에서 문법을 선택하세요.
  · 단순 종결 회피: "-아요/어요", "-습니다" 같은 기본 종결 어미만으로 끝내지 마세요. §3의 문법 표현을 하나 이상 활용하세요.
  · 관형사형 활용: 동사/형용사 어휘의 경우, 관형사형(-는/-ㄴ/-(으)ㄹ)으로 명사를 수식하는 구조도 섞어주세요.

⚠️ 출력에는 최종 JSON 결과만 포함하세요. Step 1의 메모는 출력하지 마세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§3. 난이도별 문법 가이드 (${difficulty}) — 참고 자료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${selectedGuide}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§4. 빈칸·정답 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ 명사 어휘:
  · answer = "명사 + 조사"만. 동사·형용사는 sentence에 남깁니다.
  · sentence의 ( ) 뒤에 동사가 이어져야 합니다.
  · 조사를 sentence에 쓰지 마세요 — 조사는 answer에 포함됩니다.
  · 예: word "미술관" → sentence "내일 친구하고 ( ) 가요.", answer "미술관에", hint "에"
  · 예: word "지구력" → sentence "( ) 필요해요.", answer "지구력이", hint "이/가"

▶ 동사/형용사 어휘:
  · answer = "어휘 활용형 + 문법 패턴" 전체를 포함. 문법을 answer와 sentence에 쪼개지 마세요.
  · sentence의 ( ) 뒤에 문법 요소가 남아있으면 안 됩니다. (문장 부호는 가능)
  · 관형사형일 때: ( ) 바로 뒤에 수식 대상 명사가 옵니다.
  · 예: word "오다" → sentence "하늘을 보니 비가 ( ).", answer "올 것 같아요", hint "-(으)ㄹ 것 같다 + 아요/어요"
  · 예: word "가다" → sentence "학교에 ( ) 밥 먹었어요.", answer "가기 전에", hint "-기 전에"
  · 예: word "주요하다" → sentence "경제에 ( ) 역할을 합니다.", answer "주요한", hint "-(으)ㄴ"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§5. hint 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· hint에는 설명·의미를 쓰지 말고 문법 형태만 간결하게 표기하세요.
· 명사: 사용된 조사만 표기 (예: "에", "을/를"). 조사 없는 부사형이면 빈 문자열 "".
· 동사/형용사 단독 활용: "-아요/어요", "-기 전에", "-느라고", "-게 되다" 등.
· 관형사형: "-(으)ㄴ", "-는", "-(으)ㄹ"
· 복합 구성: "기본 문법 + 종결 어미" 형식.
  예: "가기로 했습니다" → "-기로 하다 + 습니다"
  예: "할 수 있었어요" → "-(으)ㄹ 수 있다 + 았어요/었어요"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§6. 번역(translation) 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· ( )가 아닌 answer가 들어간 완전한 문장을 ${languageName}로 자연스럽게 번역하세요.
· 정답 단어의 핵심 의미(순수 어휘)만 대괄호 []로 감싸세요. 문법 패턴·보조 동사는 대괄호 밖에 둡니다.
  예: answer "가고 싶어요" → "I want to [go] home."
  예: answer "구독하기로 했어요" → "I decided to [subscribe] to this channel."
  예: answer "연예인인 것 같아요" → "That person seems like a [celebrity]."
· 모든 문제의 translation에 대괄호가 반드시 하나 있어야 합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§7. 부자연스러운 패턴 블랙리스트 (절대 금지)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아래와 같은 문장은 절대로 만들지 마세요:
✗ 맥락 없는 감정 나열: "행복하기 때문에 웃어요", "슬퍼서 울었어요" → 왜 행복한지, 왜 슬픈지 구체적 상황이 있어야 합니다.
✗ 교과서식 인위적 문장: "나는 학생입니다. 학교에 갑니다." → 실제 대화에서는 이렇게 말하지 않습니다.
✗ 주어 없이 문법만 나열: "때문에 좋아요", "그래서 했어요" → 누가, 무엇을, 왜 하는지 맥락이 있어야 합니다.
✗ 두 가지 이상의 고급 문법 과잉 결합: 한 문장에 고급 문법을 여러 개 억지로 넣지 마세요.
✗ 부자연스러운 어휘 조합: "식사를 먹다", "한국 언어를 배우다" → "밥을 먹다", "한국어를 배우다"가 자연스럽습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§8. 자연스러움 최종 점검
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· 완성된 각 문장을 읽고 "한국인 친구에게 이 문장을 보여줘도 어색하지 않은가?"를 점검하세요.
· 문장 끝에 마침표(.) 또는 물음표(?)를 반드시 붙이세요.
· ${difficulty} 어휘 수준을 준수하되, 문맥상 자연스러운 표현을 우선하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식 (JSON만, 설명·코드블록 없이)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "problems": [
    {
      "word": "기본형",
      "answer": "활용형 정답",
      "sentence": "( )가 포함된 ${difficulty} 수준 문장.",
      "hint": "문법 형태",
      "translation": "${languageName} 번역 with [core meaning]"
    }
  ]
}
첫 글자는 반드시 { 로 시작하세요. \`\`\`json 마크다운 블록을 사용하지 마세요.`;
};

// 가벼운 프롬프트 (Single Regeneration용)
const generateSimplePrompt = (words: string[], difficulty: string, _languageName: string) => {
  // 전체 가이드 대신 해당 레벨의 핵심 문법 리스트만 추출 (간략화)
  const fullGuide = shuffleGrammarGuide(DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"]);
  // 가이드에서 문법 목록 부분만 간단히 사용 (줄바꿈 등으로 인해 전체 텍스트가 들어가지만, 위쪽의 긴 설명들은 제외됨)

  return `역할: 한국어 교육 전문가 겸 TOPIK 출제자.
목표: 단어 "${words[0]}"을(를) 사용하여 ${difficulty} 수준의 빈칸 채우기 문제 1개 생성.

[핵심 원칙] 자연스러움이 최우선입니다. 한국인이 실제로 말할 법한 문장을 만드세요.

[문장 생성 순서]
1. 먼저 "${words[0]}"을(를) 일상에서 자연스럽게 사용할 구체적 상황을 떠올리세요 (학교, 직장, 카페, 여행, 건강 등).
2. 그 상황에 가장 자연스럽게 어울리는 문법을 아래 가이드에서 골라 문장을 완성하세요.
→ 출력에는 최종 JSON만 포함하세요.

[문법 가이드 - ${difficulty}]
${fullGuide}
→ 위 목록에서 하나를 골라 활용하세요. 단순 종결(-아요/어요)만으로 끝내지 마세요.

[빈칸·정답 규칙]
▶ 명사: answer = "명사+조사"만. 동사는 sentence에 남깁니다. ( ) 뒤에 조사를 쓰지 마세요.
  예: word "미술관" → sentence "내일 친구하고 ( ) 가요.", answer "미술관에", hint "에"
▶ 동사/형용사: answer에 문법 패턴 전체 포함. sentence 빈칸 뒤에 문법 요소 없음.
  예: word "가다" → answer "가기 때문에", hint "-기 때문에"

[hint] 문법 형태만 간결하게. 설명·의미 금지.
  명사: "학교에" → "에" / 동사: "먹어서" → "-아서/어서" / 복합: "가고 싶어요" → "-고 싶다 + 아요/어요"

[translation] answer가 들어간 완전한 문장을 번역. 핵심 의미만 대괄호 [].
  예: answer "가고 싶어요" → "I want to [go]."

[금지 패턴] 맥락 없는 감정 나열, 교과서식 인위적 문장, 부자연스러운 어휘 조합은 절대 금지.

[출력 - JSON Only, 코드블록 없이]
{
  "problems": [
    {
      "word": "${words[0]}",
      "answer": "...",
      "sentence": "... ( ).",
      "hint": "...",
      "translation": "... [core meaning] ..."
    }
  ]
}`;
};

// 문장 만들기 퀴즈용 모범 답안 생성 프롬프트
const generateSentenceMakingPrompt = (words: string[], difficulty: string, languageName: string) => {
  const selectedGuide = DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];

  return `당신은 한국어 교육 전문가입니다. 다음 단어들을 사용하여 ${difficulty} 수준의 모범 문장을 만들어주세요.

단어 목록: ${words.join(', ')}

**중요: 위 단어 목록의 각 단어마다 정확히 1개씩, 총 ${words.length}개의 모범 문장을 생성해주세요.**

난이도 가이드:
${selectedGuide}

규칙:
1. 각 단어를 사용한 자연스러운 한국어 문장을 만드세요.
2. 해당 난이도(${difficulty})에 맞는 문법과 어휘를 사용하세요.
3. 학생이 이 문장을 참고하여 자신만의 문장을 만들 수 있도록 좋은 예시가 되어야 합니다.
4. word_meaning은 단어의 ${languageName} 뜻을 간단히 적어주세요.

응답 형식 (JSON만):
{
  "sentence_making_problems": [
    {
      "word": "단어",
      "word_meaning": "${languageName}로 된 단어 뜻",
      "model_answer": "단어를 사용한 자연스러운 문장"
    }
  ]
}

🚨 중요: 반드시 JSON 형식으로만 응답하세요! 마크다운 코드 블록 사용 금지.`;
};

// 녹음 퀴즈용 문장 생성 프롬프트
const generateRecordingPrompt = (words: string[], difficulty: string, languageName: string, modes: Array<{ wordIndex: number; mode: "read" | "listen" }>) => {
  const selectedGuide = DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];

  const modeDescriptions = modes.map((m, idx) =>
    `${idx + 1}. "${words[m.wordIndex]}" - ${m.mode === 'read' ? '보고 녹음' : '듣고 녹음'}`
  ).join('\n');

  return `당신은 한국어 교육 전문가입니다. 학생들이 발음 연습을 할 수 있는 문장을 만들어주세요.

단어 목록: ${words.join(', ')}
녹음 모드:
${modeDescriptions}

난이도 가이드:
${selectedGuide}

규칙:
1. 각 단어를 포함한 ${difficulty} 수준의 자연스러운 문장을 만드세요.
2. 발음 연습에 적합한 길이 (너무 길지 않게)
3. 일상적이고 실용적인 문장
4. 각 문장의 ${languageName} 번역도 제공하세요.

응답 형식 (JSON만):
{
  "recording_problems": [
    {
      "word": "단어",
      "sentence": "발음 연습용 문장",
      "mode": "read 또는 listen",
      "translation": "${languageName} 번역"
    }
  ]
}

🚨 중요: 반드시 JSON 형식으로만 응답하세요! 마크다운 코드 블록 사용 금지.`;
};

// AI API 호출 공통 함수
async function callAI(prompt: string, apiProvider: string): Promise<string> {
  if (apiProvider === "claude") {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 130000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-4-5-haiku-20250514",
          max_tokens: 8000,
          temperature: 0.7,
          system: "You are a helpful assistant that generates Korean language learning quizzes. You must respond ONLY with valid JSON. Do not include any markdown code blocks or explanations.",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
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
      return data.content?.[0]?.text || "";
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } else if (apiProvider === "gemini" || apiProvider === "gemini-pro") {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelName = apiProvider === "gemini-pro" ? "gemini-2.5-flash" : "gemini-3.1-flash-lite-preview";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 130000);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    const timeoutId = setTimeout(() => controller.abort(), 130000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful assistant that generates Korean language learning content. You must respond ONLY with valid JSON." },
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
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// JSON 파싱 헬퍼 함수
function parseAIResponse(content: string): any {
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }

  if (!jsonStr.startsWith("{")) {
    console.error("AI response not JSON:", jsonStr.substring(0, 200));
    throw new Error("AI가 JSON이 아닌 텍스트로 응답했습니다.");
  }

  try {
    return JSON.parse(jsonStr);
  } catch (_parseError) {
    console.error("JSON parse error:", jsonStr.substring(0, 200));
    throw new Error("AI 응답을 JSON으로 변환할 수 없습니다.");
  }
}

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

    const {
      words,
      difficulty,
      translationLanguage,
      wordsPerSet: _wordsPerSet,
      regenerateSingle,
      apiProvider = "openai",
      sentenceMakingEnabled = false,
      recordingEnabled = false,
      recordingMode = "read",
      recordingModes = [],
      skipFillBlank = false,
    }: QuizRequest = await req.json();

    const languageName = LANGUAGE_NAMES[translationLanguage] || "영어";

    // 빈칸 채우기 문제 배열 초기화
    let problems: Problem[] = [];

    // skipFillBlank가 false일 때만 빈칸 채우기 생성
    if (!skipFillBlank) {
      // regenerateSingle이 true이면 가벼운 프롬프트 사용
      const prompt = regenerateSingle
        ? generateSimplePrompt(words, difficulty, languageName)
        : generateDetailedPrompt(words, difficulty, languageName);

      console.log(`Generating quiz using ${apiProvider} for ${words.length} words at ${difficulty} level`);

      let content: string;

      if (apiProvider === "gemini" || apiProvider === "gemini-pro") {
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not configured");
        }

        const modelName = apiProvider === "gemini-pro" ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 130000);

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
        const timeoutId = setTimeout(() => controller.abort(), 130000);

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
      } catch (_parseError) {
        console.error("JSON parse error:", jsonStr.substring(0, 200));
        throw new Error("AI 응답을 JSON으로 변환할 수 없습니다. 다시 시도해주세요.");
      }

      if (!parsed.problems || parsed.problems.length === 0) {
        throw new Error("생성된 문제가 없습니다");
      }

      // Keep problems in original order (same as input words)
      const orderedProblems: (Problem | null)[] = [];
      const availableProblems: Problem[] = [...parsed.problems];

      for (const word of words) {
        const matchIndex = availableProblems.findIndex((p: Problem) => p.word.trim() === word.trim());
        if (matchIndex !== -1) {
          orderedProblems.push(availableProblems[matchIndex]);
          availableProblems.splice(matchIndex, 1);
        } else {
          orderedProblems.push(null);
        }
      }

      // Fill any unmatched slots with remaining problems
      for (let i = 0; i < orderedProblems.length; i++) {
        if (orderedProblems[i] === null) {
          if (availableProblems.length > 0) {
            const shifted = availableProblems.shift();
            if (shifted) {
              orderedProblems[i] = shifted;
            }
          }
        }
      }

      // Filter out any remaining nulls
      const validProblems = orderedProblems.filter((p): p is Problem => p !== null);

      problems = validProblems.map((p: Problem, index: number) => ({
        id: `problem-${Date.now()}-${index}`,
        word: p.word,
        answer: p.answer,
        sentence: p.sentence,
        hint: p.hint || "",
        translation: p.translation,
      }));

      console.log(`Successfully generated ${problems.length} fill-blank problems`);
    } else {
      console.log(`Skipping fill-blank generation (skipFillBlank=true)`);
    }

    // 응답 객체 초기화
    const responseData: {
      problems: Problem[];
      sentenceMakingProblems?: SentenceMakingProblem[];
      recordingProblems?: RecordingProblem[];
    } = { problems };

    // 문장 만들기 퀴즈 생성 (AI 호출 불필요 - 단어 목록만 반환)
    if (sentenceMakingEnabled && !regenerateSingle) {
      console.log(`Creating sentence making problems for ${words.length} words`);
      // 단어 목록으로 문제 생성 (AI 채점은 학생이 제출할 때 진행)
      const smProblems: SentenceMakingProblem[] = words.map((word, index) => ({
        problem_id: `sm-${Date.now()}-${index}`,
        word: word,
        word_meaning: "", // 학생에게 표시 안 함
        model_answer: "", // 더 이상 사용 안 함 - AI가 실시간 채점
      }));
      responseData.sentenceMakingProblems = smProblems;
      console.log(`Created ${smProblems.length} sentence making problems`);
    }

    // 녹음 퀴즈 생성 - QuizPreview에서 빈칸 채우기 문장을 기반으로 생성
    if (recordingEnabled && !regenerateSingle) {
      // 빈 배열 반환 - QuizPreview에서 빈칸 채우기 문장을 기반으로 녹음 문장 생성
      responseData.recordingProblems = [];
      console.log("Recording problems will be generated in QuizPreview from fill-blank sentences");
    }

    // 이전 AI 기반 녹음 문제 생성 로직 (주석 처리)
    // if (recordingEnabled && !regenerateSingle) {
    //   console.log(`Generating recording problems for ${words.length} words`);
    //   try {
    //     const finalModes = recordingModes.length > 0
    //       ? recordingModes
    //       : words.map((_, idx) => ({ wordIndex: idx, mode: recordingMode as "read" | "listen" }));
    //
    //     const recPrompt = generateRecordingPrompt(words, difficulty, languageName, finalModes);
    //     const recContent = await callAI(recPrompt, apiProvider);
    //     const recParsed = parseAIResponse(recContent);
    //
    //     if (recParsed.recording_problems && recParsed.recording_problems.length > 0) {
    //       const recProblems: RecordingProblem[] = recParsed.recording_problems.map(
    //         (p: { word: string; sentence: string; mode: string; translation: string }, index: number) => ({
    //           problem_id: `rec-${Date.now()}-${index}`,
    //           sentence: p.sentence,
    //           mode: (p.mode === "listen" ? "listen" : "read") as "read" | "listen",
    //           translation: p.translation || "",
    //         })
    //       );
    //       responseData.recordingProblems = recProblems;
    //       console.log(`Successfully generated ${recProblems.length} recording problems`);
    //     }
    //   } catch (recError) {
    //     console.error("Error generating recording problems:", recError);
    //     // 녹음 생성 실패해도 기본 퀴즈는 반환
    //   }
    // }

    return new Response(
      JSON.stringify(responseData),
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
