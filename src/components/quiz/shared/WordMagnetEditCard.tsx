import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Trash2, Scissors, Link2, Sparkles, RefreshCw, GripVertical, MoreHorizontal } from "lucide-react";
import { unmaskTranslation } from "@/utils/maskTranslation";

export interface TileItem {
  content: string;
  isParticle: boolean;
}

/**
 * 문장 순서 맞추기 편집 카드(정답 문장 + 번역 + 타일).
 * 타일(items)은 source of truth — AI 분절 결과를 교사가 칩 UI로 직접 조정한다.
 * - isParticle: 앞 타일에 붙는 문법 형태소(조사/어미) — 회색 타일.
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
  /** 문제 재생성(선택) — 빈칸 채우기와 무관하게 완전히 새 문장으로 교체 */
  onRegenerateProblem?: () => void;
  regeneratingProblem?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  dragHandleProps?: { attributes: any; listeners: any };
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
  onRegenerateProblem,
  regeneratingProblem = false,
  onDelete,
  deleting = false,
  dragHandleProps,
}: WordMagnetEditCardProps) {
  const [splitIdx, setSplitIdx] = useState<number | null>(null);
  // 합치기 미리보기: mergePreviewIdx === i 이면 items[i-1]+items[i]를 점선으로 묶어 보여줌 (확정 전)
  const [mergePreviewIdx, setMergePreviewIdx] = useState<number | null>(null);
  // 방금 합친 동작 하나만 되돌릴 수 있도록 직전 상태 스냅샷 보관
  const [lastMerge, setLastMerge] = useState<TileItem[] | null>(null);
  // 16-5 · 모바일 진입 경로 — 호버가 없으므로 탭하면 이 타일에 대한 액션 시트를 연다.
  // 시트 자체는 아무 로직도 갖지 않고 splitIdx/mergePreviewIdx를 그대로 세팅할 뿐 —
  // 이후 렌더링은 데스크톱과 동일한 분기(splitIdx === i / mergePreviewIdx === i)를 탄다.
  const [mobileActionIdx, setMobileActionIdx] = useState<number | null>(null);

  const toggleParticle = (i: number) => {
    setLastMerge(null);
    onChangeItems(items.map((it, idx) => (idx === i ? { ...it, isParticle: !it.isParticle } : it)));
  };

  const mergeLeft = (i: number) => {
    if (i <= 0) return;
    const merged: TileItem = {
      content: items[i - 1].content + items[i].content,
      isParticle: items[i - 1].isParticle,
    };
    setLastMerge(items);
    onChangeItems([...items.slice(0, i - 1), merged, ...items.slice(i + 1)]);
    setMergePreviewIdx(null);
  };

  const undoLastMerge = () => {
    if (!lastMerge) return;
    onChangeItems(lastMerge);
    setLastMerge(null);
  };

  const splitAt = (i: number, k: number) => {
    const c = items[i].content;
    if (k <= 0 || k >= c.length) return;
    const left: TileItem = { content: c.slice(0, k), isParticle: items[i].isParticle };
    // 오른쪽 조각은 원래 타일의 조사 표시를 이어받는다 — 조사를 떼어내려는 분할이 대부분이라
    // "나누기 → 조사 다시 켜기" 두 단계를 한 번으로 줄인다.
    const right: TileItem = { content: c.slice(k), isParticle: items[i].isParticle };
    setLastMerge(null);
    onChangeItems([...items.slice(0, i), left, right, ...items.slice(i + 1)]);
    setSplitIdx(null);
  };

  return (
    <Card className="bg-white border-[#EBE5DE] hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-[#F4F0EA]">
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
            {word && (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold truncate">
                {word}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onRegenerateProblem && (
              <Button
                variant="default"
                size="sm"
                onClick={onRegenerateProblem}
                disabled={regeneratingProblem}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {regeneratingProblem ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                문제 재생성
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                disabled={deleting}
                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">정답 문장 (학생에게는 숨겨짐)</Label>
          {editable ? (
            <Input
              value={baseText}
              onChange={(e) => onChangeBaseText(e.target.value)}
              placeholder="정답이 되는 완성 문장"
              className="font-medium"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-lg font-lg">{baseText}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">번역</Label>
          {editable ? (
            <Input
              value={translation}
              onChange={(e) => onChangeTranslation(e.target.value)}
              placeholder="문장 번역 입력"
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted text-sm">{unmaskTranslation(translation) || "(없음)"}</p>
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
            <div className="flex flex-wrap items-center gap-y-2 rounded-2xl bg-[#FAF8F5]/80 p-3">
              {items.length === 0 ? (
                <span className="text-xs text-muted-foreground py-2">
                  문장을 입력하고 'AI 재분절'을 누르면 타일이 생성됩니다
                </span>
              ) : (
                items.map((t, i) => {
                  // 합치기 미리보기 중인 뒤 타일(i)에 흡수되는 앞 타일(i-1)은 따로 그리지 않음
                  if (mergePreviewIdx === i + 1) return null;

                  const tileMarginClass = i > 0 ? (t.isParticle ? "ml-1" : "ml-3") : "";

                  // 6b · 합치기 미리보기 — 확정 전까지는 점선 테두리 + 고리 아이콘으로만 보여줌
                  if (mergePreviewIdx === i && i > 0) {
                    const prev = items[i - 1];
                    const prevMarginClass = i - 1 > 0 ? (prev.isParticle ? "ml-1" : "ml-3") : "";
                    const tileClass = (particle: boolean) =>
                      `rounded-xl px-3 py-2 text-base shadow-sm border whitespace-nowrap ${
                        particle
                          ? "bg-[#F4F0EA] text-[#8A837D] border-[#EBE5DE]"
                          : "bg-white text-foreground border-[#EBE5DE]"
                      }`;
                    return (
                      <div
                        key={i}
                        className={`inline-flex items-center rounded-xl border-[1.5px] border-dashed border-primary bg-[#F4F9F6] p-1 ${prevMarginClass}`}
                      >
                        <span className={tileClass(prev.isParticle)}>{prev.content}</span>
                        <button
                          type="button"
                          onClick={() => mergeLeft(i)}
                          title="여기서 합치기 확정"
                          className="mx-[-4px] z-[1] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                        <span className={tileClass(t.isParticle)}>{t.content}</span>
                        <button
                          type="button"
                          onClick={() => setMergePreviewIdx(null)}
                          className="ml-1 px-1 text-[11px] text-[#6B6460] hover:text-foreground"
                        >
                          취소
                        </button>
                      </div>
                    );
                  }

                  // 6a · 나누기 2단계 — 글자 사이 막대 후보를 보여주고, 누른 자리에서만 실제로 갈라짐
                  if (splitIdx === i) {
                    return (
                      <div
                        key={i}
                        className={`inline-flex items-center rounded-[10px] border-[1.5px] border-primary bg-[#F4F9F6] px-[7px] py-[5px] ${tileMarginClass}`}
                      >
                        {Array.from(t.content).map((ch, ci) => (
                          <span key={ci} className="inline-flex items-center">
                            {ci > 0 && (
                              <button
                                type="button"
                                onClick={() => splitAt(i, ci)}
                                className="mx-0.5 h-[26px] w-1 rounded-[2px] bg-[#B7D3C4] transition-colors hover:bg-primary hover:ring-[3px] hover:ring-primary/30"
                                title="여기서 나누기"
                              />
                            )}
                            <span className="px-0.5 text-base">{ch}</span>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSplitIdx(null)}
                          className="ml-1 px-1 text-[11px] text-[#6B6460] hover:text-foreground"
                        >
                          취소
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className={`relative group ${tileMarginClass}`}>
                      <button
                        type="button"
                        onClick={() => toggleParticle(i)}
                        title="조사/어미 표시 토글"
                        className={`rounded-xl px-3 py-2 text-base shadow-sm border whitespace-nowrap transition-colors ${
                          t.isParticle
                            ? "bg-[#F4F0EA] text-[#8A837D] border-[#EBE5DE]"
                            : "bg-white text-foreground border-[#EBE5DE]"
                        }`}
                      >
                        {t.content}
                      </button>
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMergePreviewIdx(i);
                            setSplitIdx(null);
                          }}
                          title="앞 타일과 합치기"
                          className="absolute top-1/2 -left-2 -translate-y-1/2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-[#E3DCD3] bg-white text-[#8A837D] shadow-sm hover:text-primary hover:border-primary/50 sm:group-hover:flex"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}
                      {t.content.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSplitIdx(i);
                            setMergePreviewIdx(null);
                          }}
                          title="나누기"
                          className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-[#E3DCD3] bg-white text-[#8A837D] shadow-sm hover:text-primary hover:border-primary/50 sm:group-hover:flex"
                        >
                          <Scissors className="w-3 h-3" />
                        </button>
                      )}
                      {/* 모바일 전용 진입 경로 — 호버가 없으니 항상 보이는 작은 더보기 버튼으로 하단 시트를 연다 */}
                      {(i > 0 || t.content.length > 1) && (
                        <button
                          type="button"
                          onClick={() => setMobileActionIdx(i)}
                          title="타일 조작"
                          className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#E3DCD3] bg-white text-[#8A837D] shadow-sm sm:hidden"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <Sheet open={mobileActionIdx !== null} onOpenChange={(open) => !open && setMobileActionIdx(null)}>
              <SheetContent side="bottom" className="rounded-t-2xl sm:hidden">
                <SheetHeader>
                  <SheetTitle className="text-base">
                    {mobileActionIdx !== null ? items[mobileActionIdx]?.content : ""}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col gap-2">
                  {mobileActionIdx !== null && items[mobileActionIdx]?.content.length > 1 && (
                    <Button
                      variant="outline"
                      className="justify-start h-12"
                      onClick={() => {
                        setSplitIdx(mobileActionIdx);
                        setMergePreviewIdx(null);
                        setMobileActionIdx(null);
                      }}
                    >
                      <Scissors className="w-4 h-4 mr-2" />
                      나누기
                    </Button>
                  )}
                  {mobileActionIdx !== null && mobileActionIdx > 0 && (
                    <Button
                      variant="outline"
                      className="justify-start h-12"
                      onClick={() => {
                        setMergePreviewIdx(mobileActionIdx);
                        setSplitIdx(null);
                        setMobileActionIdx(null);
                      }}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      앞 타일과 합치기
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            {lastMerge && (
              <div className="flex items-center justify-between gap-2 rounded-[9px] border border-[#C8DED3] bg-[#F4F9F6] px-3 py-1.5 text-xs text-[#2C6B4C]">
                <span>방금 두 타일을 합쳤습니다.</span>
                <button
                  type="button"
                  onClick={undoLastMerge}
                  className="font-semibold text-primary hover:underline"
                >
                  되돌리기
                </button>
              </div>
            )}
            {index === 0 && (
              <p className="text-[11px] text-muted-foreground">
                칩 클릭 = 조사/어미 토글 · 마우스를 올리면 나누기(✂)·합치기(🔗) 버튼이 나타납니다 — 나누기는 자리를
                고른 뒤, 합치기는 미리보기를 확인한 뒤에 적용됩니다.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground block">타일 미리보기</Label>
            {/* 조사/어미는 앞 어간에 붙이고(작은 마진), 단어 사이만 띄움 — 실제 학생 화면과 동일 */}
            <div className="flex flex-wrap items-center gap-y-2 rounded-2xl bg-[#FAF8F5]/80 p-3">
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
                        ? "bg-[#F4F0EA] text-[#8A837D] border-[#EBE5DE]"
                        : "bg-white text-foreground border-[#EBE5DE]"
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
