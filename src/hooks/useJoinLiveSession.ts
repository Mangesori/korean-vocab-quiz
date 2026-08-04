import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveParticipant } from "@/types/liveSession";

/**
 * 학생에게 보여줄 문구로 바꾼다. 원시 에러(TypeError: Failed to fetch 같은)를
 * 그대로 노출하면 학생이 뭘 해야 할지 알 수 없다.
 * 서버가 의도적으로 던진 메시지(한글)는 그대로 쓴다.
 */
function friendlyError(e: { message?: string } | null): string {
  const raw = e?.message ?? "";
  if (/[가-힣]/.test(raw)) return raw;
  if (/fetch|network|timeout|failed to fetch/i.test(raw))
    return "연결이 불안정해요. 인터넷을 확인하고 다시 시도해주세요.";
  if (/does not exist|schema cache|PGRST/i.test(raw))
    return "지금은 참여할 수 없어요. 선생님께 알려주세요.";
  return "참여하지 못했어요. 잠시 후 다시 시도해주세요.";
}

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
  // 게스트 입장 함수가 코드를 다시 요구하므로 조회에 쓴 코드를 들고 있는다.
  const [code, setCode] = useState("");

  /** 코드로 세션 찾기 — 아직 입장하지는 않는다. */
  const lookup = useCallback(async (inputCode: string) => {
    setError(null);
    setIsBusy(true);

    const { data, error: e } = await supabase.rpc("find_live_session_by_code", {
      p_code: inputCode,
    });

    setIsBusy(false);

    if (e) {
      setError(friendlyError(e));
      return null;
    }

    const row = (data as FoundSession[] | null)?.[0] ?? null;
    if (!row) {
      setError("코드를 다시 확인해주세요.");
      return null;
    }

    setCode(inputCode);
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

      // 비회원은 auth.uid()가 없어 INSERT 정책을 통과하지 못한다. 코드·allowGuests
      // 확인까지 서버에서 하는 전용 함수로 들어간다.
      if (!userId) {
        if (!session.allow_guests) {
          setIsBusy(false);
          setError("이 수업은 로그인한 학생만 참여할 수 있어요.");
          return null;
        }

        const { data, error: e } = await supabase.rpc("join_live_session_as_guest", {
          p_code: code,
          p_name: displayName,
        });

        setIsBusy(false);

        if (e) {
          setError(friendlyError(e));
          return null;
        }

        const p = data as unknown as LiveParticipant;
        setParticipant(p);
        return p;
      }

      const { data, error: e } = await supabase
        .from("live_participants")
        .upsert(
          {
            session_id: session.id,
            student_id: userId,
            display_name: displayName,
            is_guest: false,
            left_at: null,
          },
          { onConflict: "session_id,student_id", ignoreDuplicates: false }
        )
        .select()
        .single();

      setIsBusy(false);

      if (e) {
        setError(friendlyError(e));
        return null;
      }

      const p = data as unknown as LiveParticipant;
      setParticipant(p);
      return p;
    },
    [code]
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
