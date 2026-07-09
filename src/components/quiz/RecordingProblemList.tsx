import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit2, Save, Loader2, Eye, Plus, RefreshCw, Info } from "lucide-react";
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
import { RecordingStudentView } from "@/components/quiz/shared/RecordingStudentView";
import { RecordingEditCard } from "@/components/quiz/shared/RecordingEditCard";
import { isShortSentenceLevel } from "@/lib/quiz";

export interface RecordingProblem {
  id: string;
  quiz_id: string;
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  sentence_audio_url: string | null;
  translation: string | null;
  source_type: string;
  created_at: string;
  sort_order: number;
  label?: string | null;
}

// 드래그로 순서를 바꿀 수 있는 카드 래퍼 — 편집 모드에서만 사용.
function SortableRecordingCard({ id, children }: { id: string; children: (dragHandleProps: { attributes: any; listeners: any }) => ReactNode }) {
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

interface RecordingProblemListProps {
  problems: RecordingProblem[];
  onRefresh: () => void;
  studentPreview?: boolean;
  onToggleStudentPreview?: (v: boolean) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onSaveAll: () => void | Promise<void>;
  registerSaver: (fn: (() => Promise<void>) | null) => void;
  /** problem_id → 출처 단어(빈칸 문제). 헤더 읽기전용 라벨용. */
  sourceWords?: Record<string, string>;
  /** "전체 문장 재생성"용 — 빈칸 채우기 원본 문제(problem_id가 이 id와 같은 문제만 대상). */
  fillBlankProblems?: { id: string; sentence: string; answer: string; translation: string; short_sentence?: string; short_translation?: string }[];
  /** 개별 문제 재생성(AI 호출)에 필요한 퀴즈 설정 */
  difficulty: string;
  translationLanguage: string;
  apiProvider?: "openai" | "gemini" | "gemini-pro";
}

export function RecordingProblemList({
  problems,
  onRefresh,
  studentPreview,
  onToggleStudentPreview,
  isEditing,
  setIsEditing,
  onSaveAll,
  registerSaver,
  sourceWords,
  fillBlankProblems,
  difficulty,
  translationLanguage,
  apiProvider,
}: RecordingProblemListProps) {
  const [editedProblems, setEditedProblems] = useState<RecordingProblem[]>(problems);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratingSentenceId, setRegeneratingSentenceId] = useState<string | null>(null);
  const [isRegeneratingAllAudio, setIsRegeneratingAllAudio] = useState(false);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  useEffect(() => {
    const fetchAudioUrls = async () => {
      const problemIds = problems.map((p) => p.problem_id).filter(Boolean);
      if (problemIds.length === 0) return;
      const { data } = await supabase
        .from("quiz_problems")
        .select("problem_id, sentence_audio_url")
        .eq("quiz_id", quizId)
        .in("problem_id", problemIds);
      if (data) {
        const map: Record<string, string> = {};
        for (const qp of data) {
          if (qp.sentence_audio_url) map[qp.problem_id] = qp.sentence_audio_url;
        }
        setAudioUrlMap(map);
      }
    };
    fetchAudioUrls();
  }, [problems]);

  const handleUpdateProblem = (id: string, field: keyof RecordingProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleModeChange = (id: string, mode: "read" | "listen") => {
    setEditedProblems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, mode };
        if (mode === "listen" && !p.sentence_audio_url) {
          const url = audioUrlMap[p.problem_id];
          if (url) updated.sentence_audio_url = url;
        }
        return updated;
      })
    );
  };

  const handleAddProblem = () => {
    const newId = `temp-${crypto.randomUUID()}`;
    setEditedProblems(prev => {
      const newProblem: RecordingProblem = {
        id: newId,
        quiz_id: quizId || '',
        problem_id: `rec-${crypto.randomUUID().slice(0, 8)}`,
        sentence: '',
        mode: 'read',
        sentence_audio_url: null,
        translation: '',
        source_type: 'teacher_input',
        created_at: new Date().toISOString(),
        sort_order: prev.length,
        label: '',
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
            return (supabase as any).from("recording_problems").insert({
              quiz_id: problem.quiz_id,
              problem_id: problem.problem_id,
              sentence: problem.sentence,
              mode: problem.mode,
              sentence_audio_url: problem.sentence_audio_url || null,
              translation: problem.translation || null,
              source_type: (problem.source_type || 'teacher_input') as "reuse" | "ai_generated" | "teacher_input",
              sort_order: problem.sort_order,
              label: problem.label || null,
            });
          } else {
            return (supabase as any)
              .from("recording_problems")
              .update({
                sentence: problem.sentence,
                mode: problem.mode,
                sentence_audio_url: problem.sentence_audio_url || null,
                translation: problem.translation || null,
                sort_order: problem.sort_order,
                label: problem.label || null,
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

  const handleRegenerateAudio = async (problem: RecordingProblem) => {
    if (!quizId) return;
    setRegeneratingId(problem.id);
    try {
      const cleanText = problem.sentence
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .replace(/\.\s*\.$/, ".");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

      const audioBlob = await response.blob();
      const fileName = `${quizId}/recording_${problem.problem_id}_${Date.now()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('quiz-audio')
        .upload(fileName, audioBlob, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('quiz-audio')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("recording_problems")
        .update({ sentence_audio_url: urlData.publicUrl })
        .eq("id", problem.id);

      if (updateError) throw updateError;

      toast.success("음성이 생성되었습니다");
      onRefresh();
    } catch (error: any) {
      console.error("Audio regeneration error:", error);
      toast.error(error.message || "음성 생성에 실패했습니다");
    } finally {
      setRegeneratingId(null);
    }
  };

  // 전체 음성 재생성 — 기존 개별 음성 재생성을 문제 수만큼 반복 적용(각 성공 시 바로 DB 반영).
  const handleRegenerateAllAudio = async () => {
    if (!confirm("모든 문제의 음성이 재생성됩니다. 계속하시겠습니까?")) return;
    setIsRegeneratingAllAudio(true);
    try {
      for (const problem of editedProblems) {
        if (!problem.sentence?.trim() || problem.id.startsWith("temp-")) continue;
        await handleRegenerateAudio(problem);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      setIsRegeneratingAllAudio(false);
    }
  };

  // 전체 문장 재생성 — 빈칸 채우기 문장에서 다시 계산(문장 만들 때 쓰는 것과 동일한 공식).
  // 빈칸 채우기와 연결 안 된(선생님이 직접 추가한) 문제는 대상에서 제외.
  // 즉시 저장하지 않고 화면에만 반영 — "저장하기"를 눌러야 최종 반영(문장 수정과 동일한 방식).
  const handleRegenerateAllSentences = () => {
    if (!fillBlankProblems || fillBlankProblems.length === 0) return;
    if (!confirm("모든 문제의 문장이 빈칸 채우기 문장 기준으로 다시 계산됩니다. 계속하시겠습니까?")) return;

    const fillBlankById = new Map(fillBlankProblems.map((p) => [p.id, p]));

    setEditedProblems((prev) =>
      prev.map((problem) => {
        const source = fillBlankById.get(problem.problem_id);
        if (!source) return problem;
        // B1+면 짧은 문장(short_sentence) 사용, 없으면 빈칸 치환 폴백 — 개별 재생성과 동일한 분기.
        const useShort = isShortSentenceLevel(difficulty) && !!source.short_sentence?.trim();
        const sentence = (useShort
          ? source.short_sentence!.trim()
          : source.sentence.replace(/\(\s*\)|\(\)/g, source.answer))
          .replace(/([.?!])\s*\.+\s*$/, "$1")
          .trim();
        const translation = (useShort
          ? (source.short_translation ?? source.translation ?? "")
          : (source.translation || "")
        ).replace(/[[\]]/g, "");
        return { ...problem, sentence, translation };
      })
    );
    if (!isEditing) setIsEditing(true);
    toast.success("문장이 새로 계산되었습니다. 저장하기를 눌러 반영하세요.");
  };

  // 문제 하나를 AI로 같은 단어의 새 예문으로 재생성 — 즉시 DB 저장하지 않고 화면에만 반영("저장하기"로 최종 반영).
  const handleRegenerateProblem = async (id: string) => {
    const target = editedProblems.find((p) => p.id === id);
    if (!target) return;
    // 교사가 "단어" 칩(label)을 바꿨으면 그 값을 우선 사용, 없으면 원본 빈칸 채우기 단어로 폴백
    const word = target.label?.trim() || sourceWords?.[target.problem_id];
    if (!word) {
      toast.error("원본 단어를 찾을 수 없습니다");
      return;
    }
    setRegeneratingSentenceId(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { words: [word], difficulty, translationLanguage, wordsPerSet: 1, apiProvider, regenerateSingle: true, recordingEnabled: true },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Regeneration failed");

      const newProblem = data.problems[0];
      // B1+면 새로 생성된 short_sentence(있으면)를 문장으로, 없으면 빈칸 치환 폴백.
      const useShort = isShortSentenceLevel(difficulty) && !!newProblem.short_sentence?.trim();
      const sentence = (useShort
        ? newProblem.short_sentence.trim()
        : newProblem.sentence.replace(/\(\s*\)|\(\)/g, newProblem.answer))
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .trim();
      const translation = (useShort
        ? (newProblem.short_translation ?? newProblem.translation ?? "")
        : (newProblem.translation || "")
      ).replace(/[[\]]/g, "");

      setEditedProblems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, sentence, translation } : p))
      );
      if (!isEditing) setIsEditing(true);

      toast.success("새 문장으로 재생성되었습니다");
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast.error(error.message || "재생성에 실패했습니다");
    } finally {
      setRegeneratingSentenceId(null);
    }
  };

  const handleDelete = async (problemId: string) => {
    if (!confirm("이 문제를 삭제하시겠습니까?")) return;

    setDeletingId(problemId);
    // editedProblems에서 즉시 제거
    setEditedProblems(prev => prev.filter(p => p.id !== problemId));

    try {
      // 미저장 항목(temp-)은 DB 삭제 불필요
      if (!problemId.startsWith("temp-")) {
        const { error } = await supabase
          .from("recording_problems")
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
          말하기 연습 문제가 없습니다.
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">문제 목록</h2>
          </div>
          {toggleRow}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="default"
            size="sm"
            onClick={handleRegenerateAllAudio}
            disabled={isRegeneratingAllAudio}
            className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
          >
            {isRegeneratingAllAudio ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <span>전체 음성 재생성</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateAllSentences}
            disabled={!fillBlankProblems || fillBlankProblems.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
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

      {studentPreview && problems.length > 0 ? (
        <RecordingStudentView problems={problems} />
      ) : !studentPreview && (
      <>
      {isEditing && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80 mb-4">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>'보고 말하기'는 문장을 보면서 소리 내어 읽고, '듣고 말하기'는 문장 없이 음성만 듣고 따라 말합니다.</span>
        </div>
      )}
      {isEditing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={editedProblems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {editedProblems.map((problem, index) => {
                const audioUrl = problem.sentence_audio_url || audioUrlMap[problem.problem_id];
                return (
                  <SortableRecordingCard key={problem.id} id={problem.id}>
                    {(dragHandleProps) => (
                      <RecordingEditCard
                        index={index}
                        sentence={problem.sentence || ""}
                        translation={problem.translation || ""}
                        mode={problem.mode}
                        isEditing={isEditing}
                        sourceWord={sourceWords?.[problem.problem_id]}
                        label={problem.label || ""}
                        onChangeLabel={(value) => handleUpdateProblem(problem.id, "label", value)}
                        onChangeSentence={(value) => handleUpdateProblem(problem.id, "sentence", value)}
                        onChangeTranslation={(value) => handleUpdateProblem(problem.id, "translation", value)}
                        onChangeMode={(mode) => handleModeChange(problem.id, mode)}
                        audioUrl={audioUrl}
                        onPlayAudio={audioUrl ? () => new Audio(audioUrl).play() : undefined}
                        onRegenerateAudio={() => handleRegenerateAudio(problem)}
                        regeneratingAudio={regeneratingId === problem.id}
                        onRegenerateProblem={isEditing ? () => handleRegenerateProblem(problem.id) : undefined}
                        regeneratingProblem={regeneratingSentenceId === problem.id}
                        onDelete={() => handleDelete(problem.id)}
                        deleting={deletingId === problem.id}
                        dragHandleProps={dragHandleProps}
                      />
                    )}
                  </SortableRecordingCard>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {editedProblems.map((problem, index) => {
            const audioUrl = problem.sentence_audio_url || audioUrlMap[problem.problem_id];
            return (
              <RecordingEditCard
                key={problem.id}
                index={index}
                sentence={problem.sentence || ""}
                translation={problem.translation || ""}
                mode={problem.mode}
                isEditing={isEditing}
                sourceWord={sourceWords?.[problem.problem_id]}
                label={problem.label || ""}
                onChangeLabel={(value) => handleUpdateProblem(problem.id, "label", value)}
                onChangeSentence={(value) => handleUpdateProblem(problem.id, "sentence", value)}
                onChangeTranslation={(value) => handleUpdateProblem(problem.id, "translation", value)}
                onChangeMode={(mode) => handleModeChange(problem.id, mode)}
                audioUrl={audioUrl}
                onPlayAudio={audioUrl ? () => new Audio(audioUrl).play() : undefined}
                onRegenerateAudio={() => handleRegenerateAudio(problem)}
                regeneratingAudio={regeneratingId === problem.id}
                onRegenerateProblem={isEditing ? () => handleRegenerateProblem(problem.id) : undefined}
                regeneratingProblem={regeneratingSentenceId === problem.id}
                onDelete={() => handleDelete(problem.id)}
                deleting={deletingId === problem.id}
              />
            );
          })}
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
      </>
      )}
    </div>
  );
}
