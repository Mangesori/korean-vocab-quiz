import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("Loading generate-quiz function...");

// 아래 두 문구는 quizzes 트리거(enforce_quiz_quota)가 던지는 문장과 글자까지 같아야 한다.
// 사전 체크(이 함수)와 저장 시 트리거는 같은 상황에서 같은 말을 해야 하기 때문이다.
// 트리거 쪽 문장을 고치면 여기도 같이 고칠 것 —
// supabase/migrations/20260716000000_add_plan_limits_and_quota_trigger.sql
const QUOTA_UNKNOWN_MESSAGE =
  "퀴즈 생성 한도를 확인할 수 없어서 퀴즈를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

function quotaExceededMessage(quizLimit: number, period: string | null): string {
  // 트리거의 CASE _period WHEN 'week' THEN '이번 주' ELSE '이번 달' END 와 같은 규칙.
  const periodLabel = period === "week" ? "이번 주" : "이번 달";
  // 업그레이드 안내는 일부러 없다 — 지금은 결제 연동도 요금제 페이지도 없어서(체험 기간 파킹)
  // 올릴 방법 자체가 없기 때문. 구독제 시작 시 트리거와 함께 문구를 고칠 것.
  return `${periodLabel} 퀴즈 생성 한도(${quizLimit}개)를 다 썼어요`;
}

// quiz_quota_status RPC의 반환 형태.
interface QuotaStatus {
  plan: string | null;
  quiz_limit: number | null;
  period: string | null;
  used: number | null;
  allowed: boolean;
}

interface QuizRequest {
  // "words"(기본) = 단어 배열을 받아 AI가 문장을 짓는 기존 방식.
  // "prompt" = 선생님이 쓴 자유 텍스트(기사 원문 + 단어 목록 + 요청사항)를 통째로 AI에 넘긴다.
  //            코드는 그 텍스트를 파싱하지 않는다. mode가 없으면 "words"로 본다(하위 호환).
  mode?: "words" | "prompt";
  // mode === "prompt"일 때만 사용. 선생님이 작성한 글 전체.
  promptText?: string;
  // mode === "prompt"일 때만 사용. null이면 AI가 자료를 보고 개수를 정한다.
  problemCount?: number | null;
  // mode === "prompt"에서는 안 온다.
  words?: string[];
  difficulty: string;
  translationLanguage: string;
  wordsPerSet: number;
  regenerateSingle?: boolean;
  // 'create' = 새 퀴즈를 만드는 호출(한도 사전 체크 대상).
  // 'regenerate' = 이미 저장된 퀴즈의 문제만 다시 만드는 호출(INSERT가 없어 한도와 무관).
  // 안 보내면 'create'로 본다 — 아래 사전 체크 주석 참고.
  purpose?: "create" | "regenerate";
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  recordingMode?: "read" | "listen" | "mixed";
  recordingModes?: Array<{ wordIndex: number; mode: "read" | "listen" }>;
  skipFillBlank?: boolean;
  matchupEnabled?: boolean;
  typeAnswerEnabled?: boolean;
  wordMagnetEnabled?: boolean;
}

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  meaning?: string; // 단어(기본형)의 짧은 뜻 — 매치업/문장만들기 뜻 칸에 사용
  // B1+ 말하기 연습/문장 순서 맞추기용 짧은(≤25자) 완성형 문장 + 번역
  short_sentence?: string;
  short_translation?: string;
}

interface MatchupProblem {
  problem_id: string;
  korean_text: string;
  meaning_text: string;
}

