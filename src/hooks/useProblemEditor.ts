
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Problem, Quiz } from "./useQuizData";

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

      onSaveSuccess(editedProblems);
      setIsEditing(false);
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
    isSaving,
    isEditing,
    setIsEditing,
    updateProblem,
    updateProblemObject,
    saveChanges,
    cancelEdit
  };
}
