import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, GripVertical } from "lucide-react";

/**
 * 단어/뜻 쌍을 편집하는 공유 카드.
 * 짝 맞추기·단어 받아쓰기·문장 만들기가 모두 (단어, 뜻) 쌍이므로 동일 카드를 공유한다.
 * 빈칸 채우기와 동일하게 단어는 헤더의 알약(편집 시 Input)으로, 본문엔 뜻만 둔다.
 * 각 소비자가 자기 필드명을 word/meaning에 매핑한다.
 * - QuizPreview(draft): editable=true 고정, onChange→setDraft
 * - QuizDetail(Matchup·TypeAnswer·SentenceMaking ProblemList): editable=isEditing, onChange→setEditedProblems
 */
interface WordMeaningEditCardProps {
  index: number;
  word: string;
  meaning: string;
  editable?: boolean;
  meaningLabel?: string;
  wordPlaceholder?: string;
  meaningPlaceholder?: string;
  onChangeWord: (value: string) => void;
  onChangeMeaning: (value: string) => void;
  onDelete: () => void;
  deleting?: boolean;
  dragHandleProps?: { attributes: any; listeners: any };
}

export function WordMeaningEditCard({
  index,
  word,
  meaning,
  editable = true,
  meaningLabel = "뜻",
  wordPlaceholder = "단어 입력",
  meaningPlaceholder = "단어 뜻",
  onChangeWord,
  onChangeMeaning,
  onDelete,
  deleting = false,
  dragHandleProps,
}: WordMeaningEditCardProps) {
  return (
    <Card className="bg-white border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
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
            {editable ? (
              <Input
                value={word}
                onChange={(e) => onChangeWord(e.target.value)}
                placeholder={wordPlaceholder}
                className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-center w-auto min-w-[80px] max-w-[200px] h-8 text-sm border-primary/30"
              />
            ) : (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold truncate">
                {word}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={deleting}
            className="h-9 w-9 flex-shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{meaningLabel}</Label>
          {editable ? (
            <Input
              value={meaning}
              onChange={(e) => onChangeMeaning(e.target.value)}
              placeholder={meaningPlaceholder}
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-sm">{meaning || "(없음)"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
