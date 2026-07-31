/**
 * 도움말 센터 스크린샷 캡처용 더미 데이터 시드 스크립트.
 *
 * 로컬 Supabase(`npx supabase start`)가 떠 있는 상태에서 실행한다. service_role
 * 키로 각 테이블에 직접 INSERT/UPSERT한다 — AI 엣지 함수는 전혀 호출하지 않고
 * fixtures.ts에 하드코딩된 결정적 값만 쓰므로, 몇 번을 다시 돌려도 항상 같은
 * 화면이 나온다(캡처가 의미 있으려면 이게 핵심).
 *
 * 실행:
 *   $env:SUPABASE_URL='http://127.0.0.1:54321'
 *   $env:SUPABASE_SERVICE_KEY='<supabase status의 SERVICE_ROLE_KEY>'
 *   npx tsx scripts/help-shots/seed.ts [--reset]
 *
 * --reset: 재시딩 전에 3개 계정(teacher/student1/student2)을 auth.users에서
 *   먼저 삭제한다. 이 프로젝트의 거의 모든 테이블이 auth.users를 ON DELETE
 *   CASCADE로 참조하므로, 계정 3개를 지우면 클래스/퀴즈/결과/오답진행도 등
 *   이 시드가 만든 데이터가 사실상 전부 함께 사라진다. 그 다음 처음부터
 *   다시 만든다.
 *   --reset 없이 실행하면 각 테이블의 자연 키(예: quiz_id+problem_id)로
 *   upsert하므로 이미 존재하는 행은 갱신되고 중복 생성되지 않는다 — 두
 *   방식 모두 멱등이다.
 *
 * ⚠ SUPABASE_URL이 127.0.0.1/localhost가 아니면 즉시 에러를 던진다.
 *   이 스크립트는 로컬 전용이며, 원격(운영) DB에 실수로 더미 데이터를
 *   넣는 사고를 막기 위한 안전장치다. 반드시 지켜야 한다.
 *
 * 트러블슈팅: 로컬 Supabase가 처음 뜨지 않는다면 supabase/migrations/에
 * 스키마 드리프트(원격 DB에만 있던 컬럼이 마이그레이션 파일 자체엔 없는
 * 경우)가 남아 있을 수 있다. src/integrations/supabase/types.ts(원격 DB에서
 * 생성된 진짜 스키마)와 마이그레이션 파일들을 대조해서 찾아라 — 자세한
 * 내용은 이 디렉터리의 README.md 참고.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as F from "./fixtures";

// ── 안전장치: 로컬 DB인지 반드시 확인 ──────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "SUPABASE_URL 환경변수가 없습니다. `npx supabase status`로 로컬 API URL을 확인하고 " +
      "$env:SUPABASE_URL='http://127.0.0.1:54321' 처럼 설정한 뒤 다시 실행하세요.",
  );
}

let host = "";
try {
  host = new URL(SUPABASE_URL).hostname;
} catch {
  throw new Error(`SUPABASE_URL이 올바른 URL이 아닙니다: "${SUPABASE_URL}"`);
}

if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error(
    `SUPABASE_URL이 로컬 주소가 아닙니다 (host="${host}"). ` +
      "이 스크립트는 로컬 전용 더미 데이터 시더입니다 — 운영 DB에 실수로 " +
      "더미 데이터를 넣는 걸 막기 위해 127.0.0.1/localhost가 아니면 실행을 거부합니다.",
  );
}

if (!SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_KEY 환경변수가 없습니다. `npx supabase status`의 " +
      "SERVICE_ROLE_KEY(또는 legacy service_role JWT) 값을 설정하세요.",
  );
}

const RESET = process.argv.includes("--reset");

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function must<T>(label: string, result: { data: T; error: unknown }): T {
  if (result.error) {
    console.error(`[실패] ${label}:`, result.error);
    throw new Error(`${label} 실패`);
  }
  return result.data;
}

async function upsert(table: string, rows: object[], onConflict: string) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`[실패] upsert ${table} (onConflict=${onConflict}):`, error);
    throw new Error(`upsert ${table} 실패`);
  }
  console.log(`  - ${table}: ${rows.length}행 upsert`);
}

/** 문제 테이블의 논리 id(problem_id) → 행 PK(uuid) 매핑을 DB에서 읽어온다.
 *
 *  왜 필요한가: recording_answers·sentence_making_answers의 `problem_id` 컬럼은
 *  이름과 달리 논리 id("r0")가 아니라 **문제 행의 PK(uuid)**를 담는다.
 *  앱이 그렇게 쓴다 — QuizTake는 stageResults의 키로 problems[].id(=행 PK)를 그대로
 *  넣고(QuizTake.tsx:860, 833), 결과 화면도 같은 값으로 답안을 찾는다
 *  (QuizResult.tsx:617, 519). 두 테이블 모두 문제 테이블로의 FK가 없어서
 *  논리 id를 넣어도 DB는 아무 불평을 하지 않고 화면만 조용히 빈다 —
 *  실제로 말하기 탭이 단어별 색 없이 검은 글씨로 나오고 AI 피드백 상자가
 *  빈 회색 박스로 남았다. 다른 유형(matchup/type_answer/word_magnet)은
 *  화면 쪽도 논리 id로 조회하므로 이 변환이 필요 없다. */
