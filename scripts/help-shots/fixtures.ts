// 도움말 센터 스크린샷 캡처용 고정 픽스처.
//
// 전부 결정적 상수다 — AI 엣지 함수를 호출하지 않고 problems를 여기 하드코딩해서,
// seed.ts를 몇 번을 다시 돌려도 항상 같은 화면이 나오게 한다.
//
// UUID는 전부 사람이 읽을 수 있는 고정 패턴(00000000-0000-0000-0000-0000000000XX)을 쓴다.
// supabase.auth.admin.createUser({ id: ... })가 로컬 GoTrue에서 커스텀 id를 그대로
// 받아준다는 걸 별도로 확인했다(AdminUserAttributes.id 지원, gotrue v2.194 로컬 스택 기준).

// 아래 계정과 비밀번호는 **개발자 각자의 로컬 Docker Supabase에만 만들어지는 시드 계정**이다
// (도메인이 .local이고 seed.ts가 127.0.0.1의 로컬 스택에만 접속한다). 운영 자격증명이 아니며
// 운영 DB에는 존재하지 않으므로, 공개 저장소에 그대로 두어도 노출되는 비밀이 없다.
export const SEED_PASSWORD = "HelpShots123!";

// ── 사용자 ──────────────────────────────────────────────────────────────
export const TEACHER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "teacher@help.local",
  name: "김민지",
};

export const STUDENT1 = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "student1@help.local",
  name: "김민수",
};

export const STUDENT2 = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "student2@help.local",
  name: "이서연",
};

// ── 클래스 / 공지 ───────────────────────────────────────────────────────
export const CLASS_A = {
  id: "00000000-0000-0000-0000-0000000000a1",
  name: "초급 한국어 A반",
  description: "초급 한국어 학습자를 위한 반입니다.",
  inviteCode: "NAMU01",
};

export const ANNOUNCEMENT = {
  id: "00000000-0000-0000-0000-0000000000a2",
  title: "이번 주 과제 안내",
  content:
    "이번 주까지 '초급 한국어 통합 퀴즈'를 완료해 주세요. 말하기 연습은 조용한 곳에서 녹음하는 걸 추천해요!",
};

// ── 퀴즈 A: 6가지 유형 전부 켠 통합 퀴즈 ──────────────────────────────────
export const QUIZ_A_ID = "00000000-0000-0000-0000-0000000000b1";
export const QUIZ_A_TITLE = "초급 한국어 통합 퀴즈";

// 6개 단어. 모든 유형(빈칸/짝맞추기/받아쓰기/문장순서/문장만들기/말하기)이
// 이 6개 단어를 기반으로 각자의 문제 6개씩을 갖는다.
export const QUIZ_A_WORDS = ["사과", "학교", "친구", "좋아하다", "예쁘다", "감사하다"];

const MEANING: Record<string, string> = {
  사과: "apple",
  학교: "school",
  친구: "friend",
  좋아하다: "to like",
  예쁘다: "pretty",
  감사하다: "to be thankful",
};

const AUDIO_BASE = "https://example.com/dummy-audio/quiz-a";

// 빈칸 채우기 (quiz_problems + quiz_answers + quizzes.problems JSON 3곳에 동일하게 들어간다)
export const FILL_BLANK_PROBLEMS = [
  {
    id: "fb0",
    word: "사과",
    sentence: "저는 아침마다 () 를 먹어요.",
    hint: "을/를",
    answer: "사과를",
    translation: "I eat an apple every morning.",
  },
  {
    id: "fb1",
    word: "학교",
    sentence: "저는 매일 () 에 가요.",
    hint: "에",
    answer: "학교에",
    translation: "I go to school every day.",
  },
  {
    id: "fb2",
    word: "친구",
    sentence: "저는 () 를 만나서 반가웠어요.",
    hint: "를",
    answer: "친구를",
    translation: "I was glad to meet my friend.",
  },
  {
    id: "fb3",
    word: "좋아하다",
    sentence: "저는 한국 음식을 () .",
    hint: "아요/어요",
    answer: "좋아해요",
    translation: "I like Korean food.",
  },
  {
    id: "fb4",
    word: "예쁘다",
    sentence: "이 꽃이 정말 () .",
    hint: "(으)ㄴ/아요",
    answer: "예뻐요",
    translation: "This flower is really pretty.",
  },
  {
    id: "fb5",
    word: "감사하다",
    sentence: "도와주셔서 () .",
    hint: "아요/어요",
    answer: "감사해요",
    // 이 문제(fb5)만 학생1의 시드 결과에서 오답으로 처리된다 (오답노트 캡처용).
    translation: "Thank you for helping me.",
  },
].map((p, i) => ({
  ...p,
  sentence_audio_url: `${AUDIO_BASE}/fill-blank-${i}.mp3`,
}));

