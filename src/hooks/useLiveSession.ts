import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BaseStage } from "@/types/quiz";
import {
  DEFAULT_LIVE_SETTINGS,
  type LiveParticipant,
  type LiveSession,
  type LiveSessionSettings,
} from "@/types/liveSession";

/**
 * 선생님 쪽: 라이브 세션을 열고, 참가자를 지켜보고, 시작/종료한다.
 *
 * 진행 상황(타이핑)은 여기서 다루지 않는다 — useLiveProgress를 쓴다.
 * 이 훅은 DB에 남는 것(세션 상태, 참가자 명단)만 담당한다.
 */
export function useLiveSession(sessionId?: string) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  // ── 세션 열기 ──
  const createSession = useCallback(
    async (opts: {
      quizId: string;
      classId?: string | null;
      stages: BaseStage[];
      settings?: Partial<LiveSessionSettings>;
    }) => {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData.user?.id;
      if (!teacherId) {
        setError("로그인이 필요합니다.");
        return null;
      }

      const { data: code, error: codeError } = await supabase.rpc("generate_live_join_code");
      if (codeError || !code) {
        setError(codeError?.message ?? "참여 코드를 만들지 못했습니다.");
        return null;
      }

      const { data, error: insertError } = await supabase
        .from("live_sessions")
        .insert({
          quiz_id: opts.quizId,
          teacher_id: teacherId,
          class_id: opts.classId ?? null,
          join_code: code as string,
          stages: opts.stages,
          settings: { ...DEFAULT_LIVE_SETTINGS, ...opts.settings },
          status: "waiting",
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      const created = data as unknown as LiveSession;
      setSession(created);
      return created;
    },
    []
  );

  // ── 상태 전환 ──
  const startSession = useCallback(async () => {
    if (!session) return;
    const { error: e } = await supabase
      .from("live_sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", session.id);
    if (e) setError(e.message);
  }, [session]);

  const endSession = useCallback(async () => {
    if (!session) return;
    const { error: e } = await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    if (e) setError(e.message);
  }, [session]);

  // ── 불러오기 ──
  const id = sessionId ?? session?.id;

  const fetchAll = useCallback(async (sid: string) => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("live_sessions").select("*").eq("id", sid).maybeSingle(),
      supabase
        .from("live_participants")
        .select("*")
        .eq("session_id", sid)
        .is("left_at", null)
        .order("joined_at"),
    ]);
    if (s) setSession(s as unknown as LiveSession);
    setParticipants((p ?? []) as unknown as LiveParticipant[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchAll(id);
  }, [id, fetchAll]);

  // ── 실시간: 참가자 입장/퇴장, 세션 상태 변화 ──
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`live_session_db:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_participants",
          filter: `session_id=eq.${id}`,
        },
        () => fetchAll(id)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${id}` },
        (payload) => setSession(payload.new as unknown as LiveSession)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchAll]);

  return {
    session,
    participants,
    isLoading,
    error,
    createSession,
    startSession,
    endSession,
    refresh: () => id && fetchAll(id),
  };
}
