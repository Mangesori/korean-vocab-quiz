import { supabase } from "@/integrations/supabase/client";

export type AudioTable = "quiz_problems" | "recording_problems";

export interface AudioTarget {
  table: AudioTable;
  id: string;
}

export interface AudioResult extends AudioTarget {
  url: string | null;
  error: string | null;
}

export interface AudioStatus {
  total: number;
  ready: number;
  pending: number;
  failed: number;
}

/** 서버가 이 횟수만큼 실패하면 더 이상 자동 재시도하지 않는다(서버 계약). */
export const AUDIO_MAX_ATTEMPTS = 5;
const MAX_TARGETS_PER_CALL = 30;
/** 시작 신호를 보냈음을 진행 배지에 알리는 window 이벤트 */
export const AUDIO_PROCESSING_STARTED_EVENT = "audio-processing-started";

/**
 * 퀴즈 음성 만들기 시작 신호. 기다리지 않고 실패도 무시한다 —
 * 서버의 1분 주기 작업이 남은 음성을 어차피 처리한다.
 */
export function startAudioProcessing(quizId: string | null | undefined): void {
  if (!quizId) return;
  const notify = () =>
    window.dispatchEvent(new CustomEvent(AUDIO_PROCESSING_STARTED_EVENT, { detail: { quizId } }));
  supabase.functions
    .invoke("process-audio", { body: { quizId } })
    .then(({ error }) => {
      if (error) console.warn("process-audio 시작 신호 실패(주기 작업이 처리함):", error);
      notify();
    })
    .catch((e) => console.warn("process-audio 시작 신호 실패(주기 작업이 처리함):", e));
}

/** 지정한 행들의 음성을 강제로 다시 만들고 결과를 기다린다(30개씩 나눠 호출). */
export async function regenerateAudio(targets: AudioTarget[]): Promise<AudioResult[]> {
  const results: AudioResult[] = [];
  for (let i = 0; i < targets.length; i += MAX_TARGETS_PER_CALL) {
    const chunk = targets.slice(i, i + MAX_TARGETS_PER_CALL);
    const { data, error } = await supabase.functions.invoke<{ results?: AudioResult[] }>("process-audio", {
      body: { targets: chunk, force: true },
    });
    if (error || !data?.results) {
      const message = error instanceof Error ? error.message : "음성 생성 요청 실패";
      results.push(...chunk.map((t) => ({ ...t, url: null, error: message })));
      continue;
    }
    results.push(...data.results);
  }
  return results;
}

// TODO(types): types.ts 재생성 후 아래 단언들은 정식 타입으로 교체.
type AudioStatusRpc = (
  fn: "audio_status",
  args: { _quiz_id: string },
) => PromiseLike<{ data: AudioStatus | AudioStatus[] | null; error: unknown }>;

export async function fetchAudioStatus(quizId: string): Promise<AudioStatus | null> {
  const rpc = supabase.rpc.bind(supabase) as unknown as AudioStatusRpc;
  const { data, error } = await rpc("audio_status", { _quiz_id: quizId });
  if (error || !data) return null;
  // RETURNS TABLE이면 배열, jsonb면 객체로 온다 — 둘 다 받는다.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    total: Number(row.total) || 0,
    ready: Number(row.ready) || 0,
    pending: Number(row.pending) || 0,
    failed: Number(row.failed) || 0,
  };
}

/** 서버가 포기한(재시도 한도 초과) 행들 */
export async function fetchFailedAudioTargets(quizId: string): Promise<AudioTarget[]> {
  const [qp, rp] = await Promise.all([
    supabase
      .from("quiz_problems")
      .select("id")
      .eq("quiz_id", quizId)
      .is("sentence_audio_url", null)
      .gte("audio_attempts", AUDIO_MAX_ATTEMPTS),
    supabase
      .from("recording_problems")
      .select("id")
      .eq("quiz_id", quizId)
      .is("sentence_audio_url", null)
      .gte("audio_attempts", AUDIO_MAX_ATTEMPTS),
  ]);
  return [
    ...(qp.data ?? []).map((r) => ({ table: "quiz_problems" as const, id: r.id })),
    ...(rp.data ?? []).map((r) => ({ table: "recording_problems" as const, id: r.id })),
  ];
}

export async function saveQuizTtsProvider(quizId: string, provider: "elevenlabs" | "azure"): Promise<boolean> {
  const { error } = await supabase
    .from("quizzes")
    .update({ tts_provider: provider } as unknown as { title?: string })
    .eq("id", quizId);
  if (error) console.error("tts_provider 저장 실패:", error);
  return !error;
}