// 짝맞추기 (한국어 ↔ 뜻)
export const MATCHUP_PROBLEMS = QUIZ_A_WORDS.map((word, i) => ({
  problem_id: `m${i}`,
  korean_text: word,
  meaning_text: MEANING[word],
  sort_order: i,
}));
// 학생1의 시드 결과에서 이 problem_id만 오답 처리된다 (짝맞추기 → 받아쓰기로 변환되는
// 오답노트 케이스를 캡처하기 위한 것).
export const MATCHUP_WRONG_PROBLEM_ID = "m2"; // 친구

// 받아쓰기(답 입력) — 뜻을 보고 한국어 단어를 입력
export const TYPE_ANSWER_PROBLEMS = QUIZ_A_WORDS.map((word, i) => ({
  problem_id: `t${i}`,
  prompt: `다음 뜻에 해당하는 한국어 단어를 입력하세요: ${MEANING[word]}`,
  answer: word,
  sort_order: i,
}));
export const TYPE_ANSWER_WRONG_PROBLEM_ID = "t4"; // 예쁘다

// 문장 순서 맞추기 (워드 마그넷)
export const WORD_MAGNET_PROBLEMS = [
  {
    problem_id: "wm0",
    base_text: "저는 사과를 좋아해요",
    translation: "I like apples.",
    items: [
      { content: "저는", isParticle: false },
      { content: "사과", isParticle: false },
      { content: "를", isParticle: true },
      { content: "좋아해요", isParticle: false },
    ],
  },
  {
    problem_id: "wm1",
    base_text: "저는 학교에 가요",
    translation: "I go to school.",
    items: [
      { content: "저는", isParticle: false },
      { content: "학교", isParticle: false },
      { content: "에", isParticle: true },
      { content: "가요", isParticle: false },
    ],
  },
  {
    problem_id: "wm2",
    base_text: "친구를 만나서 반가워요",
    translation: "Nice to meet my friend.",
    items: [
      { content: "친구", isParticle: false },
      { content: "를", isParticle: true },
      { content: "만나서", isParticle: false },
      { content: "반가워요", isParticle: false },
    ],
  },
  {
    problem_id: "wm3",
    base_text: "저는 커피를 좋아해요",
    translation: "I like coffee.",
    items: [
      { content: "저는", isParticle: false },
      { content: "커피", isParticle: false },
      { content: "를", isParticle: true },
      { content: "좋아해요", isParticle: false },
    ],
  },
  {
    problem_id: "wm4",
    base_text: "꽃이 정말 예뻐요",
    translation: "The flower is really pretty.",
    items: [
      { content: "꽃", isParticle: false },
      { content: "이", isParticle: true },
      { content: "정말", isParticle: false },
      { content: "예뻐요", isParticle: false },
    ],
  },
  {
    problem_id: "wm5",
    base_text: "도와주셔서 감사해요",
    translation: "Thank you for helping me.",
    items: [
      { content: "도와주셔서", isParticle: false },
      { content: "감사해요", isParticle: false },
    ],
  },
].map((p, i) => ({ ...p, sort_order: i }));

// 문장 만들기
export const SENTENCE_MAKING_PROBLEMS = [
  { problem_id: "sm0", word: "사과", model_answer: "저는 아침마다 사과를 먹어요." },
  { problem_id: "sm1", word: "학교", model_answer: "저는 매일 학교에 가요." },
  { problem_id: "sm2", word: "친구", model_answer: "저는 친구와 함께 공부해요." },
  { problem_id: "sm3", word: "좋아하다", model_answer: "저는 한국 음식을 좋아해요." },
  { problem_id: "sm4", word: "예쁘다", model_answer: "이 가방이 정말 예뻐요." },
  { problem_id: "sm5", word: "감사하다", model_answer: "선생님께 감사해요." },
].map((p, i) => ({
  ...p,
  word_meaning: MEANING[p.word],
  sort_order: i,
}));

// 말하기(녹음)
export const RECORDING_PROBLEMS = [
  {
    problem_id: "r0",
    label: "사과",
    sentence: "저는 아침마다 사과를 먹어요.",
    translation: "I eat an apple every morning.",
    mode: "read" as const,
  },
  {
    problem_id: "r1",
    label: "학교",
    sentence: "저는 매일 학교에 가요.",
    translation: "I go to school every day.",
    mode: "listen" as const,
  },
  {
    problem_id: "r2",
    label: "친구",
    sentence: "친구를 만나서 반가워요.",
    translation: "Nice to meet my friend.",
    mode: "read" as const,
  },
  {
    problem_id: "r3",
    label: "좋아하다",
    sentence: "저는 한국 음식을 좋아해요.",
    translation: "I like Korean food.",
    mode: "listen" as const,
  },
  {
    problem_id: "r4",
    label: "예쁘다",
    sentence: "이 꽃이 정말 예뻐요.",
    translation: "This flower is really pretty.",
    mode: "read" as const,
  },
  {
    problem_id: "r5",
    label: "감사하다",
    sentence: "도와주셔서 감사해요.",
    translation: "Thank you for helping me.",
    mode: "listen" as const,
  },
].map((p, i) => ({
  ...p,
  source_type: "teacher_input" as const,
  sort_order: i,
  sentence_audio_url: `${AUDIO_BASE}/recording-${i}.mp3`,
}));

