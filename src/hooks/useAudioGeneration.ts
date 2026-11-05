
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Problem } from "./useQuizData";
import { regenerateAudio } from "@/lib/audio/processAudio";

const CHUNK = 30;

export function useAudioGeneration(quizId: string | undefined) {
  const queryClient = useQueryClient();
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [regeneratingProblemId, setRegeneratingProblemId] = useState<string | null>(null);

  /**
   * quiz_problems 행을 현재 문장으로 맞추고 행 id를 돌려준다.
   * 빈칸 채우기 편집은 quizzes.problems(JSON)만 고치므로, 서버가 옛 문장으로
   * 음성을 만들지 않게 하려면 먼저 행 문장을 맞춰야 한다. 음성 URL은 건드리지 않는다.
   */
  const syncRows = async (problems: Problem[]): Promise<Map<string, string>> => {
    const ids = new Map<string, string>();
    if (!quizId || problems.length === 0) return ids;
    const { data, error } = await supabase
      .from("quiz_problems")
      .upsert(
        problems.map((p) => ({
          quiz_id: quizId,
          problem_id: p.id,
          word: p.word,
          sentence: p.sentence,
          hint: p.hint,
          translation: p.translation,
        })),
        { onConflict: "quiz_id,problem_id" },
      )
      .select("id, problem_id");
    if (error) throw error;
    (data ?? []).forEach((r) => ids.set(r.problem_id, r.id));
    return ids;
  };

  const regenerate = async (
    problems: Problem[],
    onAudioGenerated: (problemId: string, url: string) => void,
    onChunkDone?: (done: number) => void,
  ): Promise<{ ok: number; failed: number }> => {
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < problems.length; i += CHUNK) {
      const chunk = problems.slice(i, i + CHUNK);
      const rowIds = await syncRows(chunk);
      const problemIdByRow = new Map([...rowIds].map(([pid, rid]) => [rid, pid]));
      const results = await regenerateAudio([...rowIds.values()].map((id) => ({ table: "quiz_problems" as const, id })));
      for (const r of results) {
        const pid = problemIdByRow.get(r.id);
        if (r.url && pid) {
          ok++;
          onAudioGenerated(pid, r.url);
        } else {
          failed++;
        }
      }
      onChunkDone?.(Math.min(i + CHUNK, problems.length));
    }
    queryClient.invalidateQueries({ queryKey: ["quizAudio", quizId] });
    queryClient.invalidateQueries({ queryKey: ["audioStatus", quizId] });
    return { ok, failed };
  };

  const regenerateAllAudio = async (
    problems: Problem[],
    onAudioGenerated: (problemId: string, url: string) => void,
  ) => {
    if (!quizId) return;

    setIsGeneratingAudio(true);
    setAudioProgress({ current: 0, total: problems.length });

    try {
      const { failed } = await regenerate(problems, onAudioGenerated, (done) =>
        setAudioProgress({ current: done, total: problems.length }),
      );
      if (failed > 0) toast.error(`음성 ${failed}개를 만들지 못했어요`);
      else toast.success("음성 생성이 완료되었습니다!");
    } catch (error) {
      console.error("Audio generation error:", error);
      toast.error("음성 생성에 실패했습니다");
    } finally {
      setIsGeneratingAudio(false);
      setAudioProgress({ current: 0, total: 0 });
    }
  };

  const regenerateSingleAudio = async (
    problem: Problem,
    onAudioGenerated: (problemId: string, url: string) => void,
  ) => {
    if (!quizId) return;

    setRegeneratingProblemId(problem.id);

    try {
      const { ok } = await regenerate([problem], onAudioGenerated);
      if (ok > 0) toast.success(`"${problem.word}" 문제의 음성이 재생성되었습니다`);
      else toast.error("음성 재생성에 실패했습니다");
    } catch (error) {
      console.error("Single audio generation error:", error);
      toast.error("음성 재생성에 실패했습니다");
    } finally {
      setRegeneratingProblemId(null);
    }
  };

  const playAudio = (url: string | undefined) => {
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  return {
    isGeneratingAudio,
    audioProgress,
    regeneratingProblemId,
    regenerateAllAudio,
    regenerateSingleAudio,
    playAudio
  };
}
