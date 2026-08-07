import { useState, type CSSProperties, type ReactNode } from "react";
import { Eye, EyeOff, RefreshCw, Loader2, Save, Edit2, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { FillBlankEditCard } from "@/components/quiz/shared/FillBlankEditCard";
import { FillBlankStudentSet } from "@/components/quiz/shared/FillBlankStudentSet";
import { Problem } from "@/hooks/useQuizData";
import type { TtsProvider } from "@/utils/ttsService";

// 드래그로 순서를 바꿀 수 있는 카드 래퍼 — 편집 모드에서만 사용. 세트 경계를 넘는 드래그도 지원.
function SortableFillBlankCard({ id, children }: { id: string; children: (dragHandleProps: { attributes: any; listeners: any }) => ReactNode }) {
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

interface FillBlankProblemListProps {
  problems: Problem[];
  isEditing: boolean;
  onUpdateProblem: (id: string, field: keyof Problem, value: string) => void;
  onReorderProblems?: (problems: Problem[]) => void;
  audioUrls: Record<string, string>;
  onPlayAudio: (url: string) => void;
  onRegenerateAllAudio: () => void;
  onRegenerateSingleAudio: (problem: Problem) => void;
  isGeneratingAudio: boolean;
  audioProgress: { current: number; total: number };
  regeneratingProblemId: string | null;
  studentPreview: boolean;
  onToggleStudentPreview: (enabled: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  onCancelEdit: () => void;
  onSaveChanges: () => void;
  onRegenerateAllProblems: () => void;
  onRegenerateProblem: (problem: Problem) => void;
  isRegeneratingProblems: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  wordsPerSet?: number;
  onDeleteProblem?: (problem: Problem) => void;
  deletingProblemId?: string | null;
  onAddProblem?: () => void;
  ttsProvider?: TtsProvider;
  onTtsProviderChange?: (provider: TtsProvider) => void;
}

export function FillBlankProblemList({
  problems,
  isEditing,
  onUpdateProblem,
  onReorderProblems,
  audioUrls,
  onPlayAudio,
  onRegenerateAllAudio,
  onRegenerateSingleAudio,
  isGeneratingAudio,
  audioProgress,
  regeneratingProblemId,
  studentPreview,
  onToggleStudentPreview,
  setIsEditing,
  onCancelEdit,
  onSaveChanges,
  onRegenerateAllProblems,
  onRegenerateProblem,
  isRegeneratingProblems,
  isSaving,
  hasChanges,
  wordsPerSet = 5,
  onDeleteProblem,
  deletingProblemId,
  onAddProblem,
  ttsProvider = "elevenlabs",
  onTtsProviderChange,
}: FillBlankProblemListProps) {
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Group problems into sets
  const problemSets: Problem[][] = [];
  for (let i = 0; i < problems.length; i += wordsPerSet) {
    problemSets.push(problems.slice(i, i + wordsPerSet));
  }

  const toggleTranslation = (id: string) => {
    setShowTranslations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !onReorderProblems) return;
    const oldIndex = problems.findIndex((p) => p.id === active.id);
    const newIndex = problems.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderProblems(arrayMove(problems, oldIndex, newIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">문제 목록</h2>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Eye className="w-4 h-4" /> 학생 화면
            </span>
            <Switch checked={!!studentPreview} onCheckedChange={onToggleStudentPreview} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full sm:flex sm:w-auto sm:items-center sm:gap-3">
          <select
            className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground shrink-0"
            value={ttsProvider}
            onChange={(e) => onTtsProviderChange?.(e.target.value as TtsProvider)}
            title="음성 생성 엔진 선택"
          >
            <option value="azure">Azure Speech (무료)</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>

          <Button
            variant="default"
            size="sm"
            onClick={onRegenerateAllAudio}
            disabled={isGeneratingAudio}
            className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
          >
            {isGeneratingAudio ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="whitespace-nowrap">음성 생성 중...</span>
                <span className="sm:hidden -ml-1">...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                <span className="whitespace-nowrap">전체 음성 재생성</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateAllProblems}
            disabled={isRegeneratingProblems}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
          >
             {isRegeneratingProblems ? (
               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
             ) : (
               <RefreshCw className="w-4 h-4 mr-2" />
             )}
             <span className="whitespace-nowrap">전체 문제 재생성</span>
          </Button>

          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (isEditing) {
                onCancelEdit();
              } else {
                onToggleStudentPreview(false);
                setIsEditing(true);
              }
            }}
            className="w-full sm:w-auto"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            <span>{isEditing ? "수정 취소" : "수정하기"}</span>
          </Button>

          <Button
            onClick={onSaveChanges}
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

      {isEditing && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80 mb-6">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>출제 문장에서 정답이 들어갈 자리에 괄호 ( )를 넣어주세요. 학생 화면에는 정답 칸에 입력한 단어가 그 자리에 채워져서 보입니다.</span>
        </div>
      )}

      {isEditing && !studentPreview && onReorderProblems ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={problems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {problemSets.map((set, setIndex) => (
                <div key={setIndex}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
                      세트 {setIndex + 1}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {set.map((problem) => {
                      const globalIndex = setIndex * wordsPerSet + set.indexOf(problem);
                      return (
                        <SortableFillBlankCard key={problem.id} id={problem.id}>
                          {(dragHandleProps) => (
                            <FillBlankEditCard
                              problem={problem}
                              index={globalIndex}
                              isEditing={isEditing}
                              onUpdateProblem={onUpdateProblem}
                              audioUrl={audioUrls[problem.id]}
                              onPlayAudio={onPlayAudio}
                              onRegenerateAudio={() => onRegenerateSingleAudio(problem)}
                              onRegenerateProblem={() => onRegenerateProblem(problem)}
                              regeneratingId={regeneratingProblemId}
                              onDeleteProblem={onDeleteProblem ? () => onDeleteProblem(problem) : undefined}
                              isDeletingProblem={deletingProblemId === problem.id}
                              dragHandleProps={dragHandleProps}
                            />
                          )}
                        </SortableFillBlankCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-6">
          {problemSets.map((set, setIndex) => (
            <div key={setIndex}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
                  세트 {setIndex + 1}
                </span>
              </div>

              {studentPreview ? (
                <FillBlankStudentSet
                  set={set}
                  startNumber={setIndex * wordsPerSet + 1}
                  showTranslations={showTranslations}
                  onToggleTranslation={toggleTranslation}
                  audioUrls={audioUrls}
                  onPlayAudio={onPlayAudio}
                />
              ) : (
                <div className="space-y-4">
                  {set.map((problem) => {
                    const globalIndex = setIndex * wordsPerSet + set.indexOf(problem);
                    return (
                      <FillBlankEditCard
                        key={problem.id}
                        problem={problem}
                        index={globalIndex}
                        isEditing={isEditing}
                        onUpdateProblem={onUpdateProblem}
                        audioUrl={audioUrls[problem.id]}
                        onPlayAudio={onPlayAudio}
                        onRegenerateAudio={() => onRegenerateSingleAudio(problem)}
                        onRegenerateProblem={() => onRegenerateProblem(problem)}
                        regeneratingId={regeneratingProblemId}
                        onDeleteProblem={onDeleteProblem ? () => onDeleteProblem(problem) : undefined}
                        isDeletingProblem={deletingProblemId === problem.id}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {onAddProblem && (
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
            onClick={onAddProblem}
          >
            <Plus className="w-4 h-4 mr-2" />
            문제 추가
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="mt-8 flex justify-center">
          <Button onClick={onSaveChanges} disabled={isSaving || !isEditing} size="lg">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            저장하기
          </Button>
        </div>
      )}
    </div>
  );
}
