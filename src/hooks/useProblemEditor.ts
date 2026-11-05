
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Problem, Quiz } from "./useQuizData";
import { startAudioProcessing } from "@/lib/audio/processAudio";

export function useProblemEditor(
  initialProblems: Problem[],
  quizId: string | undefined,
  onSaveSuccess: (updatedProblems: Problem[]) => void
) {
  const [editedProblems, setEditedProblems] = useState<Problem[]>(initialProblems);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Compute hasChanges by deep comparison
  const hasChanges = useMemo(() => {
    return JSON.stringify(initialProblems) !== JSON.stringify(editedProblems);
  }, [initialProblems, editedProblems]);

  // 실제로 고쳐진(또는 새로 추가된) 문제 개수 — 저장 안내 바에 노출
  const changedProblemCount = useMemo(() => {
    const initialById = new Map(initialProblems.map((p) => [p.id, p]));
    let count = 0;
    for (const p of editedProblems) {
      const orig = initialById.get(p.id);
      if (!orig || JSON.stringify(orig) !== JSON.stringify(p)) count++;
    }
    return count;
  }, [initialProblems, editedProblems]);
  
  // Update local state when initialProblems change (e.g. after fetch)
  // Only update if not currently editing
  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(initialProblems);
    }
  }, [initialProblems, isEditing]);

  const cancelEdit = () => {
    setEditedProblems(initialProblems);
    setIsEditing(false);
  };

  const updateProblem = (problemId: string, field: keyof Problem, value: string) => {
    const updated = editedProblems.map((p) => (p.id === problemId ? { ...p, [field]: value } : p));
    setEditedProblems(updated);
  };

  const updateProblemObject = (problem: Problem) => {
    const updated = editedProblems.map((p) => (p.id === problem.id ? problem : p));
    setEditedProblems(updated);
  };

  const saveChanges = async () => {
    if (!quizId) return;

    setIsSaving(true);

    try {
      const updatedWords = editedProblems.map(p => p.word);

      const { error } = await supabase
        .from("quizzes")
        .update({ problems: editedProblems as any, words: updatedWords })
        .eq("id", quizId);

      if (error) throw error;

      // 새로 추가된 문제 (initialProblems에 없는 것) → quiz_problems, quiz_answers 동기화
      const initialIds = new Set(initialProblems.map(p => p.id));
      const newProblems = editedProblems.filter(p => !initialIds.has(p.id));

      if (newProblems.length > 0) {
        await Promise.all([
          supabase.from("quiz_problems").insert(
            newProblems.map(p => ({
              quiz_id: quizId,
              problem_id: p.id,
              word: p.word,
              sentence: p.sentence,
              hint: p.hint,
              translation: p.translation,
            }))
          ),
          supabase.from("quiz_answers").insert(
            newProblems.map(p => ({
              quiz_id: quizId,
              problem_id: p.id,
              correct_answer: p.answer,
              word: p.word,
            }))
          ),
        ]);
      }

      // 기존 문제의 문장이 바뀌었으면 quiz_problems 행도 맞춘다. sentence_audio_url은
      // 넣지 않는다 — 문장이 바뀌면 서버 트리거가 음성을 비우고 다시 만든다.
      const initialById = new Map(initialProblems.map((p) => [p.id, p]));
      const changedExisting = editedProblems.filter((p) => {
        const orig = initialById.get(p.id);
        return !!orig && (orig.word !== p.word || orig.sentence !== p.sentence || orig.hint !== p.hint || orig.translation !== p.translation);
      });
      if (changedExisting.length > 0) {
        const results = await Promise.all(
          changedExisting.map((p) =>
            supabase
              .from("quiz_problems")
              .update({ word: p.word, sentence: p.sentence, hint: p.hint, translation: p.translation })
              .eq("quiz_id", quizId)
              .eq("problem_id", p.id),
          ),
        );
        results.forEach(({ error: rowError }) => {
          if (rowError) console.error("Failed to sync quiz_problems row:", rowError);
        });
      }

      startAudioProcessing(quizId);
      onSaveSuccess(editedProblems);
      toast.success("변경사항이 저장되었습니다");
    } catch (error: any) {
      console.error("Save error details:", error);
      toast.error(`저장에 실패했습니다: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    editedProblems,
    setEditedProblems,
    hasChanges,
    changedProblemCount,
    isSaving,
    isEditing,
    setIsEditing,
    updateProblem,
    updateProblemObject,
    saveChanges,
    cancelEdit
  };
}
