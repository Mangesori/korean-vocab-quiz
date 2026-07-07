import { Volume2, RefreshCw, Loader2, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * 말하기 연습 편집 카드. QuizPreview(퀴즈 생성 직후)와 QuizDetail(나중에 수정) 화면이 공유한다.
 * problem 객체를 통째로 받지 않고 개별 값을 받는다 — 두 화면의 RecordingProblem 타입이 서로 달라서(DB 필드 포함 여부) 통일하지 않음.
 * - isEditing 기본값 true → Preview는 항상 편집 가능, Detail은 실제 토글 상태를 전달
 * - 음성 재생/재생성 버튼은 콜백이 없으면 렌더링하지 않음 → Preview(저장 전, 오디오 없음)에서 자동으로 숨겨짐
 * - "문제 재생성" 버튼도 콜백이 없으면 숨겨짐 → Detail(원래 이 기능 없음)에서 자동으로 숨겨짐
 * - 라벨은 항상 편집 가능. label(recording_problems 전용 필드)이 있으면 그 값을, 없으면 sourceWord(빈칸 채우기 단어)를 기본 표시값으로 보여준다.
 *   수정해도 label만 갱신되고 sourceWord의 원본(빈칸 채우기 단어)은 절대 바뀌지 않는다.
 */
interface RecordingEditCardProps {
  index: number;
  sentence: string;
  translation: string;
  mode: "read" | "listen";
  isEditing?: boolean;
  sourceWord?: string;
  label?: string;
  onChangeLabel?: (value: string) => void;
  onChangeSentence: (value: string) => void;
  onChangeTranslation: (value: string) => void;
  onChangeMode: (mode: "read" | "listen") => void;
  audioUrl?: string;
  onPlayAudio?: () => void;
  onRegenerateAudio?: () => void;
  regeneratingAudio?: boolean;
  onRegenerateProblem?: () => void;
  regeneratingProblem?: boolean;
  onDelete: () => void;
  deleting?: boolean;
  dragHandleProps?: { attributes: any; listeners: any };
}

export function RecordingEditCard({
  index,
  sentence,
  translation,
  mode,
  isEditing = true,
  sourceWord,
  label,
  onChangeLabel,
  onChangeSentence,
  onChangeTranslation,
  onChangeMode,
  audioUrl,
  onPlayAudio,
  onRegenerateAudio,
  regeneratingAudio = false,
  onRegenerateProblem,
  regeneratingProblem = false,
  onDelete,
  deleting = false,
  dragHandleProps,
}: RecordingEditCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
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
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
              {index + 1}
            </span>
            {onChangeLabel && isEditing ? (
              <Input
                value={label || sourceWord || ""}
                onChange={(e) => onChangeLabel(e.target.value)}
                placeholder="단어"
                className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-center w-auto min-w-[80px] max-w-[200px] h-8 text-sm border-primary/30"
              />
            ) : (label || sourceWord) ? (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold truncate hidden sm:inline-block">
                {label || sourceWord}
              </span>
            ) : null}
            {isEditing ? (
              <Select value={mode} onValueChange={(value: "read" | "listen") => onChangeMode(value)}>
                <SelectTrigger className="w-[140px] sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      보고 말하기
                    </div>
                  </SelectItem>
                  <SelectItem value="listen">
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4" />
                      듣고 말하기
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium flex items-center gap-1">
                {mode === "read" ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    보고 말하기
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    듣고 말하기
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {onPlayAudio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPlayAudio}
                disabled={!audioUrl}
                className="text-muted-foreground hover:!bg-accent/30 hover:text-foreground"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            )}
            {onRegenerateAudio && (
              <Button
                variant="default"
                size="sm"
                onClick={onRegenerateAudio}
                disabled={regeneratingAudio || deleting}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {regeneratingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span className="hidden sm:inline">음성 재생성</span>
              </Button>
            )}
            {onRegenerateProblem && (
              <Button
                variant="default"
                size="sm"
                onClick={onRegenerateProblem}
                disabled={regeneratingProblem}
                className="bg-primary hover:bg-primary/90"
              >
                {regeneratingProblem ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span className="hidden sm:inline">문제 재생성</span>
                <span className="sm:hidden">재생성</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={deleting || regeneratingAudio}
              className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">문장</Label>
          {isEditing ? (
            <Textarea
              value={sentence}
              onChange={(e) => onChangeSentence(e.target.value)}
              placeholder="말하기 연습할 문장을 입력하세요"
              className="bg-muted min-h-[80px]"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-lg font-lg">{sentence}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">번역</Label>
          {isEditing ? (
            <Textarea
              value={translation}
              onChange={(e) => onChangeTranslation(e.target.value)}
              placeholder="번역을 입력하세요"
              className="bg-muted min-h-[60px]"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-sm">{translation || "(없음)"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
