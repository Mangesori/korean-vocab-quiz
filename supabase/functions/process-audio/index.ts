// process-audio: 퀴즈 음성(TTS)을 서버에서 만든다.
//
// 요청 3종 (config.toml에서 verify_jwt = false — 여기서 직접 인증):
//   1. {}                       pg_cron. 헤더 x-cron-secret == 환경 변수 AUDIO_CRON_SECRET.
//                               즉시 202 응답 후 전체에서 claim해서 처리(EdgeRuntime.waitUntil).
//   2. { quizId }               사용자 JWT(퀴즈 소유자 또는 관리자). 즉시 { accepted: true },
//                               그 퀴즈만 claim해서 처리. (운영 점검용으로 올바른 x-cron-secret도 허용)
//   3. { targets, force: true } 사용자 JWT(모든 target이 본인 퀴즈 또는 관리자). 최대 30개.
//                               끝까지 기다려 { results: [{ table, id, url, error }] }.
//                               URL이 있어도 새로 만들고, 빈칸 채우기 음성 재사용도 하지 않는다.
//
// "음성이 필요한 행" 정의와 점유는 DB(audio_work_items 뷰, claim_audio_work RPC)가 맡는다.
// 키·비밀·JWT는 로그에 남기지 않는다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { synthesize, type TtsProvider } from "../_shared/tts.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "quiz-audio";
// ElevenLabs 요금제가 동시 요청 2개까지만 허용한다. 호출 하나는 1개씩 처리하고, cron 호출끼리
// 겹치지 않게 1분 안에 끝내서 "cron 1 + 화면의 시작 신호 1" 이 동시에 돌아도 한도 안에 든다.
const CONCURRENCY = 1;
/** 이 시간이 지나면 새 행을 시작하지 않는다. 진행 중인 행(공급자당 최대 25초)은 마저 끝낸다. */
const START_CUTOFF_MS = 30_000;
/** 동시 요청 한도(429)로 실패하면 시도 횟수에 세지 않고 이만큼 뒤에 다시 시도한다. */
const RATE_LIMIT_RETRY_MS = 30_000;
const TTS_TIMEOUT_MS = 25_000;
const MAX_TARGETS = 30;
const RETRY_BACKOFF_MS = 2 * 60_000; // 실패 시 다음 시도까지: attempts × 2분
const IDLE_POLL_MS = 1_500;

type AudioTable = "quiz_problems" | "recording_problems";

interface WorkItem {
  table: AudioTable;
  id: string;
}

interface RowResult {
  url: string | null;
  error: string | null;
}

interface AudioRow {
  id: string;
  quiz_id: string;
  problem_id: string;
  sentence: string;
  sentence_audio_url: string | null;
  audio_attempts: number;
  mode?: string;
}

