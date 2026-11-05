import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AUDIO_PROCESSING_STARTED_EVENT,
  fetchAudioStatus,
  fetchFailedAudioTargets,
  regenerateAudio,
} from "@/lib/audio/processAudio";

interface AudioStatusBadgeProps {
  quizId: string;
  className?: string;
}

/** 서버 음성 생성 진행 상황. 만들 게 남았거나 실패한 게 있을 때만 보인다. */
export function AudioStatusBadge({ quizId, className }: AudioStatusBadgeProps) {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const { data: status, refetch } = useQuery({
    queryKey: ["audioStatus", quizId],
    queryFn: () => fetchAudioStatus(quizId),
    enabled: !!quizId,
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 5000 : false),
  });

  // 다른 곳에서 시작 신호를 보내면 바로 다시 조회해 폴링을 시작한다.
  useEffect(() => {
    const onStarted = (e: Event) => {
      const id = (e as CustomEvent<{ quizId?: string }>).detail?.quizId;
      if (!id || id === quizId) void refetch();
    };
    window.addEventListener(AUDIO_PROCESSING_STARTED_EVENT, onStarted);
    return () => window.removeEventListener(AUDIO_PROCESSING_STARTED_EVENT, onStarted);
  }, [quizId, refetch]);

  // 대기 중이던 음성이 다 만들어지면 음성 URL을 쓰는 화면들을 새로 불러온다.
  const prevPending = useRef<number | null>(null);
  const pending = status?.pending ?? 0;
  useEffect(() => {
    if (prevPending.current !== null && prevPending.current > 0 && pending === 0) {
      queryClient.invalidateQueries({ queryKey: ["quizAudio", quizId] });
      queryClient.invalidateQueries({ queryKey: ["recordingProblems", quizId] });
    }
    prevPending.current = pending;
  }, [pending, quizId, queryClient]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const targets = await fetchFailedAudioTargets(quizId);
      if (targets.length === 0) {
        await refetch();
        return;
      }
      const results = await regenerateAudio(targets);
      const failed = results.filter((r) => !r.url).length;
      if (failed > 0) toast.error(`음성 ${failed}개를 아직 만들지 못했어요`);
      else toast.success("음성을 모두 만들었어요");
      queryClient.invalidateQueries({ queryKey: ["quizAudio", quizId] });
      queryClient.invalidateQueries({ queryKey: ["recordingProblems", quizId] });
      await refetch();
    } catch (e) {
      console.error("Audio retry error:", e);
      toast.error("음성 다시 만들기에 실패했어요");
    } finally {
      setRetrying(false);
    }
  };

  if (!status || (status.pending === 0 && status.failed === 0)) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {status.pending > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          음성 만드는 중 {status.ready}/{status.total}
        </span>
      )}
      {status.failed > 0 && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEFE9] px-3 py-1 text-xs font-medium text-[#B4552D] transition-colors hover:bg-[#F5E0D5] disabled:opacity-60"
        >
          {retrying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          음성 {status.failed}개를 만들지 못했어요 ·
          <span className="inline-flex items-center gap-0.5 underline underline-offset-2">
            {!retrying && <RotateCw className="h-3 w-3" />}
            다시 시도
          </span>
        </button>
      )}
    </div>
  );
}
