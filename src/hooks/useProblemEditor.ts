
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
      // Cast needed because Supabase types might imply a stricter JSON structure than we check here
      const { error } = await supabase
        .from("quizzes")
        .update({ problems: editedProblems as any })
        .eq("id", quizId);

      if (error) throw error;

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