interface QuizRow {
  id: string;
  teacher_id: string;
  tts_provider: string | null;
  problems: unknown;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function hasValidCronSecret(req: Request): boolean {
  const expected = Deno.env.get("AUDIO_CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  return !!expected && !!given && timingSafeEqual(given, expected);
}

function runInBackground(promise: Promise<unknown>): void {
  const p = promise.catch((e) => console.error("process-audio 백그라운드 오류:", errMsg(e)));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(p);
  }
}

/**
 * 읽은 텍스트의 md5 hex(소문자, UTF-8 바이트). DB에는 텍스트 대신 이 해시만 저장한다 —
 * quiz_problems 텍스트는 정답을 채운 문장이라 그대로 두면 정답이 새어 나간다.
 * Postgres의 md5(text)와 같은 값이다(DB 인코딩 UTF-8).
 */
async function md5Hex(text: string): Promise<string> {
  const buf = await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── 텍스트 규칙 (QuizPreview.tsx generateAndUploadAudio와 동일) ───────────────

function cleanEnding(s: string): string {
  return s.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".").trim();
}

function findAnswer(problems: unknown, problemId: string): string | null {
  if (!Array.isArray(problems)) return null;
  for (const p of problems) {
    if (p && typeof p === "object" && String((p as Record<string, unknown>).id) === problemId) {
      const a = (p as Record<string, unknown>).answer;
      if (typeof a === "string" && a.trim() !== "") return a;
      if (typeof a === "number") return String(a);
      return null;
    }
  }
  return null;
}

function fillBlankText(sentence: string, answer: string): string {
  return cleanEnding(sentence.replace(/\(\s*\)|\(\)/g, () => answer));
}

/** 행이 읽어야 할 텍스트. quiz_problems는 정답이 없으면 오류. */
function audioTextFor(table: AudioTable, row: AudioRow, quiz: QuizRow): { text: string } | { error: string } {
  let text: string;
  if (table === "quiz_problems") {
    const answer = findAnswer(quiz.problems, row.problem_id);
    if (answer === null) return { error: "정답(answer)을 찾을 수 없어 빈칸을 채울 수 없음" };
    text = fillBlankText(row.sentence, answer);
  } else {
    text = cleanEnding(row.sentence);
  }
  if (!text) return { error: "읽을 문장이 비어 있음" };
  return { text };
}

// ─── DB 접근 ──────────────────────────────────────────────────────────────────

const ROW_COLUMNS: Record<AudioTable, string> = {
  quiz_problems: "id, quiz_id, problem_id, sentence, sentence_audio_url, audio_attempts",
  recording_problems: "id, quiz_id, problem_id, sentence, sentence_audio_url, audio_attempts, mode",
};

async function loadRow(admin: Admin, table: AudioTable, id: string): Promise<AudioRow | null> {
  const { data, error } = await admin.from(table).select(ROW_COLUMNS[table]).eq("id", id).maybeSingle();
  if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
  return (data as AudioRow | null) ?? null;
}

async function loadQuiz(admin: Admin, quizId: string): Promise<QuizRow | null> {
  const { data, error } = await admin
    .from("quizzes")
    .select("id, teacher_id, tts_provider, problems")
    .eq("id", quizId)
    .maybeSingle();
  if (error) throw new Error(`quizzes 조회 실패: ${error.message}`);
  return (data as QuizRow | null) ?? null;
}

async function markFailure(admin: Admin, item: WorkItem, row: AudioRow | null, message: string, force: boolean) {
  const audio_error = message.slice(0, 500);
  if (force) {
    // 강제 재생성 실패: 기존 URL은 그대로 두고(있으면) 오류만 남기고 잠금을 푼다.
    await admin.from(item.table).update({ audio_error, audio_locked_until: null }).eq("id", item.id);
    return;
  }
  const attempts = Math.max(row?.audio_attempts ?? 1, 1);
  if (/\b429\b/.test(message)) {
    // 일시적인 동시 요청 한도라 실패 횟수를 되돌린다(5회 소진으로 영구 실패가 되지 않게).
    await admin
      .from(item.table)
      .update({
        audio_error,
        audio_attempts: Math.max(attempts - 1, 0),
        audio_locked_until: new Date(Date.now() + RATE_LIMIT_RETRY_MS).toISOString(),
      })
      .eq("id", item.id)
      .is("sentence_audio_url", null);
    return;
  }
  const lockedUntil = new Date(Date.now() + attempts * RETRY_BACKOFF_MS).toISOString();
  await admin
    .from(item.table)
    .update({ audio_error, audio_locked_until: lockedUntil })
    .eq("id", item.id)
    .is("sentence_audio_url", null);
}

// ─── 행 하나 처리 ─────────────────────────────────────────────────────────────

async function processRow(admin: Admin, item: WorkItem, force: boolean): Promise<RowResult> {
  let row: AudioRow | null = null;
  try {
    row = await loadRow(admin, item.table, item.id);
    if (!row) return { url: null, error: "행을 찾을 수 없음" };

    if (!force) {
      // claim 이후 다른 곳에서 이미 채웠거나 녹음 방식이 바뀌었으면 할 일이 없다.
      if (row.sentence_audio_url) return { url: row.sentence_audio_url, error: null };
      if (item.table === "recording_problems" && row.mode !== "listen") {
        await admin.from(item.table).update({ audio_locked_until: null }).eq("id", item.id);
        return { url: null, error: null };
      }
    } else {
      // 강제 처리 중에는 cron이 같은 행을 집어가지 않게 잠가 둔다(시도 횟수는 늘리지 않음).
      await admin
        .from(item.table)
        .update({ audio_locked_until: new Date(Date.now() + 3 * 60_000).toISOString() })
        .eq("id", item.id);
    }

    const quiz = await loadQuiz(admin, row.quiz_id);
    if (!quiz) {
      await markFailure(admin, item, row, "퀴즈를 찾을 수 없음", force);
      return { url: null, error: "퀴즈를 찾을 수 없음" };
    }

    const built = audioTextFor(item.table, row, quiz);
    if ("error" in built) {
      await markFailure(admin, item, row, built.error, force);
      return { url: null, error: built.error };
    }
    const text = built.text;
    const textHash = await md5Hex(text);

    // 재사용: 녹음 문장이 같은 문제의 빈칸 채우기 완성 문장과 같고 그 행에 URL이 있으면
    // 녹음 행에 URL을 복사해 저장한다. 화면은 빈칸 채우기 음성을 대신 찾지 않으므로
    // A1/A2 말하기(듣기) 음성은 이 복사가 유일한 경로다.
    let url: string | null = null;
    let uploadedPath: string | null = null;
    if (!force && item.table === "recording_problems") {
      const { data: fb } = await admin
        .from("quiz_problems")
        .select("id, quiz_id, problem_id, sentence, sentence_audio_url, audio_attempts")
        .eq("quiz_id", row.quiz_id)
        .eq("problem_id", row.problem_id)
        .maybeSingle();
      const fbRow = fb as AudioRow | null;
      if (fbRow?.sentence_audio_url) {
        const fbText = audioTextFor("quiz_problems", fbRow, quiz);
        if ("text" in fbText && fbText.text === text) url = fbRow.sentence_audio_url;
      }
    }

    if (!url) {
      const provider: TtsProvider = quiz.tts_provider === "azure" ? "azure" : "elevenlabs";
      const tts = await synthesize(text, provider, { timeoutMs: TTS_TIMEOUT_MS });
      if (!tts.ok) {
        await markFailure(admin, item, row, tts.message, force);
        return { url: null, error: tts.message };
      }

      const kind = item.table === "quiz_problems" ? "sentence" : "recording";
      uploadedPath = `${row.quiz_id}/${kind}_${row.problem_id}_${Date.now()}.mp3`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(uploadedPath, new Uint8Array(tts.audio), { contentType: "audio/mpeg", upsert: false });
      if (uploadError) {
        const msg = `업로드 실패: ${uploadError.message}`;
        await markFailure(admin, item, row, msg, force);
        return { url: null, error: msg };
      }
      url = admin.storage.from(BUCKET).getPublicUrl(uploadedPath).data.publicUrl as string;
    }

    // 저장 직전: 처리 중 문장(또는 정답)이 바뀌었으면 결과를 버린다.
    const current = await loadRow(admin, item.table, item.id);
    const currentQuiz = current ? await loadQuiz(admin, current.quiz_id) : null;
    const currentText = current && currentQuiz ? audioTextFor(item.table, current, currentQuiz) : null;
    const stillSame =
      !!currentText && "text" in currentText && (await md5Hex(currentText.text)) === textHash;

    let saved = false;
    if (stillSame && current) {
      let q = admin
        .from(item.table)
        .update({ sentence_audio_url: url, audio_text_hash: textHash, audio_error: null, audio_locked_until: null })
        .eq("id", item.id)
        .eq("sentence", current.sentence);
      if (!force) q = q.is("sentence_audio_url", null);
      const { data: updated, error: updateError } = await q.select("id");
      if (updateError) throw new Error(`저장 실패: ${updateError.message}`);
      saved = Array.isArray(updated) && updated.length > 0;
    }

    if (!saved) {
      if (uploadedPath) {
        await admin.storage.from(BUCKET).remove([uploadedPath]).catch(() => {});
      }
      if (force && current) {
        await admin.from(item.table).update({ audio_locked_until: null }).eq("id", item.id);
      }
      // 문장이 바뀌었다면 트리거가 이미 잠금·시도 횟수를 초기화했다(다음 차례에 새 문장으로 만든다).
      return { url: null, error: "처리 중 문장이 바뀌어 반영하지 않음" };
    }

    return { url, error: null };
  } catch (e) {
    const msg = errMsg(e);
    console.error(`process-audio ${item.table}/${item.id} 실패:`, msg);
    try {
      await markFailure(admin, item, row, msg, force);
    } catch {
      // 실패 기록도 안 되면 잠금 만료(3분) 후 다시 시도된다.
    }
    return { url: null, error: msg };
  }
}

// ─── claim 루프 (cron / quizId) ───────────────────────────────────────────────

async function runClaimLoop(admin: Admin, quizId: string | null): Promise<{ processed: number }> {
  const startedAt = Date.now();
  let active = 0;
  let processed = 0;

  // 각 작업자가 1행씩 점유한다 — 시작하지 못한 채 쥐고 있는 행이 생기지 않는다.
  // 녹음 행은 같은 문제의 빈칸 채우기 행이 끝날 때까지 claim에서 미뤄지므로,
  // 다른 작업자가 아직 일하는 중이면 빈 결과여도 잠깐 기다렸다가 다시 시도한다.
  const worker = async () => {
    while (Date.now() - startedAt < START_CUTOFF_MS) {
      const { data, error } = await admin.rpc("claim_audio_work", { _limit: 1, _quiz_id: quizId });
      if (error) {
        console.error("claim_audio_work 실패:", error.message);
        return;
      }
      const claimed = (data ?? []) as { tbl: AudioTable; id: string }[];
      if (claimed.length === 0) {
        if (active === 0) return;
        await sleep(IDLE_POLL_MS);
        continue;
      }
      active++;
      try {
        for (const c of claimed) {
          await processRow(admin, { table: c.tbl, id: c.id }, false);
          processed++;
        }
      } finally {
        active--;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`process-audio 완료: quiz=${quizId ?? "*"} processed=${processed} ms=${Date.now() - startedAt}`);
  return { processed };
}

// ─── 강제 재생성 (targets) ─────────────────────────────────────────────────────

async function runTargets(admin: Admin, targets: WorkItem[]): Promise<(WorkItem & RowResult)[]> {
  const startedAt = Date.now();
  const results: (WorkItem & RowResult)[] = targets.map((t) => ({ ...t, url: null, error: null }));
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= targets.length) return;
      if (Date.now() - startedAt >= START_CUTOFF_MS) {
        results[i].error = "시간 초과로 시작하지 못함 — 다시 시도해 주세요";
        continue;
      }
      const r = await processRow(admin, targets[i], true);
      results[i].url = r.url;
      results[i].error = r.error;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

// ─── 인증 ─────────────────────────────────────────────────────────────────────

async function authenticate(admin: Admin, req: Request): Promise<{ userId: string; isAdmin: boolean } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const userId = data.user.id as string;
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  return { userId, isAdmin: profile?.role === "admin" };
}

async function ownsAllQuizzes(admin: Admin, userId: string, quizIds: string[]): Promise<boolean> {
  const unique = [...new Set(quizIds)];
  if (unique.length === 0) return false;
  const { data, error } = await admin.from("quizzes").select("id, teacher_id").in("id", unique);
  if (error) throw new Error(`quizzes 조회 실패: ${error.message}`);
  const rows = (data ?? []) as { id: string; teacher_id: string }[];
  return rows.length === unique.length && rows.every((q) => q.teacher_id === userId);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── 진입점 ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "서버 설정 오류" }, 500);
  const admin: Admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    body = raw.trim() ? JSON.parse(raw) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "잘못된 요청" }, 400);
  } catch {
    return json({ error: "잘못된 JSON" }, 400);
  }

  try {
    // 3. 강제 재생성
    if (body.targets !== undefined) {
      const user = await authenticate(admin, req);
      if (!user) return json({ error: "인증이 필요합니다." }, 401);
      if (body.force !== true) return json({ error: "targets 요청에는 force: true가 필요합니다." }, 400);
      if (!Array.isArray(body.targets) || body.targets.length === 0) {
        return json({ error: "targets가 비어 있습니다." }, 400);
      }
      if (body.targets.length > MAX_TARGETS) return json({ error: `targets는 최대 ${MAX_TARGETS}개입니다.` }, 400);

      const targets: WorkItem[] = [];
      for (const t of body.targets as unknown[]) {
        const o = t as Record<string, unknown> | null;
        const table = o?.table;
        const id = o?.id;
        if ((table !== "quiz_problems" && table !== "recording_problems") || typeof id !== "string" || !UUID_RE.test(id)) {
          return json({ error: "targets 형식이 올바르지 않습니다." }, 400);
        }
        targets.push({ table, id });
      }

      // 대상 행들의 퀴즈가 모두 이 사용자 것인지(관리자는 통과)
      const quizIds: string[] = [];
      for (const table of ["quiz_problems", "recording_problems"] as const) {
        const ids = [...new Set(targets.filter((t) => t.table === table).map((t) => t.id))];
        if (ids.length === 0) continue;
        const { data, error } = await admin.from(table).select("id, quiz_id").in("id", ids);
        if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
        const rows = (data ?? []) as { id: string; quiz_id: string }[];
        if (rows.length !== ids.length) return json({ error: "존재하지 않는 대상이 있습니다." }, 404);
        quizIds.push(...rows.map((r) => r.quiz_id));
      }
      if (!user.isAdmin && !(await ownsAllQuizzes(admin, user.userId, quizIds))) {
        return json({ error: "권한이 없습니다." }, 403);
      }

      const results = await runTargets(admin, targets);
      return json({ results });
    }

    // 2. 퀴즈 하나 시작 신호
    if (body.quizId !== undefined) {
      const quizId = body.quizId;
      if (typeof quizId !== "string" || !UUID_RE.test(quizId)) return json({ error: "quizId가 올바르지 않습니다." }, 400);
      // 운영 점검용: 올바른 x-cron-secret이 있으면 사용자 JWT 없이도 허용(DEPLOY.md ⑤).
      if (!hasValidCronSecret(req)) {
        const user = await authenticate(admin, req);
        if (!user) return json({ error: "인증이 필요합니다." }, 401);
        if (!user.isAdmin && !(await ownsAllQuizzes(admin, user.userId, [quizId]))) {
          return json({ error: "권한이 없습니다." }, 403);
        }
      }
      runInBackground(runClaimLoop(admin, quizId));
      return json({ accepted: true });
    }

    // 1. cron
    if (!hasValidCronSecret(req)) return json({ error: "인증이 필요합니다." }, 401);
    runInBackground(runClaimLoop(admin, null));
    return json({ accepted: true }, 202);
  } catch (e) {
    console.error("process-audio 오류:", errMsg(e));
    return json({ error: "서버 오류" }, 500);
  }
});
