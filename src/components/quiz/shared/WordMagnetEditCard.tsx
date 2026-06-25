import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Scissors, Link2, Sparkles } from "lucide-react";

export interface TileItem {
  content: string;
  isParticle: boolean;
}

/**
 * 문장 순서 맞추기 편집 카드(정답 문장 + 번역 + 타일).
 * 타일(items)은 source of truth — AI 분절 결과를 교사가 칩 UI로 직접 조정한다.
 * - isParticle: 앞 타일에 붙는 문법 형태소(조사/어미) — 노란 타일.
 * - QuizPreview: editable=true 고정
 * - QuizDetail(WordMagnetProblemList): editable=isEditing
 */
interface WordMagnetEditCardProps {
  index: number;
  baseText: string;
  translation: string;
  items: TileItem[];
  editable?: boolean;
  /** 출처 단어(빈칸 문제에서 파생). 읽기 전용 라벨로만 표시. */
  word?: string;
  onChangeBaseText: (value: string) => void;
  onChangeTranslation: (value: string) => void;
  onChangeItems: (items: TileItem[]) => void;
  /** AI 재분절(선택) */
  onResegment?: () => void;
  resegmenting?: boolean;
  onDelete: () => void;
  deleting?: boolean;
}

export function WordMagnetEditCard({
  index,
  baseText,
  translation,
  items,
  editable = true,
  word,
  onChangeBaseText,
  onChangeTranslation,
  onChangeItems,
  onResegment,
  resegmenting = false,
  onDelete,
  deleting = false,
}: WordMagnetEditCardProps) {
  const [splitIdx, setSplitIdx] = useState<number | null>(null);

  const toggleParticle = (i: number) =>
    onChangeItems(items.map((it, idx) => (idx === i ? { ...it, isParticle: !it.isParticle } : it)));

  const mergeLeft = (i: number) => {
    if (i <= 0) return;
    const merged: TileItem = {
      content: items[i - 1].content + items[i].content,
      isParticle: items[i - 1].isParticle,
    };
    onChangeItems([...items.slice(0, i - 1), merged, ...items.slice(i + 1)]);
  };

  const splitAt = (i: number, k: number) => {
    const c = items[i].content;
    if (k <= 0 || k >= c.length) return;
    const left: TileItem = { content: c.slice(0, k), isParticle: items[i].isParticle };
    const right: TileItem = { content: c.slice(k), isParticle: false };
    onChangeItems([...items.slice(0, i), left, right, ...items.slice(i + 1)]);
    setSplitIdx(null);
  };

  return (
    <Card className="bg-white border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="py-2.5 px-4 bg-muted/30 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
              {index + 1}
            </span>
            {word && (
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
            className="h-8 w-8 flex-shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">정답 문장 (학생에게는 숨겨짐)</Label>
          {editable ? (
            <Input
              value={baseText}
              onChange={(e) => onChangeBaseText(e.target.value)}
              placeholder="정답이 되는 완성 문장"
              className="mt-1 font-medium"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted/30 text-lg font-medium mt-1">{baseText}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">번역</Label>
          {editable ? (
            <Input
              value={translation}
              onChange={(e) => onChangeTranslation(e.target.value)}
              placeholder="문장 번역 입력"
              className="mt-1"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted/30 text-sm mt-1">{translation || "(없음)"}</p>
          )}
        </div>

        {editable ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">타일 편집</Label>
              {onResegment && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResegment}
                  disabled={resegmenting}
                  className="h-7 text-xs text-primary hover:bg-primary/10"
                >
                  {resegmenting ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                  )}
                  AI 재분절
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-2 rounded-2xl bg-slate-50/80 p-3">
              {items.length === 0 ? (
                <span className="text-xs text-muted-foreground py-2">
                  문장을 입력하고 'AI 재분절'을 누르면 타일이 생성됩니다
                </span>
              ) : (
                items.map((t, i) =>
                  splitIdx === i ? (
                    <div
                      key={i}
                      className={`inline-flex items-center rounded-xl border border-primary/40 bg-white px-1 py-1 ${
                        i > 0 ? (t.isParticle ? "ml-1" : "ml-3") : ""
                      }`}
                    >
                      {Array.from(t.content).map((ch, ci) => (
                        <span key={ci} className="inline-flex items-center">
                          {ci > 0 && (
                            <button
                              type="button"
                              onClick={() => splitAt(i, ci)}
                              className="mx-0.5 h-6 w-1.5 rounded bg-primary/20 hover:bg-primary/70"
                              title="여기서 나누기"
                            />
                          )}
                          <span className="px-0.5 text-base">{ch}</span>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSplitIdx(null)}
                        className="ml-1 px-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div key={i} className={`relative group ${i > 0 ? (t.isParticle ? "ml-1" : "ml-3") : ""}`}>
                      <button
                        type="button"
                        onClick={() => toggleParticle(i)}
                        title="조사/어미 표시 토글"
                        className={`rounded-xl px-3 py-2 text-base shadow-sm border whitespace-nowrap transition-colors ${
                          t.isParticle
                            ? "bg-amber-50 text-amber-800 border-amber-300/80"
                            : "bg-white text-foreground border-slate-200"
                        }`}
                      >
                        {t.content}
                      </button>
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => mergeLeft(i)}
                          title="앞 타일과 합치기"
                          className="absolute top-1/2 -left-2 -translate-y-1/2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:text-primary hover:border-primary/50 group-hover:flex"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}
                      {t.content.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitIdx(i)}
                          title="나누기"
                          className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:text-primary hover:border-primary/50 group-hover:flex"
                        >
                          <Scissors className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                )
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              칩 클릭 = 조사/어미 토글 · 마우스를 올려 나누기(✂) / 합치기(🔗)
            </p>
          </div>
        ) : (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">타일 미리보기</Label>
            {/* 조사/어미는 앞 어간에 붙이고(작은 마진), 단어 사이만 띄움 — 실제 학생 화면과 동일 */}
            <div className="flex flex-wrap items-center gap-y-2 rounded-2xl bg-slate-50/80 p-3">
              {items.length === 0 ? (
                <span className="text-xs text-muted-foreground py-2">타일이 없습니다</span>
              ) : (
                items.map((t, i) => (
                  <span
                    key={i}
                    className={`rounded-xl px-3 py-2 text-base shadow-sm border whitespace-nowrap ${
                      i > 0 ? (t.isParticle ? "ml-1" : "ml-3") : ""
                    } ${
                      t.isParticle
                        ? "bg-amber-50 text-amber-800 border-amber-300/80"
                        : "bg-white text-foreground border-slate-200"
                    }`}
                  >
                    {t.content}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
