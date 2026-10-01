import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Trash2, Scissors, Link2, Sparkles, RefreshCw, GripVertical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { unmaskTranslation } from "@/utils/maskTranslation";
import { assembleForDisplay, stripSpaces } from "@/lib/korean/wordMagnet";

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
  /**
   * base_text 외에 정답으로 인정할 어순들. 한국어는 조사가 격을 표시해 어순이
   * 비교적 자유롭지만("어제 저는 갔어요" = "저는 어제 갔어요"), 어떤 재배열이
   * 자연스러운지는 문법 제약을 봐야 알 수 있어 자동 판정이 어렵다.
   * 그래서 선생님이 직접 골라 등록하고, 채점은 이 목록과의 일치만 본다.
   */
  acceptableOrders?: string[];
  onChangeAcceptableOrders?: (orders: string[]) => void;
  /** AI에게 허용 어순을 제안받아 목록에 합친다(선택). */
  onSuggestOrders?: () => void;
  suggestingOrders?: boolean;
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
  acceptableOrders = [],
  onChangeAcceptableOrders,
  onSuggestOrders,
  suggestingOrders = false,
  onResegment,
  resegmenting = false,
  onRegenerateProblem,
  regeneratingProblem = false,
  onDelete,
  deleting = false,
  dragHandleProps,
}: WordMagnetEditCardProps) {
  const [splitIdx, setSplitIdx] = useState<number | null>(null);
  // 방금 합친 동작 하나만 되돌릴 수 있도록 직전 상태 스냅샷 보관 — 합치기는 "앞 타일"이라는
  // 대상이 이미 확정돼 있어 나누기(분할 위치 선택)와 달리 미리보기로 물어볼 게 없다.
  // 잘못 눌러도 이 되돌리기로 바로 복구되므로 확인 단계 없이 즉시 합친다.
  const [lastMerge, setLastMerge] = useState<TileItem[] | null>(null);
  // 16-5 · 모바일 진입 경로 — 호버가 없으므로 탭하면 이 타일에 대한 액션 시트를 연다.
  const [mobileActionIdx, setMobileActionIdx] = useState<number | null>(null);
  // 허용 어순 추가 패널: 학생 화면과 같은 방식(타일을 눌러 배열)으로 직접 만들어 본다.
  const [altOpen, setAltOpen] = useState(false);
  const [altSlot, setAltSlot] = useState<number[]>([]);   // items 인덱스 순서

  const toggleParticle = (i: number) => {
    setLastMerge(null);
    onChangeItems(items.map((it, idx) => (idx === i ? { ...it, isParticle: !it.isParticle } : it)));
  };

  // 타일 구성이 바뀌면 기존 허용 어순은 더 이상 그 타일들로 만들 수 없으므로 비운다.
  // (조사 표시 토글은 내용이 그대로라 영향 없음)
  const resetAcceptableOrders = () => {
    setAltSlot([]);
    if (acceptableOrders.length > 0) onChangeAcceptableOrders?.([]);
  };

  const mergeLeft = (i: number) => {
    if (i <= 0) return;
    const merged: TileItem = {
      content: items[i - 1].content + items[i].content,
      isParticle: items[i - 1].isParticle,
    };
    setLastMerge(items);
    onChangeItems([...items.slice(0, i - 1), merged, ...items.slice(i + 1)]);
    resetAcceptableOrders();
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
    resetAcceptableOrders();
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
                  const tileMarginClass = i > 0 ? (t.isParticle ? "ml-1" : "ml-3") : "";

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
                          onClick={() => mergeLeft(i)}
                          title="앞 타일과 합치기"
                          className="absolute top-1/2 -left-2 -translate-y-1/2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-[#E3DCD3] bg-white text-[#8A837D] shadow-sm hover:text-primary hover:border-primary/50 sm:group-hover:flex"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}
                      {t.content.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitIdx(i)}
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
                        mergeLeft(mobileActionIdx);
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
            {onChangeAcceptableOrders && items.length > 1 && (
              <div className="mt-1 border-t border-dashed border-[#EAE4DC] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#6B6460]">
                    다른 정답 어순
                    {acceptableOrders.length > 0 && ` (${acceptableOrders.length}개)`}
                  </span>
                  <div className="flex items-center gap-1">
                    {onSuggestOrders && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:bg-primary/10"
                        onClick={onSuggestOrders}
                        disabled={suggestingOrders}
                      >
                        {suggestingOrders ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                        )}
                        AI 추천
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:bg-primary/10"
                      onClick={() => {
                        setAltOpen((v) => !v);
                        setAltSlot([]);
                      }}
                    >
                      {altOpen ? "닫기" : "＋ 직접 추가"}
                    </Button>
                  </div>
                </div>

                {acceptableOrders.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {acceptableOrders.map((order, oi) => (
                      <span
                        key={`${order}-${oi}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#E8F5EE] px-2 py-1 text-[13px] text-primary"
                      >
                        {order}
                        <button
                          type="button"
                          aria-label="이 어순 삭제"
                          className="text-primary/70 hover:text-primary"
                          onClick={() =>
                            onChangeAcceptableOrders(acceptableOrders.filter((_, k) => k !== oi))
                          }
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {acceptableOrders.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    여기 있는 어순은 모두 정답으로 채점돼요. AI가 제안한 것 중 어색한 게 있으면 ✕로 지워 주세요.
                  </p>
                )}

                {altOpen && (
                  <div className="mt-2 rounded-[9px] border border-dashed border-[#E3DCD3] bg-[#FCFBF9] p-2.5">
                    <div className="mb-2 flex min-h-[42px] flex-wrap items-center rounded-lg border border-[#E3DCD3] bg-white p-2">
                      {altSlot.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          아래 타일을 눌러 다른 순서로 배열하세요
                        </span>
                      ) : (
                        altSlot.map((ti, pos) => (
                          <button
                            key={`${ti}-${pos}`}
                            type="button"
                            onClick={() => setAltSlot((prev) => prev.filter((_, k) => k !== pos))}
                            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                              pos > 0 ? (items[ti].isParticle ? "ml-0.5" : "ml-2.5") : ""
                            } ${
                              items[ti].isParticle
                                ? "border-[#EBE5DE] bg-[#F4F0EA] text-[#8A837D]"
                                : "border-[#EBE5DE] bg-white"
                            }`}
                          >
                            {items[ti].content}
                          </button>
                        ))
                      )}
                    </div>

                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {items.map((t, ti) =>
                        altSlot.includes(ti) ? null : (
                          <button
                            key={ti}
                            type="button"
                            onClick={() => setAltSlot((prev) => [...prev, ti])}
                            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                              t.isParticle
                                ? "border-[#EBE5DE] bg-[#F4F0EA] text-[#8A837D]"
                                : "border-[#EBE5DE] bg-white"
                            }`}
                          >
                            {t.content}
                          </button>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={altSlot.length !== items.length}
                        onClick={() => {
                          const sentence = assembleForDisplay(altSlot.map((ti) => items[ti]));
                          if (stripSpaces(sentence) === stripSpaces(assembleForDisplay(items))) {
                            toast.error("기본 문장과 같은 순서예요.");
                            return;
                          }
                          if (acceptableOrders.some((o) => stripSpaces(o) === stripSpaces(sentence))) {
                            toast.error("이미 추가된 어순이에요.");
                            return;
                          }
                          onChangeAcceptableOrders([...acceptableOrders, sentence]);
                          setAltSlot([]);
                        }}
                      >
                        이 순서도 정답으로 추가
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        타일을 모두 배치해야 추가할 수 있어요
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {index === 0 && (
              <p className="text-[11px] text-muted-foreground">
                칩 클릭 = 조사/어미 토글 · 마우스를 올리면 나누기(✂)·합치기(🔗) 버튼이 나타납니다 — 나누기는
                자리를 고른 뒤 적용되고, 합치기는 누르는 즉시 적용됩니다(되돌리기 가능).
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
