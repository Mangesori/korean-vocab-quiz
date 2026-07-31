import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  LIVE_EVENT,
  liveChannel,
  type LiveControl,
  type LiveProgress,
} from "@/types/liveSession";

/** 진행 상황을 너무 자주 보내지 않도록 하는 최소 간격 (ms) */
const SEND_INTERVAL = 250;

/**
 * 풀이 중 진행 상황을 주고받는 채널.
 *
 * DB를 거치지 않고 Realtime broadcast만 쓴다. 타이핑 한 글자마다 행이 쌓이면
 * 감당이 안 되고, 애초에 수업이 끝나면 필요 없는 데이터다. 최종 결과는
 * 기존 quiz_results에 따로 저장된다.
 */
export function useLiveProgress(sessionId: string | undefined, role: "teacher" | "student") {
  /** 학생별 최신 상태 (선생님 화면에서 사용) */
  const [progress, setProgress] = useState<Record<string, LiveProgress>>({});
  /** 선생님이 보낸 제어 신호 (학생 화면에서 사용) */
  const [control, setControl] = useState<LiveControl | null>(null);
  /** 선생님이 화면을 쏘고 있는지 */
  const [casting, setCasting] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentAt = useRef(0);
  const pending = useRef<LiveProgress | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(liveChannel(sessionId), {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: LIVE_EVENT.progress }, ({ payload }) => {
        const p = payload as LiveProgress;
        setProgress((prev) => {
          // 순서가 뒤집혀 도착한 패킷은 버린다
          const cur = prev[p.participantId];
          if (cur && cur.at > p.at) return prev;
          return { ...prev, [p.participantId]: p };
        });
      })
      .on("broadcast", { event: LIVE_EVENT.control }, ({ payload }) => {
        setControl(payload as LiveControl);
      })
      .on("broadcast", { event: LIVE_EVENT.cast }, ({ payload }) => {
        setCasting(Boolean((payload as { on: boolean }).on));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  // ── 학생 → 전체: 진행 상황 ──
  // 타이핑마다 호출해도 되도록 최소 간격으로 묶어서 보낸다.
  const sendProgress = useCallback((p: Omit<LiveProgress, "at">) => {
    if (!channelRef.current) return;

    const payload: LiveProgress = { ...p, at: Date.now() };
    const now = Date.now();
    const wait = SEND_INTERVAL - (now - lastSentAt.current);

    if (wait <= 0) {
      lastSentAt.current = now;
      channelRef.current.send({
        type: "broadcast",
        event: LIVE_EVENT.progress,
        payload,
      });
      return;
    }

    // 간격이 안 찼으면 마지막 값만 남겨뒀다가 한 번에 보낸다
    const first = pending.current === null;
    pending.current = payload;
    if (first) {
      setTimeout(() => {
        const queued = pending.current;
        pending.current = null;
        if (queued && channelRef.current) {
          lastSentAt.current = Date.now();
          channelRef.current.send({
            type: "broadcast",
            event: LIVE_EVENT.progress,
            payload: queued,
          });
        }
      }, wait);
    }
  }, []);

  // ── 선생님 → 전체 ──
  const sendControl = useCallback(
    (c: LiveControl) => {
      if (role !== "teacher" || !channelRef.current) return;
      channelRef.current.send({ type: "broadcast", event: LIVE_EVENT.control, payload: c });
    },
    [role]
  );

  const sendCast = useCallback(
    (on: boolean) => {
      if (role !== "teacher" || !channelRef.current) return;
      setCasting(on);
      channelRef.current.send({ type: "broadcast", event: LIVE_EVENT.cast, payload: { on } });
    },
    [role]
  );

  return { progress, control, casting, sendProgress, sendControl, sendCast };
}