// ── 퀴즈 B: 빈칸 채우기만 켠 단순 퀴즈 (편집 화면 캡처용) ───────────────────
export const QUIZ_B_ID = "00000000-0000-0000-0000-0000000000b2";
export const QUIZ_B_TITLE = "일상 표현 빈칸 채우기";
export const QUIZ_B_WORDS = ["학생", "선생님", "공부하다", "도서관", "열심히"];

export const QUIZ_B_FILL_BLANK_PROBLEMS = [
  {
    id: "b0",
    word: "학생",
    sentence: "저는 한국어를 배우는 () 이에요.",
    hint: "이다",
    answer: "학생",
    translation: "I am a student learning Korean.",
  },
  {
    id: "b1",
    word: "선생님",
    sentence: "() 께 질문이 있어요.",
    hint: "께",
    answer: "선생님",
    translation: "I have a question for the teacher.",
  },
  {
    id: "b2",
    word: "공부하다",
    sentence: "저는 매일 한국어를 () .",
    hint: "아요/어요",
    answer: "공부해요",
    translation: "I study Korean every day.",
  },
  {
    id: "b3",
    word: "도서관",
    sentence: "저는 () 에서 책을 읽어요.",
    hint: "에서",
    answer: "도서관",
    translation: "I read books at the library.",
  },
  {
    id: "b4",
    word: "열심히",
    sentence: "저는 () 공부해요.",
    hint: "부사",
    answer: "열심히",
    translation: "I study hard.",
  },
].map((p, i) => ({
  ...p,
  sentence_audio_url: `https://example.com/dummy-audio/quiz-b/fill-blank-${i}.mp3`,
}));

// ── 퀴즈 C: 말하기 연습만 켠 단순 퀴즈 (s-speak 캡처 전용) ───────────────────
// recording은 STAGE_ORDER(matchup→type_answer→fill_blank→word_magnet→
// sentence_making→recording)상 마지막이라, 6유형을 다 켠 퀴즈 A로는 앞의 5단계를
// 전부 풀어야만 도달한다. 자동 캡처에서 그걸 다 흉내내는 건 비현실적이라, 빈칸
// 채우기만 켠 퀴즈 B와 같은 패턴으로 말하기만 켠 퀴즈를 하나 더 둔다.
export const QUIZ_C_ID = "00000000-0000-0000-0000-0000000000b3";
export const QUIZ_C_TITLE = "발음 연습 퀴즈";
export const QUIZ_C_WORDS = QUIZ_A_WORDS;

// ── 학생 화면 캡처용 단일 유형 퀴즈들 (퀴즈 D~H) ─────────────────────────────
// 왜 유형·모드마다 퀴즈를 따로 두는가:
//  1) QuizTake가 문제 목록을 매 로드마다 셔플한다(QuizTake.tsx:614 등). 그래서 시드의
//     sort_order로 "첫 문제"를 고정할 수 없다 — 말하기 연습에서 read/listen 모드가
//     실행마다 바뀌는 문제가 실제로 있었다.
//  2) SpeakingStage의 "다음 문제" 버튼은 녹음을 마친 뒤에만 나타난다
//     (SpeakingStage.tsx:481-506). 2번째 문제로 넘어가 캡처할 방법이 없다.
//  3) STAGE_ORDER 때문에 6유형 통합 퀴즈로는 첫 유형(짝 맞추기)에만 도달한다.
// 결론: "그 유형·그 모드만 들어 있는 퀴즈"가 결정적으로 캡처하는 유일한 방법이다.

/** 퀴즈 C = 보고 말하기(read) 문항만. sort_order를 0부터 다시 매긴다. */
export const QUIZ_C_RECORDING_PROBLEMS = RECORDING_PROBLEMS.filter((p) => p.mode === "read").map(
  (p, i) => ({ ...p, sort_order: i }),
);

/** 퀴즈 D = 듣고 말하기(listen) 문항만. */
export const QUIZ_D_ID = "00000000-0000-0000-0000-0000000000b4";
export const QUIZ_D_TITLE = "듣고 따라 말하기 연습";
export const QUIZ_D_RECORDING_PROBLEMS = RECORDING_PROBLEMS.filter((p) => p.mode === "listen").map(
  (p, i) => ({ ...p, sort_order: i }),
);