async function problemRowIdMap(table: string, quizId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.from(table).select("id, problem_id").eq("quiz_id", quizId);
  if (error) {
    console.error(`[실패] ${table} id 매핑 조회:`, error);
    throw new Error(`${table} id 매핑 조회 실패`);
  }
  return new Map(((data ?? []) as { id: string; problem_id: string }[]).map((r) => [r.problem_id, r.id]));
}

/** 논리 id를 행 PK로 바꾼다. 못 찾으면 조용히 넘어가지 않고 즉시 중단한다
 *  (빠진 채로 시드가 끝나면 캡처 화면에서야 뒤늦게 드러난다). */
function rowIdOf(map: Map<string, string>, problemId: string, table: string): string {
  const rowId = map.get(problemId);
  if (!rowId) throw new Error(`${table}에서 problem_id="${problemId}" 행을 찾지 못했습니다`);
  return rowId;
}

async function resetAuthUsers() {
  console.log("[--reset] teacher/student1/student2 계정 삭제 중 (cascade로 대부분 데이터 함께 삭제)...");
  for (const id of [F.TEACHER.id, F.STUDENT1.id, F.STUDENT2.id]) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error && !/not.*found/i.test(error.message ?? "")) {
      console.warn(`  - ${id} 삭제 중 경고(무시): ${error.message}`);
    }
  }
}

async function upsertAuthUser(user: { id: string; email: string; name: string }, role: "teacher" | "student") {
  const { error: createError } = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: F.SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { name: user.name, role },
  });

  if (createError) {
    // 이미 존재하면(--reset 없이 재실행) 원하는 상태로 업데이트만 한다.
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email: user.email,
      password: F.SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name, role },
    });
    if (updateError) {
      console.error(`[실패] auth user upsert (${user.email}):`, createError, updateError);
      throw new Error(`auth user upsert 실패: ${user.email}`);
    }
  }
  console.log(`  - auth.users: ${user.email} (${user.id}) 준비 완료`);
}

