import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit2, Save, Loader2, Plus, Eye, Info, RefreshCw } from "lucide-react";
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
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseSentenceToItems } from "@/lib/korean/wordMagnet";
import { segmentSentences } from "@/lib/korean/segment";
import { WordMagnetStudentView } from "@/components/quiz/shared/WordMagnetStudentView";
import { WordMagnetEditCard } from "@/components/quiz/shared/WordMagnetEditCard";
import { isShortSentenceLevel } from "@/lib/quiz";

export interface WordMagnetProblem {
  id: string;
  quiz_id: string;
  problem_id: string;
  base_text: string;
  translation: string | null;
  items: Array<{ content: string; isParticle: boolean }>;
  created_at: string;
  sort_order: number;
}

// 드래그로 순서를 바꿀 수 있는 카드 래퍼 — 편집 모드에서만 사용.
function SortableWordMagnetCard({ id, children }: { id: string; children: (dragHandleProps: { attributes: any; listeners: any }) => ReactNode }) {
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

interface WordMagnetProblemListProps {
  problems: WordMagnetProblem[];
  onRefresh: () => void;
  studentPreview?: boolean;
  onToggleStudentPreview?: (v: boolean) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onSaveAll: () => void | Promise<void>;
  registerSaver: (fn: (() => Promise<void>) | null) => void;
  /** problem_id → 출처 단어(빈칸 문제). 헤더 읽기전용 라벨용 + 문제 재생성 시 사용. */
  sourceWords?: Record<string, string>;
  /** 문제 재생성(AI 호출)에 필요한 퀴즈 설정 */
  difficulty: string;
  translationLanguage: string;
  apiProvider?: "openai" | "gemini" | "gemini-pro";
}

export function WordMagnetProblemList({
  problems,
  onRefresh,
  studentPreview,
  onToggleStudentPreview,
  isEditing,
  setIsEditing,
  onSaveAll,
  registerSaver,
  sourceWords,
  difficulty,
  translationLanguage,
  apiProvider,
}: WordMagnetProblemListProps) {
  const [editedProblems, setEditedProblems] = useState<WordMagnetProblem[]>(problems);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resegmentingId, setResegmentingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  const handleUpdateProblem = (id: string, field: keyof WordMagnetProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleUpdateItems = (id: string, items: WordMagnetProblem["items"]) => {
    setEditedProblems((prev) => prev.map((p) => (p.id === id ? { ...p, items } : p)));
  };

  const handleResegment = async (id: string) => {
    const target = editedProblems.find((p) => p.id === id);
    if (!target || !target.base_text.trim()) return;
    setResegmentingId(id);
    try {
      const map = await segmentSentences([{ id, text: target.base_text }]);
      handleUpdateItems(id, map[id] || []);
    } finally {
      setResegmentingId(null);
    }
  };

  // 문제 하나를 AI로 완전히 새 문장으로 교체 — 빈칸 채우기 데이터는 건드리지 않는다.
  const handleRegenerateProblem = async (id: string) => {
    const target = editedProblems.find((p) => p.id === id);
    if (!target) return;
    const word = sourceWords?.[target.problem_id];
    if (!word) {
      toast.error("원본 단어를 찾을 수 없습니다");
      return;
    }
    setRegeneratingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { words: [word], difficulty, translationLanguage, wordsPerSet: 1, apiProvider, wordMagnetEnabled: true, purpose: "regenerate" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Regeneration failed");

      const newProblem = data.problems[0];
      // B1+면 short_sentence(있으면)를 base_text로, 없으면 빈칸 치환 폴백.
      const useShort = isShortSentenceLevel(difficulty) && !!newProblem.short_sentence?.trim();
      const baseText = (useShort
        ? newProblem.short_sentence.trim()
        : newProblem.sentence.replace(/\(\s*\)|\(\)/g, newProblem.answer))
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .trim();
      const translation = (useShort
        ? (newProblem.short_translation ?? newProblem.translation ?? "")
        : (newProblem.translation || "")
      ).replace(/[[\]]/g, "");
      const heuristicItems = parseSentenceToItems(baseText).map((it) => ({ content: it.content, isParticle: it.isParticle }));

      setEditedProblems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, base_text: baseText, translation, items: heuristicItems } : p))
      );
      if (!isEditing) setIsEditing(true);

      try {
        const map = await segmentSentences([{ id, text: baseText }]);
        if (map[id] && map[id].length > 0) {
          handleUpdateItems(id, map[id]);
        }
      } catch (segErr) {
        console.error("Segmentation upgrade failed, keeping heuristic tiles:", segErr);
      }

      toast.success("문제가 재생성되었습니다");
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast.error(error.message || "재생성에 실패했습니다");
    } finally {
      setRegeneratingId(null);
    }
  };

  // 전체 문제를 한 번의 AI 호출로 일괄 재생성 — 빈칸 채우기와 연결 안 된(출처 단어 없는) 문제는 제외.
  const handleRegenerateAllProblems = async () => {
    if (!confirm("모든 문제가 재생성됩니다. 기존 내용은 사라집니다. 계속하시겠습니까?")) return;

    const words = editedProblems
      .map((p) => sourceWords?.[p.problem_id])
      .filter((w): w is string => !!w);
    if (words.length === 0) return;

    setIsRegeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { words, difficulty, translationLanguage, wordsPerSet: words.length, apiProvider, wordMagnetEnabled: true, purpose: "regenerate" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Regeneration failed");

      const newByWord = new Map<string, any>((data.problems || []).map((p: any) => [p.word, p]));
      const isB1Plus = isShortSentenceLevel(difficulty);

      const updated = editedProblems.map((problem) => {
        const word = sourceWords?.[problem.problem_id];
        const newProblem = word ? newByWord.get(word) : undefined;
        if (!newProblem) return problem;
        // B1+면 short_sentence(있으면)를 base_text로, 없으면 빈칸 치환 폴백.
        const useShort = isB1Plus && !!newProblem.short_sentence?.trim();
        const baseText = (useShort
          ? newProblem.short_sentence.trim()
          : newProblem.sentence.replace(/\(\s*\)|\(\)/g, newProblem.answer))
          .replace(/([.?!])\s*\.+\s*$/, "$1")
          .trim();
        const translation = (useShort
          ? (newProblem.short_translation ?? newProblem.translation ?? "")
          : (newProblem.translation || "")
        ).replace(/[[\]]/g, "");
        return {
          ...problem,
          base_text: baseText,
          translation,
          items: parseSentenceToItems(baseText).map((it) => ({ content: it.content, isParticle: it.isParticle })),
        };
      });
      setEditedProblems(updated);
      if (!isEditing) setIsEditing(true);

      const toSegment = updated
        .filter((p) => {
          const word = sourceWords?.[p.problem_id];
          return word && newByWord.get(word);
        })
        .map((p) => ({ id: p.id, text: p.base_text }));

      if (toSegment.length > 0) {
        try {
          const map = await segmentSentences(toSegment);
          setEditedProblems((prev) =>
            prev.map((p) => (map[p.id] && map[p.id].length > 0 ? { ...p, items: map[p.id] } : p))
          );
        } catch (segErr) {
          console.error("Segmentation upgrade failed, keeping heuristic tiles:", segErr);
        }
      }

      toast.success("전체 문제가 재생성되었습니다");
    } catch (error: any) {
      console.error("Regenerate all error:", error);
      toast.error(error.message || "재생성에 실패했습니다");
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  const handleAddProblem = () => {
    const newId = `temp-${crypto.randomUUID()}`;
    setEditedProblems(prev => {
      const newProblem: WordMagnetProblem = {
        id: newId,
        quiz_id: quizId || '',
        problem_id: `wm-${crypto.randomUUID().slice(0, 8)}`,
        base_text: '',
        translation: '',
        items: [],
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
          // items가 source of truth — 교사가 편집한 그대로 저장.
          // (비어 있는데 base_text가 있으면 휴리스틱으로 폴백 — 재분절 누락 방지)
          const itemsToSave =
            problem.items && problem.items.length > 0
              ? problem.items
              : parseSentenceToItems(problem.base_text).map((it) => ({
                  content: it.content,
                  isParticle: it.isParticle,
                }));

          if (problem.id.startsWith('temp-')) {
            return supabase.from("word_magnet_problems").insert({
              quiz_id: problem.quiz_id,
              problem_id: problem.problem_id,
              base_text: problem.base_text,
              translation: problem.translation || null,
              items: itemsToSave,
              sort_order: problem.sort_order,
            });
          } else {
            return supabase
              .from("word_magnet_problems")
              .update({
                base_text: problem.base_text,
                translation: problem.translation || null,
                items: itemsToSave,
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
          .from("word_magnet_problems")
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
          문장 순서 맞추기 문제가 없습니다.
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={handleAddProblem}
            >
              <Plus className="w-4 h-4 mr-2" />
              문장 추가하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayProblems = studentPreview ? problems : editedProblems;

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
            variant="outline"
            size="sm"
            onClick={handleRegenerateAllProblems}
            disabled={isRegeneratingAll}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
          >
            {isRegeneratingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <span>전체 문제 재생성</span>
          </Button>
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
      {studentPreview && displayProblems.length > 0 ? (
        <WordMagnetStudentView problems={displayProblems} />
      ) : !studentPreview && (
        <div className="space-y-4">
          {isEditing && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>단어 타일은 'AI 재분절'로 다시 나누거나 직접 편집할 수 있어요. 조사·어미는 노란색 타일입니다.</span>
            </div>
          )}

          {isEditing ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={editedProblems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 gap-4">
                  {editedProblems.map((problem, index) => (
                    <SortableWordMagnetCard key={problem.id} id={problem.id}>
                      {(dragHandleProps) => (
                        <WordMagnetEditCard
                          index={index}
                          baseText={problem.base_text}
                          translation={problem.translation || ""}
                          items={problem.items || []}
                          editable={isEditing}
                          word={sourceWords?.[problem.problem_id]}
                          onChangeBaseText={(v) => handleUpdateProblem(problem.id, "base_text", v)}
                          onChangeTranslation={(v) => handleUpdateProblem(problem.id, "translation", v)}
                          onChangeItems={(items) => handleUpdateItems(problem.id, items)}
                          onResegment={() => handleResegment(problem.id)}
                          resegmenting={resegmentingId === problem.id}
                          onRegenerateProblem={() => handleRegenerateProblem(problem.id)}
                          regeneratingProblem={regeneratingId === problem.id}
                          onDelete={() => handleDelete(problem.id)}
                          deleting={deletingId === problem.id}
                          dragHandleProps={dragHandleProps}
                        />
                      )}
                    </SortableWordMagnetCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {editedProblems.map((problem, index) => (
                <WordMagnetEditCard
                  key={problem.id}
                  index={index}
                  baseText={problem.base_text}
                  translation={problem.translation || ""}
                  items={problem.items || []}
                  editable={isEditing}
                  word={sourceWords?.[problem.problem_id]}
                  onChangeBaseText={(v) => handleUpdateProblem(problem.id, "base_text", v)}
                  onChangeTranslation={(v) => handleUpdateProblem(problem.id, "translation", v)}
                  onChangeItems={(items) => handleUpdateItems(problem.id, items)}
                  onResegment={() => handleResegment(problem.id)}
                  resegmenting={resegmentingId === problem.id}
                  onRegenerateProblem={() => handleRegenerateProblem(problem.id)}
                  regeneratingProblem={regeneratingId === problem.id}
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
              문장 추가하기
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
        </div>
      )}
    </div>
  );
}
