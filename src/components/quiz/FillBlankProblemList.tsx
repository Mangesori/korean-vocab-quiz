import { useState, type CSSProperties, type ReactNode } from "react";
import { Eye, RefreshCw, Loader2, Save, Edit2, Plus, Info, MoreVertical, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  changedCount?: number;
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
  changedCount = 0,
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

  // 전체 음성 재생성 · 전체 문제 재생성 · 음성 엔진 선택 — 자주 쓰지 않으므로 ⋮ 메뉴 안으로
  const overflowMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9 shrink-0" aria-label="더보기">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onRegenerateAllAudio} disabled={isGeneratingAudio}>
          {isGeneratingAudio ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          전체 음성 재생성
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRegenerateAllProblems} disabled={isRegeneratingProblems}>
          {isRegeneratingProblems ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          전체 문제 재생성
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          음성 엔진
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onTtsProviderChange?.("azure")}>
          {ttsProvider === "azure" && <Check className="w-4 h-4 mr-2" />}
          <span className={ttsProvider === "azure" ? "" : "ml-6"}>Azure Speech (무료)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTtsProviderChange?.("elevenlabs")}>
          {ttsProvider === "elevenlabs" && <Check className="w-4 h-4 mr-2" />}
          <span className={ttsProvider === "elevenlabs" ? "" : "ml-6"}>ElevenLabs</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start sm:gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">문제 목록</h2>
              {isEditing && (
                <span
                  className="px-2 py-0.5 rounded-lg text-[11.5px] font-bold"
                  style={{ color: "#1E6B47", backgroundColor: "#E8F1EB", border: "1px solid #C8DED3" }}
                >
                  편집 중
                </span>
              )}
            </div>

            {/* 학생 화면 스위치 - 편집 중에도 미리보기 가능. 데스크톱은 제목과 한 줄. */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Eye className="w-4 h-4" /> 학생 화면
              </span>
              <Switch checked={!!studentPreview} onCheckedChange={onToggleStudentPreview} />
            </div>
          </div>


          {/* 모바일에서는 스위치를 제목 줄에 붙이지 않고 별도 행으로 — 375px에서 제목이 밀리는 것 방지 */}
          <div className="flex sm:hidden items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Eye className="w-4 h-4" /> 학생 화면
            </span>
            <Switch checked={!!studentPreview} onCheckedChange={onToggleStudentPreview} />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onCancelEdit}
                className="flex-1 sm:flex-none h-11 rounded-[11px] sm:h-9 sm:rounded-md border border-[#E3DCD3]"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                <span>수정 취소</span>
              </Button>
              {overflowMenu}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-none h-11 rounded-[11px] sm:h-9 sm:rounded-md"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                <span>수정하기</span>
              </Button>
              {overflowMenu}
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-[12px] mb-6"
          style={{ backgroundColor: "#F4F9F6", border: "1px solid #C8DED3", color: "#2C6B4C" }}
        >
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
                        // 읽기 전용에서는 값을 바꾸는 핸들러 자체를 카드에 넘기지 않는다 (권한 버그 수정)
                        onRegenerateAudio={isEditing ? () => onRegenerateSingleAudio(problem) : undefined}
                        onRegenerateProblem={isEditing ? () => onRegenerateProblem(problem) : undefined}
                        regeneratingId={regeneratingProblemId}
                        onDeleteProblem={isEditing && onDeleteProblem ? () => onDeleteProblem(problem) : undefined}
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

      {isEditing && onAddProblem && (
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

      {/* 저장하기 고정 바 — 화면 안에 이 한 곳에만 둔다 */}
      {isEditing && (
        <div className="fixed bottom-4 left-4 right-4 z-40 flex justify-center pointer-events-none">
          <div
            className="w-full max-w-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-[13px] pointer-events-auto"
            style={{
              backgroundColor: "#fff",
              border: "1px solid #E3DCD3",
              borderRadius: 13,
              boxShadow: "0 -2px 12px rgba(0,0,0,.04)",
            }}
          >
            <span className="text-sm text-muted-foreground">
              <span className="font-bold" style={{ color: "#B4552D" }}>
                {changedCount}개
              </span>{" "}
              문제를 고쳤습니다 · 저장하지 않으면 사라집니다
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={onCancelEdit}>
                수정 취소
              </Button>
              <Button onClick={onSaveChanges} disabled={isSaving || !hasChanges} size="sm" className="flex-1 sm:flex-none">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                저장하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
