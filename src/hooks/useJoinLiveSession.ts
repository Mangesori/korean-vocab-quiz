import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveParticipant } from "@/types/liveSession";

export type FoundSession = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  status: string;
  allow_guests: boolean;
};

/**
 * 학생 쪽: 6자리 코드로 세션을 찾아 입장한다.
 *
 * 로그인 학생은 student_id가 붙어 결과가 계정에 남고, 비회원은 이름만으로
 * 들어온다 (세션이 allowGuests를 켰을 때만).
 */
export function useJoinLiveSession() {
  const [found, setFound] = useState<FoundSession | null>(null);
  const [participant, setParticipant] = useState<LiveParticipant | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 코드로 세션 찾기 — 아직 입장하지는 않는다. */
  const lookup = useCallback(async (code: string) => {
    setError(null);
    setIsBusy(true);

    const { data, error: e } = await supabase.rpc("find_live_session_by_code", {
      p_code: code,
    });

    setIsBusy(false);

    if (e) {
      setError(e.message);
      return null;
    }

    const row = (data as FoundSession[] | null)?.[0] ?? null;
    if (!row) {
      setError("코드를 다시 확인해주세요.");
      return null;
    }

    setFound(row);
    return row;
  }, []);

  /** 실제 입장. displayName은 비회원일 때만 쓰인다. */
  const join = useCallback(
    async (session: FoundSession, displayName: string) => {
      setError(null);
      setIsBusy(true);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      if (!userId && !session.allow_guests) {
        setIsBusy(false);
        setError("이 수업은 로그인한 학생만 참여할 수 있어요.");
        return null;
      }

      const { data, error: e } = await supabase
        .from("live_participants")
        .upsert(
          {
            session_id: session.id,
            student_id: userId,
            display_name: displayName,
            is_guest: !userId,
            left_at: null,
          },
          { onConflict: "session_id,student_id", ignoreDuplicates: false }
        )
        .select()
        .single();

      setIsBusy(false);

      if (e) {
        setError(e.message);
        return null;
      }

      const p = data as unknown as LiveParticipant;
      setParticipant(p);
      return p;
    },
    []
  );

  const leave = useCallback(async () => {
    if (!participant) return;
    await supabase
      .from("live_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("id", participant.id);
    setParticipant(null);
  }, [participant]);

  return { found, participant, isBusy, error, lookup, join, leave };
}