async function main() {
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(RESET ? "모드: --reset (전체 재생성)" : "모드: upsert (기존 데이터 갱신)");

  if (RESET) {
    await resetAuthUsers();
  }

  // 1. 계정
  console.log("\n[1/10] 계정 생성");
  await upsertAuthUser(F.TEACHER, "teacher");
  await upsertAuthUser(F.STUDENT1, "student");
  await upsertAuthUser(F.STUDENT2, "student");

  // 2. 프로필 — role은 여기서 확정된다(트리거로 자동 생성되는 게 아니라
  // src/hooks/useAuth.tsx의 AuthCallback 플로우가 수동으로 만드는 것과 동일한 패턴).
  console.log("\n[2/10] 프로필");
  await upsert(
    "profiles",
    [
      { user_id: F.TEACHER.id, name: F.TEACHER.name, role: "teacher" },
      { user_id: F.STUDENT1.id, name: F.STUDENT1.name, role: "student" },
      { user_id: F.STUDENT2.id, name: F.STUDENT2.name, role: "student" },
    ],
    "user_id",
  );

  // 3. 선생님 신청 — 승인 완료 상태. (권한의 단일 진실은 profiles.role이고
  // 이 테이블은 참고용 상태값일 뿐이라는 게 20260611130000 마이그레이션의 설계.)
  console.log("\n[3/10] 선생님 신청 (승인 완료)");
  await upsert(
    "teacher_applications",
    [{ user_id: F.TEACHER.id, status: "approved", reviewed_at: new Date().toISOString() }],
    "user_id",
  );

  // 4. 클래스 + 공지 + 클래스 멤버
  console.log("\n[4/10] 클래스 / 공지 / 멤버");
  await upsert(
    "classes",
    [
      {
        id: F.CLASS_A.id,
        teacher_id: F.TEACHER.id,
        name: F.CLASS_A.name,
        description: F.CLASS_A.description,
        invite_code: F.CLASS_A.inviteCode,
      },
    ],
    "id",
  );
  await upsert(
    "class_members",
    [
      { class_id: F.CLASS_A.id, student_id: F.STUDENT1.id },
      { class_id: F.CLASS_A.id, student_id: F.STUDENT2.id },
    ],
    "class_id,student_id",
  );
  await upsert(
    "announcements",
    [
      {
        id: F.ANNOUNCEMENT.id,
        class_id: F.CLASS_A.id,
        teacher_id: F.TEACHER.id,
        title: F.ANNOUNCEMENT.title,
        content: F.ANNOUNCEMENT.content,
      },
    ],
    "id",
  );

  // 5. 퀴즈 A — 6가지 유형 전부 켠 통합 퀴즈
  console.log("\n[5/10] 퀴즈 A (6가지 유형)");
  await upsert(
    "quizzes",
    [
      {
        id: F.QUIZ_A_ID,
        teacher_id: F.TEACHER.id,
        title: F.QUIZ_A_TITLE,
        words: F.QUIZ_A_WORDS,
        words_per_set: 3,
        timer_enabled: true,
        timer_seconds: 60,
        problems: F.FILL_BLANK_PROBLEMS,
        fill_blank_enabled: true,
        matchup_enabled: true,
        type_answer_enabled: true,
        word_magnet_enabled: true,
        sentence_making_enabled: true,
        recording_enabled: true,
      },
    ],
    "id",
  );

  await upsert(
    "quiz_problems",
    F.FILL_BLANK_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_A_ID,
      problem_id: p.id,
      word: p.word,
      sentence: p.sentence,
      hint: p.hint,
      translation: p.translation,
      sentence_audio_url: p.sentence_audio_url,
    })),
    "quiz_id,problem_id",
  );
  await upsert(
    "quiz_answers",
    F.FILL_BLANK_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_A_ID,
      problem_id: p.id,
      word: p.word,
      correct_answer: p.answer,
    })),
    "quiz_id,problem_id",
  );
  await upsert(
    "matchup_problems",
    F.MATCHUP_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_A_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "type_answer_problems",
    F.TYPE_ANSWER_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_A_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "word_magnet_problems",
    F.WORD_MAGNET_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_A_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "sentence_making_problems",
    F.SENTENCE_MAKING_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_A_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "recording_problems",
    F.RECORDING_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_A_ID, ...p })),
    "quiz_id,problem_id",
  );

  // 6. 퀴즈 B — 빈칸 채우기만 켠 단순 퀴즈 (편집 화면 캡처용)
  console.log("\n[6/10] 퀴즈 B (빈칸 채우기만)");
  await upsert(
    "quizzes",
    [
      {
        id: F.QUIZ_B_ID,
        teacher_id: F.TEACHER.id,
        title: F.QUIZ_B_TITLE,
        words: F.QUIZ_B_WORDS,
        words_per_set: 5,
        timer_enabled: false,
        problems: F.QUIZ_B_FILL_BLANK_PROBLEMS,
        fill_blank_enabled: true,
        matchup_enabled: false,
        type_answer_enabled: false,
        word_magnet_enabled: false,
        sentence_making_enabled: false,
        recording_enabled: false,
      },
    ],
    "id",
  );
  await upsert(
    "quiz_problems",
    F.QUIZ_B_FILL_BLANK_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_B_ID,
      problem_id: p.id,
      word: p.word,
      sentence: p.sentence,
      hint: p.hint,
      translation: p.translation,
      sentence_audio_url: p.sentence_audio_url,
    })),
    "quiz_id,problem_id",
  );
  await upsert(
    "quiz_answers",
    F.QUIZ_B_FILL_BLANK_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_B_ID,
      problem_id: p.id,
      word: p.word,
      correct_answer: p.answer,
    })),
    "quiz_id,problem_id",
  );

  // 6b. 퀴즈 C — 말하기 연습만 켠 단순 퀴즈 (s-speak 캡처 전용, quiz A는 recording이
  // STAGE_ORDER 마지막이라 곧바로 도달할 수 없어서 별도로 둔다)
  console.log("\n[6b] 퀴즈 C (말하기 연습만)");
  await upsert(
    "quizzes",
    [
      {
        id: F.QUIZ_C_ID,
        teacher_id: F.TEACHER.id,
        title: F.QUIZ_C_TITLE,
        words: F.QUIZ_C_WORDS,
        words_per_set: 6,
        timer_enabled: false,
        problems: [],
        fill_blank_enabled: false,
        matchup_enabled: false,
        type_answer_enabled: false,
        word_magnet_enabled: false,
        sentence_making_enabled: false,
        recording_enabled: true,
      },
    ],
    "id",
  );
  // ⚠ upsert는 없어진 행을 지우지 않는다. 퀴즈 C는 원래 6문항(read+listen)이었다가
  // read 3문항으로 줄었는데, --reset 없이 재실행하면 예전 listen 문항이 그대로 남아
  // "보고 말하기 전용" 전제가 깨진다(실제로 한 번 겪었다). 캡처용 단일 유형 퀴즈들의
  // 문제 행은 upsert 전에 항상 지우고 다시 넣는다.
  for (const [table, quizIds] of [
    ["recording_problems", [F.QUIZ_C_ID, F.QUIZ_D_ID]],
    ["type_answer_problems", [F.QUIZ_E_ID]],
    ["word_magnet_problems", [F.QUIZ_F_ID]],
    ["sentence_making_problems", [F.QUIZ_G_ID]],
    ["matchup_problems", [F.QUIZ_H_ID]],
  ] as const) {
    const { error } = await supabase.from(table).delete().in("quiz_id", quizIds as unknown as string[]);
    if (error) {
      console.error(`[실패] ${table} 정리:`, error);
      throw new Error(`${table} 정리 실패`);
    }
  }
  console.log("  - 단일 유형 퀴즈의 기존 문제 행 정리 완료");

  // 퀴즈 C는 "보고 말하기(read)" 문항만 담는다 — 듣기 모드는 퀴즈 D가 맡는다.
  await upsert(
    "recording_problems",
    F.QUIZ_C_RECORDING_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_C_ID, ...p })),
    "quiz_id,problem_id",
  );

  // 6c. 퀴즈 D~H — 유형·모드별 단일 퀴즈 (학생 화면 캡처 전용)
  // 문제 셔플과 STAGE_ORDER 때문에 통합 퀴즈로는 특정 유형·모드 화면에 결정적으로
  // 도달할 수 없다. 자세한 이유는 fixtures.ts의 해당 섹션 주석 참고.
  console.log("\n[6c] 퀴즈 D~H (유형·모드별 단일 퀴즈)");

  /** 한 유형만 켠 퀴즈 행을 만든다. 켜지 않은 유형은 전부 false. */
  const singleTypeQuiz = (
    id: string,
    title: string,
    enabled: Partial<{
      fill_blank_enabled: boolean;
      matchup_enabled: boolean;
      type_answer_enabled: boolean;
      word_magnet_enabled: boolean;
      sentence_making_enabled: boolean;
      recording_enabled: boolean;
    }>,
  ) => ({
    id,
    teacher_id: F.TEACHER.id,
    title,
    words: F.QUIZ_A_WORDS,
    words_per_set: 6,
    timer_enabled: false,
    problems: [],
    fill_blank_enabled: false,
    matchup_enabled: false,
    type_answer_enabled: false,
    word_magnet_enabled: false,
    sentence_making_enabled: false,
    recording_enabled: false,
    ...enabled,
  });

  await upsert(
    "quizzes",
    [
      singleTypeQuiz(F.QUIZ_D_ID, F.QUIZ_D_TITLE, { recording_enabled: true }),
      singleTypeQuiz(F.QUIZ_E_ID, F.QUIZ_E_TITLE, { type_answer_enabled: true }),
      singleTypeQuiz(F.QUIZ_F_ID, F.QUIZ_F_TITLE, { word_magnet_enabled: true }),
      singleTypeQuiz(F.QUIZ_G_ID, F.QUIZ_G_TITLE, { sentence_making_enabled: true }),
      singleTypeQuiz(F.QUIZ_H_ID, F.QUIZ_H_TITLE, { matchup_enabled: true }),
    ],
    "id",
  );

  await upsert(
    "recording_problems",
    F.QUIZ_D_RECORDING_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_D_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "type_answer_problems",
    F.TYPE_ANSWER_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_E_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "word_magnet_problems",
    F.WORD_MAGNET_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_F_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "sentence_making_problems",
    F.SENTENCE_MAKING_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_G_ID, ...p })),
    "quiz_id,problem_id",
  );
  await upsert(
    "matchup_problems",
    F.MATCHUP_PROBLEMS.map((p) => ({ quiz_id: F.QUIZ_H_ID, ...p })),
    "quiz_id,problem_id",
  );

  // 7. 반 배정 + 공유 링크
  // 학생이 /quiz/:id/take로 들어가려면 클래스에 배정돼 있어야 한다(RLS).
  console.log("\n[7/10] 반 배정 / 공유 링크");
  await upsert(
    "quiz_assignments",
    [
      { id: "00000000-0000-0000-0000-0000000000f1", quiz_id: F.QUIZ_A_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f2", quiz_id: F.QUIZ_B_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f3", quiz_id: F.QUIZ_C_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f4", quiz_id: F.QUIZ_D_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f5", quiz_id: F.QUIZ_E_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f6", quiz_id: F.QUIZ_F_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f7", quiz_id: F.QUIZ_G_ID, class_id: F.CLASS_A.id },
      { id: "00000000-0000-0000-0000-0000000000f8", quiz_id: F.QUIZ_H_ID, class_id: F.CLASS_A.id },
    ],
    "id",
  );
  await upsert(
    "quiz_shares",
    [
      {
        id: F.QUIZ_SHARE.id,
        quiz_id: F.QUIZ_A_ID,
        share_token: F.QUIZ_SHARE.shareToken,
        created_by: F.TEACHER.id,
        allow_anonymous: true,
      },
    ],
    "id",
  );

  // 8. 응시 결과 (학생1 · 퀴즈 A) — 헤드라인 4/6, 오답 3개(빈칸1·받아쓰기1·짝맞추기1)
  console.log("\n[8/10] 퀴즈 A 응시 결과 (학생1)");
  const fillBlankAnswers = F.FILL_BLANK_PROBLEMS.map((p) => {
    const isWrong = p.id === "fb5";
    return {
      problemId: p.id,
      userAnswer: isWrong ? "감사행요" : p.answer,
      correctAnswer: p.answer,
      isCorrect: !isWrong,
      sentence: p.sentence,
      translation: p.translation,
      audioUrl: p.sentence_audio_url,
      word: p.word,
    };
  });

  await upsert(
    "quiz_results",
    [
      {
        id: F.RESULT_ID,
        quiz_id: F.QUIZ_A_ID,
        student_id: F.STUDENT1.id,
        score: F.RESULT_HEADLINE.score,
        total_questions: F.RESULT_HEADLINE.totalQuestions,
        answers: fillBlankAnswers,
        is_anonymous: false,
        fill_blank_score: F.RESULT_SUB_SCORES.fillBlank.score,
        fill_blank_total: F.RESULT_SUB_SCORES.fillBlank.total,
        matchup_score: F.RESULT_SUB_SCORES.matchup.score,
        matchup_total: F.RESULT_SUB_SCORES.matchup.total,
        type_answer_score: F.RESULT_SUB_SCORES.typeAnswer.score,
        type_answer_total: F.RESULT_SUB_SCORES.typeAnswer.total,
        word_magnet_score: F.RESULT_SUB_SCORES.wordMagnet.score,
        word_magnet_total: F.RESULT_SUB_SCORES.wordMagnet.total,
        sentence_making_score: F.RESULT_SUB_SCORES.sentenceMaking.score,
        sentence_making_total: F.RESULT_SUB_SCORES.sentenceMaking.total,
        recording_score: F.RESULT_SUB_SCORES.recording.score,
        recording_total: F.RESULT_SUB_SCORES.recording.total,
      },
    ],
    "id",
  );

  await upsert(
    "matchup_answers",
    F.MATCHUP_PROBLEMS.map((p) => {
      const isWrong = p.problem_id === F.MATCHUP_WRONG_PROBLEM_ID;
      return {
        quiz_id: F.QUIZ_A_ID,
        result_id: F.RESULT_ID,
        problem_id: p.problem_id,
        student_id: F.STUDENT1.id,
        selected_meaning: isWrong ? "school" : p.meaning_text,
        is_correct: !isWrong,
      };
    }),
    "quiz_id,problem_id,student_id,attempt_number",
  );

  await upsert(
    "type_answer_answers",
    F.TYPE_ANSWER_PROBLEMS.map((p) => {
      const isWrong = p.problem_id === F.TYPE_ANSWER_WRONG_PROBLEM_ID;
      return {
        quiz_id: F.QUIZ_A_ID,
        result_id: F.RESULT_ID,
        problem_id: p.problem_id,
        student_id: F.STUDENT1.id,
        student_answer: isWrong ? "이쁘다" : p.answer,
        is_correct: !isWrong,
      };
    }),
    "quiz_id,problem_id,student_id,attempt_number",
  );

  await upsert(
    "word_magnet_answers",
    F.WORD_MAGNET_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_A_ID,
      result_id: F.RESULT_ID,
      problem_id: p.problem_id,
      student_id: F.STUDENT1.id,
      student_sentence: p.base_text,
      is_correct: true,
    })),
    "quiz_id,problem_id,student_id,attempt_number",
  );

  // 아래 두 테이블은 problem_id에 행 PK(uuid)를 담는다(problemRowIdMap 주석 참고).
  // 예전 시드가 넣어둔 논리 id 행("r0" 등)은 화면에서 매칭되지 않는 유령 행이라
  // 다시 넣기 전에 이 결과의 기존 행을 지운다(onConflict 키가 problem_id를 포함해
  // upsert만으로는 갱신되지 않고 나란히 쌓인다).
  for (const table of ["recording_answers", "sentence_making_answers"] as const) {
    const { error } = await supabase.from(table).delete().eq("result_id", F.RESULT_ID);
    if (error) {
      console.error(`[실패] ${table} 정리:`, error);
      throw new Error(`${table} 정리 실패`);
    }
  }
  const smRowIds = await problemRowIdMap("sentence_making_problems", F.QUIZ_A_ID);
  const recRowIds = await problemRowIdMap("recording_problems", F.QUIZ_A_ID);

  await upsert(
    "sentence_making_answers",
    F.SENTENCE_MAKING_PROBLEMS.map((p) => ({
      quiz_id: F.QUIZ_A_ID,
      result_id: F.RESULT_ID,
      problem_id: rowIdOf(smRowIds, p.problem_id, "sentence_making_problems"),
      student_id: F.STUDENT1.id,
      student_sentence: p.model_answer,
      word_usage_score: 92,
      grammar_score: 90,
      naturalness_score: 88,
      total_score: 90,
      ai_feedback: "문장이 자연스럽고 단어를 정확하게 사용했어요.",
      model_answer: p.model_answer,
      is_passed: true,
    })),
    "quiz_id,problem_id,student_id,attempt_number",
  );

  await upsert(
    "recording_answers",
    F.RECORDING_PROBLEMS.map((p, i) => ({
      quiz_id: F.QUIZ_A_ID,
      result_id: F.RESULT_ID,
      problem_id: rowIdOf(recRowIds, p.problem_id, "recording_problems"),
      student_id: F.STUDENT1.id,
      recording_url: `https://example.com/dummy-audio/recordings/${p.problem_id}.webm`,
      recording_duration_seconds: 3.5 + i * 0.2,
      pronunciation_score: 88,
      accuracy_score: 90,
      fluency_score: 87,
      completeness_score: 92,
      prosody_score: 85,
      overall_score: 88,
      // 결과 화면 말하기 연습 탭이 이 배열로 단어별 색을 칠한다. 비워두면 문장 전체가
      // 한 색으로만 나와서 "단어별 피드백"이라는 도움말 설명을 화면이 뒷받침하지 못한다.
      word_level_feedback: F.wordFeedbackFor(p.sentence),
      recognized_text: p.sentence,
      is_passed: true,
    })),
    "quiz_id,problem_id,student_id,attempt_number",
  );

  // 9. 오답 진행도 — 마스터 1개 + 미마스터 2개
  console.log("\n[9/10] 오답 진행도");
  const now = new Date().toISOString();
  await upsert(
    "wrong_answer_progress",
    F.WRONG_ANSWER_PROGRESS.map((w) => ({
      student_id: F.STUDENT1.id,
      word: w.word,
      correct_streak: w.correctStreak,
      last_practiced_at: now,
      mastered_at: w.mastered ? now : null,
    })),
    "student_id,word",
  );

  // 10. 알림 (선택 — 대시보드 스크린샷용)
  console.log("\n[10/10] 알림");
  await upsert(
    "notifications",
    F.NOTIFICATIONS.map((n) => ({
      id: n.id,
      user_id: n.userId,
      from_user_id: n.fromUserId,
      type: n.type,
      title: n.title,
      message: n.message,
      quiz_id: n.quizId,
    })),
    "id",
  );

  console.log("\n완료. 캡처 스크립트에서 쓸 값:");
  console.log(`  teacher  : ${F.TEACHER.email} / ${F.SEED_PASSWORD}`);
  console.log(`  student1 : ${F.STUDENT1.email} / ${F.SEED_PASSWORD}`);
  console.log(`  student2 : ${F.STUDENT2.email} / ${F.SEED_PASSWORD}`);
  console.log(`  class invite code : ${F.CLASS_A.inviteCode}`);
  console.log(`  quiz A id : ${F.QUIZ_A_ID}`);
  console.log(`  quiz B id : ${F.QUIZ_B_ID}`);
  console.log(`  quiz C id : ${F.QUIZ_C_ID}`);
  console.log(`  share token (quiz A) : ${F.QUIZ_SHARE.shareToken}`);
  console.log(`  quiz A result id (student1) : ${F.RESULT_ID}`);
}

main().catch((err) => {
  console.error("\n시드 실패:", err);
  process.exit(1);
});