interface TypeAnswerProblem {
  problem_id: string;
  prompt: string; // 뜻
  answer: string; // 한국어 단어(기본형)
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
   - 서술/종결: -이에요/예요, -아요/어요, -았어요/었어요(과거), -지요?(확인)
   - 지시/장소: 이거/그거/저거, 여기/거기/저기
   - 조사: 은/는(주제), 이/가(주어/아니다), 을/를(목적), 도(포함), 에(위치/시간), 에서(장소/출발), 부터&까지, (으)로(방향/수단), 하고&와/과(나열), 만(한정), 한테&께(대상), 의(소유), 위&아래&앞&뒤
   - 부정: 안(부정), 못(불가능), 이/가 아니다
   - 존재: 있어요/없어요
   - 희망: -고 싶다, -고 싶어 하다
   - 계획/미래: -(으)ㄹ 거예요(미래), -(으)려고 해요
   - 목적: -(으)러 가다/오다
   - 능력/숙련도: -(으)ㄹ 수 있다/없다, 못하다/잘하다/잘 못하다
   - 의무: -아야/어야 해요, -아야/어야 되다
   - 이유: -아서/어서(이유)
   - 조건: -(으)면
   - 대조/나열: -지만, 근데, -고(동작 나열)
   - 시간: -(으)ㄹ 때
   - 진행: -고 있다
   - 높임: -(으)시다, -(이)세요
   - 요청/권유: -(으)세요, -지 마세요, -(으)ㄹ까요?(권유), N 주세요
   - 도움: -아/어 주다, -아/어 드릴까요?, -아/어 드릴게요, -아/어 주시겠어요?
   - 시도/권유: -아/어 보세요
   - 수식: 형용사+-(으)ㄴ
   - 단위: 개/병/잔/그릇
   - 길이: 5-8단어`,

    "A2": `
   **A2 (TOPIK I 초중급 2급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 A2 문법 표현 중 하나를 반드시 포함하세요. **
   
   - 서술/종결: -네요(감탄)
   - 이유(심화): -(으)니까, -기 때문에
   - 순서(연속 동작): -아서/어서(순서)
   - 동시동작/시간: -(으)면서, -는 동안에, -다가(전환), -(으)ㄴ 지(경과), -기 전에, -(으)ㄴ 후에
   - 배경/대조: -는데/-(으)ㄴ데(연결), -(으)ㄴ데요/-는데요(종결), 형용사+-(으)ㄴ데
   - 추측: -(으)ㄹ까요?(추측), -(으)ㄹ 거예요(추측), -(으)ㄹ 것 같다, -(으)ㄴ/는 것 같다
   - 제안/의지/권유: -(으)ㅂ시다, -(으)ㄹ래요, -(으)ㄹ게요, -겠어요, -는 게 좋겠다
   - 계획/의도: -(으)려고
   - 결심/약속/계획: -기로 하다, -(으)ㄹ까 하다
   - 희망: -았/었으면 좋겠다
   - 허락/금지: -아도/어도 되다, -(으)면 안 되다
   - 양보: -아도/어도
   - 변화: -게 되다, -아/어지다
   - 경험/시도: -(으)ㄴ 적이 있다/없다, -아/어 보다, -(으)ㄹ 뻔하다
   - 능력/숙련도: -(으)ㄹ 줄 알다/모르다
   - 조건/방법: -(으)려면, -(으)면 되다, -(으)ㄹ 테니까
   - 상태/성향: -는 중이다, -(으)ㄴ/는 편이다
   - 나열/선택: -거나, (이)나(명사 나열)
   - 비교: 보다 더
   - 인용(명사): N(이)라고 하다
   - 명사화: -는 것
   - 관형사형: (동사)+-는, (동사)+-(으)ㄴ, (동사)+-(으)ㄹ
   - 지식/인지: -(으)ㄴ/는지 알다
   - 길이: 8-12단어`,

    "B1": `
   **B1 (TOPIK II 중급 3급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 B1 문법 표현 중 하나를 반드시 포함하세요. 중급 수준의 연결어미와 표현을 사용해주세요.**

   - 어휘: 계획, 경험, 의견, 문제, 환경, 건강, 발전하다, 변화하다, 증가하다, 중요하다
   - 연결어미: -느라고, -는 대신에, -다가, -더니, -던
   - 간접화법: -다고 하다, -ㄴ/는다고 하다, -았/었다고 하다, -(으)ㄹ 거라고 하다, -자고 하다, -냐고 하다, -(으)라고 하다
   - 추측/판단: -(으)ㄴ/는 것 같다, -(으)ㄴ가 보다, -나 보다, -(으)ㄹ 텐데
   - 목적/이유: -기 위해서, -기 때문에, -는 덕분에, -(으)ㄹ까 봐(걱정/이유), -도록
   - 정도/비교: -아/어서 그런지, -(으)ㄹ 만하다
   - 양보: -아도/어도, -지만, -(으)ㄴ데(도)
   - 나열: -(이)나, -거나
   - 피동/사동: -게 하다
   - 후회/망설임: -(으)ㄹ걸 (그랬다), -(으)ㄹ까 말까 (하다)
   - 회상/배경: -던데(요)
   - 가장/화제: -(으)ㄴ/는 척하다, -에 대해(서)
   - 기타: -는 걸 보니까
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ (필수!)
   - 길이: 10-15단어`,

    "B2": `
   **B2 (TOPIK II 중고급 4급) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 B2 문법 표현 중 하나를 반드시 포함하세요. 고급 연결어미와 피동/사동 표현을 적극적으로 사용해주세요.**

   - 어휘: 상황, 현상, 영향, 결과, 원인, 심각하다, 복잡하다, 다양하다, 강조하다
   - 고급 연결: -(으)므로, -는 통에, -(으)ㄹ수록, -는 한편, -는 반면에, -는 대로, -는 김에, -는 바람에, -다가는
   - 피동/사동: -게 하다, -게 되다
   - 추측/양태: -(으)ㄹ 텐데, -(으)ㄹ 모양이다, -(으)ㄹ 셈이다, -(으)ㄹ 리가 없다
   - 목적: -(으)ㄹ 겸 (해서)
   - 정도: -(으)ㄹ 뿐만 아니라, -(으)ㄹ 뿐이다, -만 못하다, -(으)ㄹ 정도로
   - 이유/근거: -는 탓에, -(으)ㄴ/는 덕분에, -길래, -에 따라(서), -에 의해(서)
   - 양보: -더라도
   - 강조/극단: -(이)야말로, 마저, 은/는커녕
   - 회상/전달: -더라고(요)
   - 열거: -을/를 비롯해서
   - 의도: -(으)려다가, -(으)려던 참이다
   - 기타: -는 사이에, -는 수가 있다, -는 수밖에 없다, -곤 하다, -(으)ㄴ 채로, -다 보니까, -다 보면
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 14-20단어`,

    "C1": `
   **C1 (TOPIK II 고급 5급 이상) - 핵심 문법 필수 사용**:
   **규칙: 문장을 만들 때 아래 나열된 C1 문법 표현 중 하나를 반드시 포함하세요. 격식체와 문어체 표현을 사용하여 고급스러운 문장을 만들어주세요.**

   - 어휘: 지속, 체계, 필수, 도출, 분석, 기여하다, 촉진하다, 저해하다, 효율적, 합리적
   - 고급 문법: -던, -(으)ㄴ 바 있다, -(으)로 인해
   - 격식체: -ㅂ니다/습니다, -는바, -고자
   - 인용: -다고 하다, -(으)라고 하다, -냐고 하다, -자고 하다
   - 회상: -더니, -더라, -던, -던가요
   - 강조: 조차
   - 나열/선택: -다거나, -든지
   - 비유: -듯이, -다시피
   - 정도/속성: -(으)ㄴ/는 만큼, -(으)ㄴ/는 법이다
   - 한정: -(이)나 -(이)나 할 것 없이
   - 기타: -을/를 통해(서), -에 관해(서), -(으)ㄴ/는들, -기 십상이다
   - 관형사형: -(으)ㄴ, -는, -(으)ㄹ
   - 길이: 16-24단어`,
   
    "C2": `
   **C2 (최고급) - 핵심 문법 필수 사용**:
   **규칙: 가능한 한 복잡하고 정교한 문장 구조를 사용하세요. 학술적이거나 전문적인 맥락의 어휘와 표현을 적극 사용해주세요.**

   - 사용 가능: 학술 용어, 전문 어휘, 관용 표현
   - 양보/한정: -(으)ㄹ지라도, -(으)ㄴ/는 한
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

const generateDetailedPrompt = (words: string[], difficulty: string, languageName: string, includeShort = false) => {
  const selectedGuide = shuffleGrammarGuide(DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"]);

  const shortSection = includeShort ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§6-3. 짧은 문장(short_sentence·short_translation) 규칙 — 필수
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· short_sentence: 대상 단어를 포함한 완성형 한국어 문장. 괄호·빈칸 없이 정답까지 채운 자연스러운 문장.
· 공백 포함 20~30자 범위로 만드세요(너무 짧지도 길지도 않게). 학생이 듣고 한 번에 기억할 수 있는 길이여야 합니다.
· 위 빈칸 채우기 문장(sentence)과는 다른, 더 짧고 쉬운 표현을 사용하세요. (같은 문장 복사 금지)
· short_translation: short_sentence 전체를 ${languageName}로 자연스럽게 번역. 대괄호 없이 적으세요.
` : "";

  const shortOutputFields = includeShort ? `,
      "short_sentence": "대상 단어가 들어간 20~30자의 짧은 완성형 문장.",
      "short_translation": "${languageName}로 된 short_sentence 번역"` : "";

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

[Step 2 - 후보 생성 및 선택] 각 단어마다 다음 과정을 머릿속에서 수행하세요 (출력 금지).
  ① 해당 단어를 사용한 후보 문장 3개를 떠올리세요. 문법 패턴을 서로 다르게 적용하세요.
  ② 각 후보를 다음 기준으로 평가하세요:
     - "한국인이 실제로 이렇게 말할까?" (자연스러움)
     - 문법이 억지로 끼워 넣어진 느낌이 없는가?
     - 어색한 어휘 조합이 없는가?
  ③ 세 후보 중 가장 자연스러운 문장 1개만 최종 선택하세요.

[Step 3 - 문법 카테고리 분산] Step 2에서 선택한 문장의 문법 패턴을 확인하여, 문제 전체에 걸쳐 다양한 카테고리(이유, 시간, 추측, 양보, 연결 등)가 골고루 사용되도록 조정하세요.
  · 단순 종결 회피: "-아요/어요", "-습니다" 같은 기본 종결 어미만으로 끝내지 마세요.
  · 관형사형 활용: 동사/형용사 어휘의 경우, 관형사형(-는/-ㄴ/-(으)ㄹ)으로 명사를 수식하는 구조도 섞어주세요.

⚠️ 출력에는 최종 JSON 결과만 포함하세요. Step 1~3의 사고 과정은 출력하지 마세요.

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
§6-2. 단어 뜻(meaning) 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· meaning에는 단어(기본형)의 핵심 사전적 뜻을 ${languageName}로 1~3 단어로 간결하게 적으세요.
· 문장 전체 번역이 아니라 단어 하나의 뜻만 적습니다. 대괄호는 쓰지 마세요.
  예: word "학생" → meaning "student" / word "마음에 들다" → meaning "to like"
${shortSection}
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
      "translation": "${languageName} 번역 with [core meaning]",
      "meaning": "${languageName}로 된 단어의 짧은 뜻"${shortOutputFields}
    }
  ]
}
첫 글자는 반드시 { 로 시작하세요. \`\`\`json 마크다운 블록을 사용하지 마세요.`;
};

// 가벼운 프롬프트 (Single Regeneration용)
const generateSimplePrompt = (words: string[], difficulty: string, languageName: string, includeShort = false) => {
  // 전체 가이드 대신 해당 레벨의 핵심 문법 리스트만 추출 (간략화)
  const fullGuide = shuffleGrammarGuide(DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"]);

  const shortSection = includeShort ? `
[짧은 문장(short_sentence·short_translation)] 필수
- short_sentence: "${words[0]}"을(를) 포함한 완성형 문장(괄호·빈칸 없음). 공백 포함 20~30자 범위로.
- 위 빈칸 채우기 문장과 다른, 더 짧고 쉬운 표현. 학생이 듣고 한 번에 기억할 수 있는 길이.
- short_translation: short_sentence 전체를 ${languageName}로 번역. 대괄호 없이.
` : "";

  const shortOutputFields = includeShort ? `,
      "short_sentence": "20~30자 짧은 완성형 문장.",
      "short_translation": "${languageName} 번역"` : "";
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
${shortSection}
[금지 패턴] 맥락 없는 감정 나열, 교과서식 인위적 문장, 부자연스러운 어휘 조합은 절대 금지.

[출력 - JSON Only, 코드블록 없이]
{
  "problems": [
    {
      "word": "${words[0]}",
      "answer": "...",
      "sentence": "... ( ).",
      "hint": "...",
      "translation": "... [core meaning] ..."${shortOutputFields}
    }
  ]
}`;
};

// 프롬프트 모드 — 선생님이 쓴 자유 텍스트를 그대로 넘긴다.
//
// generateDetailedPrompt와의 결정적 차이는 §2 [Step 1]이다. 기존 프롬프트는
// "단어마다 서로 다른 상황을 설정하세요. 비슷한 소재가 반복되면 안 됩니다"라며
// 맥락을 일부러 흩는데, 수업 자료로 배운 단어에는 그게 독이다(기사를 읽었는데
// 카페·쇼핑 문장이 나오는 원인). 여기서는 반대로 자료의 맥락으로 통일한다.
//
// §4·§5·§6·§6-2·§6-3과 출력 형식 JSON 블록은 generateDetailedPrompt에서
// 글자 그대로 복사한 것이다. 다운스트림 파생 로직(매치업·답 입력·문장 만들기,
// QuizPreview의 녹음 문장 생성)이 이 규칙들의 결과 형태를 전제로 하기 때문에
// 한 글자도 바꾸면 안 된다. 저쪽을 고치면 여기도 같이 고칠 것.
const generatePromptModePrompt = (
  promptText: string,
  problemCount: number | null,
  difficulty: string,
  languageName: string,
  includeShort = false,
) => {
  const selectedGuide = shuffleGrammarGuide(DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"]);

  // ── 아래 shortSection / shortOutputFields는 generateDetailedPrompt와 동일 문구 ──
  const shortSection = includeShort ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§6-3. 짧은 문장(short_sentence·short_translation) 규칙 — 필수
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· short_sentence: 대상 단어를 포함한 완성형 한국어 문장. 괄호·빈칸 없이 정답까지 채운 자연스러운 문장.
· 공백 포함 20~30자 범위로 만드세요(너무 짧지도 길지도 않게). 학생이 듣고 한 번에 기억할 수 있는 길이여야 합니다.
· 위 빈칸 채우기 문장(sentence)과는 다른, 더 짧고 쉬운 표현을 사용하세요. (같은 문장 복사 금지)
· short_translation: short_sentence 전체를 ${languageName}로 자연스럽게 번역. 대괄호 없이 적으세요.
` : "";

  const shortOutputFields = includeShort ? `,
      "short_sentence": "대상 단어가 들어간 20~30자의 짧은 완성형 문장.",
      "short_translation": "${languageName}로 된 short_sentence 번역"` : "";

  const countSection = problemCount === null
    ? `· 선생님이 위 글에서 단어를 직접 나열했으면 그 단어 개수만큼 문제를 만드세요.
· 나열하지 않았으면 15개 내외로 만드세요.`
    : `· 정확히 ${problemCount}개의 문제를 만드세요.
· 선생님이 나열한 단어가 그보다 적으면 제공된 자료에서 중요한 단어를 더 뽑아 채우고, 더 많으면 학습 가치가 높은 것부터 고르세요.`;

  return `당신은 한국어 교육 전문가이자 TOPIK 문제 출제 전문가입니다.
선생님이 제공한 수업 자료를 바탕으로 ${difficulty} 수준의 빈칸 채우기 문제를 출제하세요.
선생님이 직접 작성한 요청은 이 지시문 아래쪽(§9)에 있습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§1. 핵심 원칙: 자연스러움 최우선
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· 가장 중요한 것은 한국인이 실제 일상에서 말하는 것처럼 자연스러운 문장을 만드는 것입니다.
· 문법은 자연스러운 문장 안에 녹아들어야 하며, 문법을 보여주기 위해 문장을 억지로 만들지 마세요.
· "이 상황에서 한국 사람이 정말 이렇게 말할까?"를 항상 자문하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§2. 문장 생성 프로세스 (반드시 이 순서를 따르세요)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Step 1 - 맥락 유지] 선생님이 제공한 자료의 맥락 안에서 문장을 만드세요.
  · 자료의 주제·소재·상황을 그대로 이어받아, 학생이 그 자료를 다시 읽는 느낌이 들게 하세요.
  · 자료와 무관한 새 소재를 임의로 끌어오지 마세요.

[Step 2 - 후보 생성 및 선택] 각 단어마다 다음 과정을 머릿속에서 수행하세요 (출력 금지).
  ① 해당 단어를 사용한 후보 문장 3개를 떠올리세요. 문법 패턴을 서로 다르게 적용하세요.
  ② 각 후보를 다음 기준으로 평가하세요:
     - "한국인이 실제로 이렇게 말할까?" (자연스러움)
     - 문법이 억지로 끼워 넣어진 느낌이 없는가?
     - 어색한 어휘 조합이 없는가?
     - 선생님이 제공한 자료의 맥락에 맞는가?
  ③ 세 후보 중 가장 자연스러운 문장 1개만 최종 선택하세요.

[Step 3 - 문법 다양성] 문제 전체에서 같은 문법 패턴만 반복되지 않도록 조정하세요.
  · 단순 종결 회피: "-아요/어요", "-습니다" 같은 기본 종결 어미만으로 끝내지 마세요.
  · 단, 선생님이 특정 문법을 지정했다면 그 지정이 우선입니다.

⚠️ 출력에는 최종 JSON 결과만 포함하세요. Step 1~3의 사고 과정은 출력하지 마세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§3. 난이도별 문법 가이드 (${difficulty}) — 참고용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아래 목록은 참고용입니다. 아래 선생님 요청과 충돌하면 선생님 요청을 따르세요.
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
§6-2. 단어 뜻(meaning) 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· meaning에는 단어(기본형)의 핵심 사전적 뜻을 ${languageName}로 1~3 단어로 간결하게 적으세요.
· 문장 전체 번역이 아니라 단어 하나의 뜻만 적습니다. 대괄호는 쓰지 마세요.
  예: word "학생" → meaning "student" / word "마음에 들다" → meaning "to like"
${shortSection}
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
§9. 선생님 요청
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아래는 선생님이 직접 작성한 요청입니다. 문제의 내용(단어 선택, 문장 맥락, 문법)에만 적용하세요. 아래 출력 형식의 JSON 구조는 어떤 경우에도 바꾸지 마세요.

<선생님_요청>
${promptText}
</선생님_요청>

[문제 개수]
${countSection}

위 요청은 여기까지입니다. 이제 아래 형식대로만 답하세요.

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
      "translation": "${languageName} 번역 with [core meaning]",
      "meaning": "${languageName}로 된 단어의 짧은 뜻"${shortOutputFields}
    }
  ]
}
첫 글자는 반드시 { 로 시작하세요. \`\`\`json 마크다운 블록을 사용하지 마세요.`;
};

// AI가 준 문제 항목이 쓸 수 있는 형태인지 본다.
// word/answer/sentence 중 하나라도 비면 아래 p.word.trim() 같은 호출에서
// TypeError가 나 요청 전체가 500으로 죽는다. 그런 항목만 버리고 나머지는 살린다.
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isUsableProblem = (p: Problem | null | undefined): p is Problem =>
  !!p && hasText(p.word) && hasText(p.answer) && hasText(p.sentence);

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

    // 본문을 먼저 읽는다 — 아래 한도 사전 체크가 purpose를 봐야 하는데
    // req.json()은 한 번만 부를 수 있어서 파싱을 위로 옮겼다.
    const {
      mode = "words",
      promptText = "",
      problemCount = null,
      words: rawWords,
      difficulty,
      translationLanguage,
      wordsPerSet: _wordsPerSet,
      regenerateSingle,
      sentenceMakingEnabled = false,
      recordingEnabled = false,
      recordingMode: _recordingMode = "read",
      recordingModes: _recordingModes = [],
      skipFillBlank = false,
      matchupEnabled = false,
      typeAnswerEnabled = false,
      wordMagnetEnabled = false,
      purpose = "create",
    }: QuizRequest = await req.json();

    // mode가 없으면 "words" — 기존 호출부는 이 값을 안 보낸다.
    const isPromptMode = mode === "prompt";

    // 프롬프트 모드는 words를 안 보낸다. 아래 로직이 전부 배열을 전제로 하므로 빈 배열로 정규화한다.
    const words: string[] = Array.isArray(rawWords) ? rawWords : [];

    if (isPromptMode && !promptText.trim()) {
      return new Response(
        JSON.stringify({ error: "프롬프트 내용이 비어 있습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 퀴즈 생성 한도 사전 체크.
    //
    // 진짜 관문은 quizzes BEFORE INSERT 트리거(enforce_quiz_quota)다. 이 함수는 INSERT를 하지 않고
    // 문제만 만들기 때문에(저장은 QuizPreview에서) 사전 체크가 없으면 AI 토큰을 다 태운 뒤
    // 저장 단계에서야 막힌다. 그걸 막으려고 여기서 한 번 미리 본다.
    //
    // 새 퀴즈를 만드는 호출(purpose === 'create')만 검사한다. 재생성은 이미 저장된 퀴즈의 문제를
    // 갈아끼울 뿐이라 INSERT가 없고 한도를 쓰지 않는다. 여기서 같이 막으면 한도에 도달한 선생님이
    // 이미 만든 퀴즈의 문제 하나를 고치는 것조차 못 한다. 통과시켜도 트리거가 관문이라 한도는 안 샌다.
    // purpose가 없으면 'create'로 본다: 이 함수가 프론트보다 먼저 배포되면 옛 프론트는 플래그를
    // 안 보내는데, 그때 'regenerate'로 기울면 진짜 생성 경로의 사전 체크가 통째로 사라진다.
    // 'create'로 기울면 최악이 지금과 똑같은 동작(재생성도 막힘)이라 이쪽이 안전하다.
    //
    // admin 면제·플랜별 한도·기간 경계 계산은 전부 RPC 안에 있다(카운트 로직을 두 벌 만들지 않는다).
    // 이 클라이언트는 service_role이 아니라 anon 키 + 사용자 Authorization 헤더라서
    // auth.uid()가 호출한 선생님 본인이고, RPC의 소유권 가드를 그대로 통과한다.
    if (purpose === "create") {
      const { data: quotaData, error: quotaError } = await supabase.rpc("quiz_quota_status", {
        _teacher_id: user.id,
      });
      const quota = quotaData as QuotaStatus | null;

      // fail-closed. 예전 코드는 카운트 조회가 실패하면 그냥 통과시켰는데(fail-open),
      // 트리거가 fail-closed라 어차피 저장에서 막힌다 — AI 토큰만 버리는 셈이었다.
      if (quotaError || !quota) {
        console.error("Quota check error:", quotaError);
        return new Response(
          JSON.stringify({ error: QUOTA_UNKNOWN_MESSAGE }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!quota.allowed) {
        // quiz_limit이 없는데 allowed=false면 한도를 알 수 없어서 막힌 것이다
        // (프로필 없음 / plan_limits에 행 없음). 사용자 잘못이 아니라 설정 문제라
        // 트리거와 마찬가지로 한도 소진과 다른 문장을 쓴다.
        if (quota.quiz_limit === null || quota.quiz_limit === undefined) {
          return new Response(
            JSON.stringify({ error: QUOTA_UNKNOWN_MESSAGE }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: quotaExceededMessage(quota.quiz_limit, quota.period) }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`User ${user.id} (${profileData.role}) generating quiz (purpose=${purpose})`);

    const languageName = LANGUAGE_NAMES[translationLanguage] || "영어";

    // B1 이상이면 말하기 연습/문장 순서 맞추기용 짧은 문장(short_sentence)을 함께 생성.
    const isB1Plus = ["B1", "B2", "C1", "C2"].includes(difficulty);
    // 상세(일괄) 생성은 recording/word_magnet 중 하나라도 켜졌을 때만 short_sentence 지시.
    const includeShortDetailed = isB1Plus && (recordingEnabled || wordMagnetEnabled);

    // 빈칸 채우기 문제 배열 초기화
    let problems: Problem[] = [];

    // skipFillBlank가 false일 때만 빈칸 채우기 생성
    if (!skipFillBlank) {
      // 프롬프트 모드가 최우선(입력 단어 배열 자체가 없어 나머지 두 빌더를 쓸 수 없다).
      // 그 다음 regenerateSingle이 true이면 가벼운 프롬프트 사용
      const prompt = isPromptMode
        ? generatePromptModePrompt(promptText, problemCount, difficulty, languageName, includeShortDetailed)
        : regenerateSingle
        ? generateSimplePrompt(words, difficulty, languageName, isB1Plus)
        : generateDetailedPrompt(words, difficulty, languageName, includeShortDetailed);

      console.log(
        isPromptMode
          ? `Generating quiz using Claude in prompt mode (problemCount=${problemCount ?? "auto"}) at ${difficulty} level`
          : `Generating quiz using Claude for ${words.length} words at ${difficulty} level`
      );

      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not configured");
      }

      let content: string;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 130000);
      const startedAt = Date.now();

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            // Sonnet 5는 thinking(adaptive)이 기본으로 켜지고, thinking과 응답이 이 예산을
            // 함께 나눠 쓴다. 예전 8192로는 15문제 JSON을 다 뽑기 전에 잘릴 수 있다.
            // 16000을 넘기면 비스트리밍 요청이 HTTP 타임아웃 위험에 들어가므로,
            // 스트리밍 없이 갈 수 있는 상한에 맞췄다.
            max_tokens: 16000,
            // temperature는 넣지 말 것 — Sonnet 5는 기본값이 아닌 sampling 파라미터를
            // 400으로 거부한다. 예전의 temperature: 0.7이 담당하던 다양성은
            // 프롬프트 §2(후보 3개 생성 후 선택)가 대신한다.
            //
            // effort: Sonnet 5 medium ≈ Sonnet 4.6 high. 지정 안 하면 기본 high라
            // 불필요하게 느리고 비싸진다. low는 쓰지 말 것 — 낮은 effort에서는 지시를
            // 곧이곧대로 따라 §2의 후보 생성 과정을 건너뛴다.
            output_config: { effort: "medium" },
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Claude API error:", response.status, errorText);

          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        // Sonnet 5는 adaptive thinking이 기본이라 content[0]이 thinking 블록일 수 있다.
        // 인덱스로 집지 말고 type === "text"인 블록을 찾아야 한다.
        // (thinking 블록에는 .text가 없어 undefined가 되고 "No content received from AI"로 떨어진다.)
        content = data.content?.find(
          (block: { type?: string; text?: string }) => block?.type === "text"
        )?.text;

        // 비용·지연 기준선. Sonnet 5는 thinking도 출력 토큰으로 과금되므로 output이
        // 입력보다 비용에 크게 기여한다($3 vs $15 per MTok). stop_reason이 max_tokens면
        // 잘린 것이니 max_tokens를 올려야 한다.
        console.log(
          `[usage] mode=${isPromptMode ? "prompt" : "words"} difficulty=${difficulty} ` +
            `words=${words.length} ms=${Date.now() - startedAt} ` +
            `in=${data.usage?.input_tokens} out=${data.usage?.output_tokens} ` +
            `stop=${data.stop_reason} blocks=${data.content?.map((b: { type?: string }) => b?.type).join(",")}`
        );
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
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

      // 필드 검증을 재정렬보다 먼저 한다 — 아래 p.word.trim()이 word 없는 항목에서 터진다.
      // 일부만 망가진 응답 때문에 전체를 버리지 않도록, 못 쓰는 항목만 걸러내고 계속 간다.
      const usableProblems: Problem[] = (parsed.problems as Problem[]).filter(isUsableProblem);
      const droppedCount = parsed.problems.length - usableProblems.length;
      if (droppedCount > 0) {
        console.warn(`Dropped ${droppedCount} malformed problem(s) missing word/answer/sentence`);
      }
      if (usableProblems.length === 0) {
        throw new Error("생성된 문제가 없습니다");
      }

      let validProblems: Problem[];

      if (isPromptMode) {
        // 프롬프트 모드는 기준이 될 입력 단어 배열이 없다. AI가 준 순서를 그대로 쓴다.
        validProblems = usableProblems;
      } else {
        // Keep problems in original order (same as input words)
        const orderedProblems: (Problem | null)[] = [];
        const availableProblems: Problem[] = [...usableProblems];

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
        validProblems = orderedProblems.filter((p): p is Problem => p !== null);
      }

      problems = validProblems.map((p: Problem, index: number) => ({
        id: `problem-${Date.now()}-${index}`,
        word: p.word,
        answer: p.answer,
        sentence: p.sentence,
        hint: p.hint || "",
        translation: p.translation,
        meaning: p.meaning || "",
        // B1+ 짧은 문장(모델이 안 준 경우 undefined 유지 → 클라이언트가 폴백)
        short_sentence: p.short_sentence,
        short_translation: p.short_translation,
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
      matchupProblems?: MatchupProblem[];
      typeAnswerProblems?: TypeAnswerProblem[];
    } = { problems };

    // 단어별 뜻 맵 (빈칸 생성 결과에서 추출) — 문장 만들기/매치업 뜻 칸에 재사용
    const meaningByWord = new Map<string, string>(
      problems.map((p) => [p.word.trim(), p.meaning || ""])
    );

    // 파생 유형(문장 만들기·매치업·답 입력)이 돌릴 단어 목록.
    // 프롬프트 모드는 입력 단어 배열이 없다(선생님 글을 파싱하지 않는다).
    // 그래서 AI가 실제로 뽑아낸 단어, 즉 빈칸 문제의 word를 단어 목록으로 쓴다.
    // words 모드는 지금까지처럼 입력 순서 그대로.
    const derivedWords = isPromptMode ? problems.map((p) => p.word) : words;

    // 문장 만들기 퀴즈 생성 (AI 호출 불필요 - 단어 목록만 반환)
    if (sentenceMakingEnabled && !regenerateSingle) {
      console.log(`Creating sentence making problems for ${derivedWords.length} words`);
      // 단어 목록으로 문제 생성 (AI 채점은 학생이 제출할 때 진행)
      // word_meaning은 빈칸 생성에서 나온 단어 뜻으로 자동 채움 (선생님이 미리보기에서 수정 가능)
      const smProblems: SentenceMakingProblem[] = derivedWords.map((word, index) => ({
        problem_id: `sm-${Date.now()}-${index}`,
        word: word,
        word_meaning: meaningByWord.get(word.trim()) || "",
        model_answer: "", // 더 이상 사용 안 함 - AI가 실시간 채점
      }));
      responseData.sentenceMakingProblems = smProblems;
      console.log(`Created ${smProblems.length} sentence making problems`);
    }

    // 매치업 퀴즈 생성 (단어 ↔ 뜻) — 빈칸 생성 결과의 단어/뜻을 재사용
    if (matchupEnabled && !regenerateSingle) {
      console.log(`Creating matchup problems for ${derivedWords.length} words`);
      const muProblems: MatchupProblem[] = derivedWords.map((word, index) => ({
        problem_id: `mu-${Date.now()}-${index}`,
        korean_text: word,
        meaning_text: meaningByWord.get(word.trim()) || "",
      }));
      responseData.matchupProblems = muProblems;
      console.log(`Created ${muProblems.length} matchup problems`);
    }

    // 답 입력 퀴즈 생성 (뜻 → 한국어 단어) — 빈칸 생성 결과의 단어/뜻 재사용
    if (typeAnswerEnabled && !regenerateSingle) {
      console.log(`Creating type-answer problems for ${derivedWords.length} words`);
      const taProblems: TypeAnswerProblem[] = derivedWords.map((word, index) => ({
        problem_id: `ta-${Date.now()}-${index}`,
        prompt: meaningByWord.get(word.trim()) || "",
        answer: word,
      }));
      responseData.typeAnswerProblems = taProblems;
      console.log(`Created ${taProblems.length} type-answer problems`);
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
