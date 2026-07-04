import { Volume2, RefreshCw, Loader2, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Problem } from "@/hooks/useQuizData";

/**
 * 빈칸 채우기 편집 카드. QuizPreview(퀴즈 생성 직후)와 QuizDetail(나중에 수정) 화면이 공유한다.
 * - isEditing 기본값 true → Preview는 항상 편집 가능, Detail은 실제 토글 상태를 전달
 * - 음성 재생/재생성 버튼은 콜백이 없으면 렌더링하지 않음 → Preview(저장 전, 오디오 없음)에서 자동으로 숨겨짐
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
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-slate-100">
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
            {/* Play Button - Desktop Only */}
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

            {onRegenerateAudio && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onRegenerateAudio(problem)}
                disabled={regeneratingId === problem.id}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {regeneratingId === problem.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span className="hidden sm:inline">음성 재생성</span>
                <span className="sm:hidden">음성 재생성</span>
              </Button>
            )}

            {onRegenerateProblem && (
              <Button
                variant="default"
                size="sm"
                onClick={onRegenerateProblem}
                disabled={regeneratingId === problem.id}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {regeneratingId === problem.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span className="hidden sm:inline">문제 재생성</span>
                <span className="sm:hidden">문제 재생성</span>
              </Button>
            )}

            {onDeleteProblem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeleteProblem}
                disabled={isDeletingProblem}
                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isDeletingProblem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-5 space-y-4">
        {/* 문장 (정답 하이라이트) */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">문장</Label>
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

        {/* 출제 문장 - 편집 모드일 때만 표시 */}
        {isEditing && (
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
        )}

        {/* 정답과 힌트 - 가로 배치 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              정답
            </Label>
            {isEditing ? (
              <Input
                value={problem.answer}
                onChange={(e) => onUpdateProblem(problem.id, "answer", e.target.value)}
                className="text-sm bg-muted"
              />
            ) : (
              <p className="px-3 py-2 rounded-md bg-muted text-sm">{problem.answer}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              힌트
            </Label>
            {isEditing ? (
              <Input
                value={problem.hint}
                onChange={(e) => onUpdateProblem(problem.id, "hint", e.target.value)}
                className="text-sm bg-muted"
              />
            ) : (
              <p className="px-3 py-2 rounded-md bg-muted text-sm">{problem.hint}</p>
            )}
          </div>
        </div>

        {/* 번역 (회색 배경) */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            번역{langLabel ? `(${langLabel})` : ""}
          </Label>
          {isEditing ? (
            <Textarea
              value={problem.translation}
              onChange={(e) => onUpdateProblem(problem.id, "translation", e.target.value)}
              className="bg-muted min-h-[60px]"
              rows={2}
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-sm">{problem.translation}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
