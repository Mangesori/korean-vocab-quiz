import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit2, Save, Loader2, Plus, Eye } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SentenceMakingStudentView } from "@/components/quiz/shared/SentenceMakingStudentView";
import { WordMeaningEditCard } from "@/components/quiz/shared/WordMeaningEditCard";

export interface SentenceMakingProblem {
  id: string;
  quiz_id: string;
  problem_id: string;
  word: string;
  word_meaning: string | null;
  model_answer: string;
  created_at: string;
  sort_order: number;
}

// 드래그로 순서를 바꿀 수 있는 카드 래퍼 — 편집 모드에서만 사용.
function SortableWordMeaningCard({ id, children }: { id: string; children: (dragHandleProps: { attributes: any; listeners: any }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

interface SentenceMakingProblemListProps {
  problems: SentenceMakingProblem[];
  onRefresh: () => void;
  studentPreview?: boolean;
  onToggleStudentPreview?: (v: boolean) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onSaveAll: () => void | Promise<void>;
  registerSaver: (fn: (() => Promise<void>) | null) => void;
}

export function SentenceMakingProblemList({
  problems,
  onRefresh,
  studentPreview,
  onToggleStudentPreview,
  isEditing,
  setIsEditing,
  onSaveAll,
  registerSaver,
}: SentenceMakingProblemListProps) {
  const [editedProblems, setEditedProblems] = useState<SentenceMakingProblem[]>(problems);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  const handleUpdateProblem = (id: string, field: keyof SentenceMakingProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleAddProblem = () => {
    const newId = `temp-${crypto.randomUUID()}`;
    setEditedProblems(prev => {
      const newProblem: SentenceMakingProblem = {
        id: newId,
        quiz_id: quizId || '',
        problem_id: `sm-${crypto.randomUUID().slice(0, 8)}`,
        word: '',
        word_meaning: '',
        model_answer: '',
        created_at: new Date().toISOString(),
        sort_order: prev.length,
      };
      return [...prev, newProblem];
    });
    if (!isEditing) setIsEditing(true);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setEditedProblems((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((p, idx) => ({ ...p, sort_order: idx }));
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        editedProblems.map((problem) => {
          if (problem.id.startsWith('temp-')) {
            return supabase.from("sentence_making_problems" as any).insert({
              quiz_id: problem.quiz_id,
              problem_id: problem.problem_id,
              word: problem.word,
              word_meaning: problem.word_meaning || null,
              model_answer: problem.model_answer,
              sort_order: problem.sort_order,
            });
          } else {
            return supabase
              .from("sentence_making_problems" as any)
              .update({
                word: problem.word,
                word_meaning: problem.word_meaning || null,
                model_answer: problem.model_answer,
                sort_order: problem.sort_order,
              })
              .eq("id", problem.id);
          }
        })
      );

      toast.success("전체 문제가 저장되었습니다");
      onRefresh();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "전체 저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  // 전체 저장(save-all)용: 변경된 경우에만 자기 자신을 저장하는 함수를 부모에 등록
  const saveSelfIfDirty = useCallback(async () => {
    if (JSON.stringify(editedProblems) === JSON.stringify(problems)) return;
    await handleSaveAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedProblems, problems]);
  useEffect(() => {
    registerSaver(saveSelfIfDirty);
    return () => registerSaver(null);
  }, [registerSaver, saveSelfIfDirty]);

  const handleDelete = async (problemId: string) => {
    if (!confirm("이 문제를 삭제하시겠습니까?")) return;

    setDeletingId(problemId);
    setEditedProblems(prev => prev.filter(p => p.id !== problemId));

    try {
      if (!problemId.startsWith("temp-")) {
        const { error } = await supabase
          .from("sentence_making_problems")
          .delete()
          .eq("id", problemId);

        if (error) throw error;
        onRefresh();
      }

      toast.success("문제가 삭제되었습니다");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "삭제에 실패했습니다");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleRow = onToggleStudentPreview && (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-sm text-muted-foreground flex items-center gap-1">
        <Eye className="w-4 h-4" /> 학생 화면
      </span>
      <Switch checked={!!studentPreview} onCheckedChange={onToggleStudentPreview} />
    </div>
  );

  if (problems.length === 0 && editedProblems.length === 0) {
    return (
      <div className="space-y-4">
        {toggleRow && <div className="flex justify-start">{toggleRow}</div>}
        <div className="text-center py-12 text-muted-foreground">
          문장 만들기 문제가 없습니다.
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={handleAddProblem}
            >
              <Plus className="w-4 h-4 mr-2" />
              단어 추가하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">문제 목록</h2>
          </div>
          {toggleRow}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (!isEditing) onToggleStudentPreview?.(false);
              setIsEditing(!isEditing);
            }}
            className="w-full sm:w-auto"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            <span>{isEditing ? "수정 취소" : "수정하기"}</span>
          </Button>
          <Button
            onClick={onSaveAll}
            disabled={isSaving || !isEditing}
            size="sm"
            className="w-full sm:w-auto"
            variant="default"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            <span>저장하기</span>
          </Button>
        </div>
      </div>

      {/* 학생 화면 미리보기 */}
      {studentPreview && problems.length > 0 ? (
        <SentenceMakingStudentView problems={problems} />
      ) : !studentPreview && (
        <>
          {isEditing ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={editedProblems.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {editedProblems.map((problem, index) => (
                    <SortableWordMeaningCard key={problem.id} id={problem.id}>
                      {(dragHandleProps) => (
                        <WordMeaningEditCard
                          index={index}
                          word={problem.word}
                          meaning={problem.word_meaning || ""}
                          editable={isEditing}
                          onChangeWord={(v) => handleUpdateProblem(problem.id, "word", v)}
                          onChangeMeaning={(v) => handleUpdateProblem(problem.id, "word_meaning", v)}
                          onDelete={() => handleDelete(problem.id)}
                          deleting={deletingId === problem.id}
                          dragHandleProps={dragHandleProps}
                        />
                      )}
                    </SortableWordMeaningCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {editedProblems.map((problem, index) => (
                <WordMeaningEditCard
                  key={problem.id}
                  index={index}
                  word={problem.word}
                  meaning={problem.word_meaning || ""}
                  editable={isEditing}
                  onChangeWord={(v) => handleUpdateProblem(problem.id, "word", v)}
                  onChangeMeaning={(v) => handleUpdateProblem(problem.id, "word_meaning", v)}
                  onDelete={() => handleDelete(problem.id)}
                  deleting={deletingId === problem.id}
                />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={handleAddProblem}
            >
              <Plus className="w-4 h-4 mr-2" />
              단어 추가하기
            </Button>
          </div>

          {isEditing && (
            <div className="mt-4 flex justify-center">
              <Button onClick={onSaveAll} disabled={isSaving} size="lg">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                저장하기
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