/** 퀴즈 E = 단어 받아쓰기만. */
export const QUIZ_E_ID = "00000000-0000-0000-0000-0000000000b5";
export const QUIZ_E_TITLE = "단어 받아쓰기 연습";

/** 퀴즈 F = 문장 순서 맞추기만. */
export const QUIZ_F_ID = "00000000-0000-0000-0000-0000000000b6";
export const QUIZ_F_TITLE = "문장 순서 맞추기 연습";

/** 퀴즈 G = 문장 만들기만. */
export const QUIZ_G_ID = "00000000-0000-0000-0000-0000000000b7";
export const QUIZ_G_TITLE = "문장 만들기 연습";

/** 퀴즈 H = 짝 맞추기만. 퀴즈 A의 첫 스테이지도 짝 맞추기지만, 학생1이 퀴즈 A를 이미
 *  완료한 상태라 진행도 복원 로직에 걸릴 수 있어 전용 퀴즈를 따로 둔다. */
export const QUIZ_H_ID = "00000000-0000-0000-0000-0000000000b8";
export const QUIZ_H_TITLE = "단어 짝 맞추기 연습";

/** 결과 화면 말하기 연습 탭의 단어별 색상 피드백용 데이터.
 *  renderSentenceWithFeedback가 `{ word, accuracyScore }[]`를 기대한다
 *  (src/components/quiz/quizResultUtils.tsx:109-112). 점수를 일부러 다르게 줘서
 *  잘한 단어/아쉬운 단어가 색으로 구분되는 게 스크린샷에 드러나게 한다. */
export function wordFeedbackFor(sentence: string) {
  const scores = [96, 88, 72, 93, 85, 68];
  return sentence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => ({ word, accuracyScore: scores[i % scores.length] }));
}

// ── 공유 링크 (퀴즈 A) ──────────────────────────────────────────────────
export const QUIZ_SHARE = {
  id: "00000000-0000-0000-0000-0000000000c1",
  shareToken: "helpshot0001",
};

// ── 응시 결과 (학생1 · 퀴즈 A) ──────────────────────────────────────────
// 헤드라인 score/total_questions는 요청대로 4/6으로 고정한다. 실제 앱의
// finalize_quiz_result RPC는 모든 유형의 점수를 합산하지만, 이 시드는 RPC를
// 거치지 않고 행을 직접 꽂아 넣으므로 유형별 세부 점수(아래 SUB_SCORES)와
// 헤드라인 숫자가 산술적으로 정확히 일치하진 않는다 — 스크린샷 목적의
// 고정값이라 문제 없다.
export const RESULT_ID = "00000000-0000-0000-0000-0000000000d1";
export const RESULT_HEADLINE = { score: 4, totalQuestions: 6 };

export const RESULT_SUB_SCORES = {
  fillBlank: { score: 5, total: 6 }, // fb5(감사하다) 오답
  matchup: { score: 5, total: 6 }, // m2(친구) 오답
  typeAnswer: { score: 5, total: 6 }, // t4(예쁘다) 오답
  wordMagnet: { score: 6, total: 6 },
  sentenceMaking: { score: 6, total: 6 },
  recording: { score: 6, total: 6 },
};

// ── 오답 진행도 (학생1) ─────────────────────────────────────────────────
export const WRONG_ANSWER_PROGRESS = [
  { word: "학교", correctStreak: 2, mastered: true }, // ⭐ 마스터
  { word: "친구", correctStreak: 1, mastered: false },
  { word: "감사하다", correctStreak: 0, mastered: false },
];

/** 선생님 오답 복습 퀴즈 위저드(t-wronganswer)에서 펼쳐 보일 단어.
 *  학생1의 오답 3개 중 이것만 빈칸 채우기라, 펼치면 문장·번역·학생이 쓴 답이
 *  전부 나온다(짝 맞추기·받아쓰기 오답은 문장이 없다). */
export const WRONG_ANSWER_EXPAND_WORD = "감사하다";

// ── 알림 (선택) ─────────────────────────────────────────────────────────
export const NOTIFICATIONS = [
  {
    id: "00000000-0000-0000-0000-0000000000e1",
    userId: TEACHER.id,
    fromUserId: STUDENT1.id,
    type: "quiz_completed" as const,
    title: `김민수님이 ${QUIZ_A_TITLE} 퀴즈를 완료했습니다.`,
    message: `${QUIZ_A_TITLE} — 4/6`,
    quizId: QUIZ_A_ID,
  },
  {
    id: "00000000-0000-0000-0000-0000000000e2",
    userId: TEACHER.id,
    fromUserId: STUDENT2.id,
    type: "student_joined" as const,
    title: `이서연님이 ${CLASS_A.name}에 가입했습니다.`,
    message: `${CLASS_A.name}에 새 학생이 가입했어요.`,
    quizId: null as string | null,
  },
];
