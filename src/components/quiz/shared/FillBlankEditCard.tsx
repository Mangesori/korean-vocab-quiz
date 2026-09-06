import { useState } from "react";
import { Volume2, RefreshCw, Loader2, Trash2, GripVertical, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Problem } from "@/hooks/useQuizData";

/**
 * 빈칸 채우기 편집 카드. QuizPreview(퀴즈 생성 직후)와 QuizDetail(나중에 수정) 화면이 공유한다.
 * - isEditing 기본값 true → Preview는 항상 편집 가능, Detail은 실제 토글 상태를 전달
 * - 음성 재생/재생성 버튼은 콜백이 없으면 렌더링하지 않음 → Preview(저장 전, 오디오 없음)에서 자동으로 숨겨짐
 * - onRegenerateAudio·onRegenerateProblem·onDeleteProblem은 값을 바꾸는 동작이므로 isEditing이 아닐 때는
 *   콜백이 전달되어도 렌더하지 않는다 (읽기 전용에서 삭제/재생성이 눌리는 권한 버그 방지).
 */
interface FillBlankEditCardProps {
  problem: Problem;
  index: number;
  isEditing?: boolean;
  onUpdateProblem: (id: string, field: keyof Problem, value: string) => void;
  langLabel?: string;
  audioUrl?: string;
  onPlayAudio?: (url: string) => void;
  onRegenerateAudio?: (problem: Problem) => void;
  onRegenerateProblem?: () => void;
  regeneratingId?: string | null;
  onDeleteProblem?: () => void;
  isDeletingProblem?: boolean;
  dragHandleProps?: { attributes: any; listeners: any };
}

export function FillBlankEditCard({
  problem,
  index,
  isEditing = true,
  onUpdateProblem,
  langLabel,
  audioUrl,
  onPlayAudio,
  onRegenerateAudio,
  onRegenerateProblem,
  regeneratingId,
  onDeleteProblem,
  isDeletingProblem,
  dragHandleProps,
}: FillBlankEditCardProps) {
  // 값을 바꾸는 동작 — 편집 중일 때만 카드에 노출한다.
  const canRegenerateAudio = isEditing && !!onRegenerateAudio;
  const canRegenerateProblem = isEditing && !!onRegenerateProblem;
  const canDelete = isEditing && !!onDeleteProblem;
  const isBusy = regeneratingId === problem.id;
  // 읽기 전용 모바일에서만 번역을 접을 수 있게 — 데스크톱은 항상 펼쳐 둔다 (sm:block으로 강제 표시).
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-[#F4F0EA]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Mobile Line 1: Word + Play Button */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              {dragHandleProps && (
                <button
                  type="button"
                  {...dragHandleProps.attributes}
                  {...dragHandleProps.listeners}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none flex-shrink-0"
                  aria-label="순서 변경"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {index + 1}
              </span>
              {isEditing ? (
                <Input
                  value={problem.word}
                  onChange={(e) => onUpdateProblem(problem.id, "word", e.target.value)}
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-center w-auto min-w-[80px] max-w-[200px] h-8 text-sm border-primary/30"
                />
              ) : (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                  {problem.word}
                </span>
              )}
            </div>

            {/* Play Button - Visible here only on Mobile */}
            {onPlayAudio && (
              <div className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => audioUrl && onPlayAudio(audioUrl)}
                  disabled={!audioUrl}
                  className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Desktop Right Side / Mobile Line 2 */}
          <div className="flex items-center justify-end gap-1 w-full sm:w-auto mt-1 sm:mt-0">
            {/* Play Button - Desktop Only (값을 바꾸지 않으므로 읽기 전용에서도 남긴다) */}
            {onPlayAudio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => audioUrl && onPlayAudio(audioUrl)}
                disabled={!audioUrl}
                className="text-muted-foreground hover:!bg-accent/30 hover:text-foreground hidden sm:inline-flex"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            )}

            {/* 문제 재생성 — 자주 쓰는 동작이라 온전한 라벨로 카드 헤더에 남긴다 */}
            {canRegenerateProblem && (
              <Button
                variant="default"
                size="sm"
                onClick={onRegenerateProblem}
                disabled={isBusy}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span>문제 재생성</span>
              </Button>
            )}

            {/* 음성 재생성 · 삭제 — 자주 쓰지 않으면서 되돌릴 수 없는 동작이라 ⋮ 안으로 */}
            {(canRegenerateAudio || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    aria-label="문제 카드 더보기"
                  >
                    {isBusy || isDeletingProblem ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MoreVertical className="w-4 h-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canRegenerateAudio && (
                    <DropdownMenuItem
                      onClick={() => onRegenerateAudio(problem)}
                      disabled={isBusy}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      음성 재생성
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={onDeleteProblem}
                      disabled={isDeletingProblem}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-5 space-y-4">
        {/* 문장 (미리보기) - 정답이 이미 초록으로 채워진 읽기 전용 상태 */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            {isEditing ? "문장 (미리보기)" : "문장"}
          </Label>
          <p className="text-lg px-3 py-2 rounded-md bg-muted">
            {problem.sentence.split(/\(\s*\)|\(\)/).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-primary font-bold">{problem.answer}</span>
                )}
              </span>
            ))}
          </p>
        </div>

        {isEditing ? (
          <>
            {/* 출제 문장 - 입력칸, 정답이 들어갈 ( ) 자리를 여기서 지정 */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                출제 문장
              </Label>
              <Input
                value={problem.sentence}
                onChange={(e) => onUpdateProblem(problem.id, "sentence", e.target.value)}
                className="text-sm sm:text-lg bg-muted"
              />
            </div>

            {/* 정답 | 힌트 - 가로 배치 (모바일은 세로) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  정답
                </Label>
                <Input
                  value={problem.answer}
                  onChange={(e) => onUpdateProblem(problem.id, "answer", e.target.value)}
                  className="text-sm bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  힌트
                </Label>
                <Input
                  value={problem.hint}
                  onChange={(e) => onUpdateProblem(problem.id, "hint", e.target.value)}
                  className="text-sm bg-muted"
                />
              </div>
            </div>

            {/* 번역 - 전폭 */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                번역{langLabel ? `(${langLabel})` : ""}
              </Label>
              <Textarea
                value={problem.translation}
                onChange={(e) => onUpdateProblem(problem.id, "translation", e.target.value)}
                className="bg-muted min-h-[60px]"
                rows={2}
              />
            </div>
          </>
        ) : (
          // 읽기 전용 - 정답 칸은 문장에 이미 박혀 있으므로 빼고, 힌트는 짧고 번역은 길어 34%/1fr로 배분
          <div className="grid gap-[14px]" style={{ gridTemplateColumns: "34% 1fr" }}>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                힌트
              </Label>
              <p className="px-3 py-2 rounded-md bg-muted text-sm">{problem.hint}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  번역{langLabel ? `(${langLabel})` : ""}
                </Label>
                <button
                  type="button"
                  className="sm:hidden text-xs font-medium text-primary"
                  onClick={() => setShowTranslation((v) => !v)}
                >
                  {showTranslation ? "번역 숨기기" : "번역 보기"}
                </button>
              </div>
              <p className={`px-3 py-2 rounded-md bg-muted text-sm sm:block ${showTranslation ? "" : "hidden"}`}>
                {problem.translation}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
