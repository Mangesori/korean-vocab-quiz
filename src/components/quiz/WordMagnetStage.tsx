import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { assembleForDisplay } from "@/lib/korean/wordMagnet";
import { WordMagnetTile } from "@/components/quiz/shared/WordMagnetTile";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { unmaskTranslation } from "@/utils/maskTranslation";

interface Tile {
  id: string;
  content: string;
  isParticle: boolean;
}

export interface WordMagnetProblemData {
  id: string; // problem_id
  translation: string;
  items: { content: string; isParticle: boolean }[];
}

interface WordMagnetStageProps {
  problems: WordMagnetProblemData[];
  /** 라이브 세션 중계용. 조립 중인 문장을 문항별로 알린다.
   *  라이브가 아닐 땐 전달되지 않으므로 기존 동작에 영향이 없다. */
  onAnswerPeek?: (answers: string[], activeIndex: number, prompts: string[]) => void;
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (answers: Record<string, string>, skippedIds: string[]) => void;
  onBack?: () => void;
  backLabel?: string;
}

// 답 영역 줄 사이 간격(px) — 상단 패딩과 flex 줄 간격에 동일하게 적용해
// 밑줄 반복 주기(타일 실측 높이 + 이 값)와 항상 어긋나지 않게 한다.
const ROW_GAP_PX = 16;
// 타일 실측 전 초기 렌더용 대략값(실측되면 바로 교체됨)
const FALLBACK_TILE_HEIGHT_PX = 42;
// 밑줄을 타일 텍스트 하단에서 살짝 아래로 내리기 위한 여백(공책 줄 느낌)
const LINE_OFFSET_PX = 6;
// 답 영역에 처음부터 항상 확보해 둘 최소 줄 수(타일이 없어도 밑줄이 미리 보이도록)
const MIN_VISIBLE_ROWS = 2;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function TileBox({ tile, faded }: { tile: Tile; faded?: boolean }) {
  return <WordMagnetTile content={tile.content} isParticle={tile.isParticle} faded={faded} />;
}

function DraggableTile({ tile, onTap }: { tile: Tile; onTap: (t: Tile) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tile.id, data: tile });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onTap(tile); }}
      className="cursor-pointer touch-none"
    >
      <TileBox tile={tile} faded={isDragging} />
    </div>
  );
}

// 답 영역 타일 — sortable. 드래그하면 같은 SortableContext 안의 다른 타일이
// 실시간으로 비켜주고(auto-shift), 드롭 시 순서가 확정된다.
function SortableAnswerTile({ tile, marginClass, onTap }: { tile: Tile; marginClass: string; onTap: (t: Tile) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onTap(tile); }}
      className={`cursor-pointer touch-none ${marginClass}`}
    >
      <TileBox tile={tile} />
    </div>
  );
}

// 단어 은행에서 사용된 타일 자리에 남는 회색 빈칸(레이아웃 고정)
function TilePlaceholder({ content }: { content: string }) {
  return (
    <div className="rounded-xl px-3 py-2 text-base sm:text-lg border border-slate-200 bg-slate-100 whitespace-nowrap" aria-hidden>
      <span className="invisible">{content}</span>
    </div>
  );
}

function DroppableArea({
  id,
  className,
  style,
  children,
}: {
  id: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isOver ? "ring-2 ring-primary/30 rounded-xl" : ""}`}>
      {children}
    </div>
  );
}

export function WordMagnetStage({ problems, onAnswerPeek, onProgressUpdate, onComplete, onBack, backLabel }: WordMagnetStageProps) {
  // 문제별 타일 목록 (고유 id 부여)
  const tilesByProblem = useMemo(() => {
    const map: Record<string, Tile[]> = {};
    problems.forEach((p, pi) => {
      map[p.id] = p.items.map((it, i) => ({ id: `${pi}-${i}`, content: it.content, isParticle: it.isParticle }));
    });
    return map;
  }, [problems]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerItems, setAnswerItems] = useState<Tile[]>([]);
  // 단어 은행 표시 순서(불변). 사용된 타일은 placeholder로 남는다.
  const [bankOrder, setBankOrder] = useState<Tile[]>([]);

  // 답 영역 밑줄 간격을 타일 실측 높이에 맞추기 위한 측정용(화면에 보이지 않는) 타일
  const measureRef = useRef<HTMLDivElement>(null);
  const [measuredTileHeight, setMeasuredTileHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (measureRef.current) {
      setMeasuredTileHeight(measureRef.current.getBoundingClientRect().height);
    }
  }, []);
  const rowCycle = (measuredTileHeight ?? FALLBACK_TILE_HEIGHT_PX) + ROW_GAP_PX;
  const ruledLines = `repeating-linear-gradient(to bottom, transparent 0, transparent ${rowCycle - 1}px, hsl(var(--border)) ${rowCycle - 1}px, hsl(var(--border)) ${rowCycle}px)`;
  // 타일이 하나도 없어도 공책처럼 줄이 미리 보이도록 최소 줄 수만큼 높이를 확보
  const minAnswerAreaHeight = MIN_VISIBLE_ROWS * rowCycle + LINE_OFFSET_PX;
  // 문제별로 배치한 답(타일 배열) 저장
  const [savedAnswers, setSavedAnswers] = useState<Record<string, Tile[]>>({});
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // 라이브 중계: 지금까지 조립한 문장을 문항별로 알린다.
  // 현재 문항은 화면의 타일(answerItems), 나머지는 저장된 타일에서 만든다.
  useEffect(() => {
    if (!onAnswerPeek) return;
    onAnswerPeek(
      problems.map((p, i) =>
        assembleForDisplay(i === currentIndex ? answerItems : savedAnswers[p.id] ?? [])
      ),
      currentIndex,
      problems.map((p) => p.translation ?? "")
    );
  }, [answerItems, savedAnswers, currentIndex, problems, onAnswerPeek]);

  const total = problems.length;
  const currentProblem = problems[currentIndex];

  // 문제 전환 시 현재 문제의 타일 구성 로드
  useEffect(() => {
    if (!currentProblem) return;
    const all = tilesByProblem[currentProblem.id] || [];
    const saved = savedAnswers[currentProblem.id];
    setBankOrder(shuffle(all));
    setAnswerItems(saved && saved.length > 0 ? saved : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentProblem?.id]);

  useEffect(() => {
    onProgressUpdate?.(currentIndex + 1, total, `${currentIndex + 1}/${total}`);
  }, [currentIndex, total, onProgressUpdate]);

  const persistCurrent = (answer: Tile[]) => {
    setSavedAnswers((prev) => ({ ...prev, [currentProblem.id]: answer }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const unskipCurrent = () => {
    if (!currentProblem || !skippedIds.has(currentProblem.id)) return;
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.delete(currentProblem.id);
      return next;
    });
  };

  const handleTap = (tile: Tile) => {
    const inAnswer = answerItems.some((t) => t.id === tile.id);
    const newA = inAnswer
      ? answerItems.filter((t) => t.id !== tile.id)
      : [...answerItems, tile];
    setAnswerItems(newA);
    persistCurrent(newA);
    unskipCurrent();
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    unskipCurrent();
    const activeIdStr = String(active.id);
    const overId = String(over.id);

    const fromAnswer = answerItems.some((t) => t.id === activeIdStr);
    const overItemInAnswer = answerItems.find((t) => t.id === overId);

    if (!fromAnswer) {
      // 은행 → 답 영역
      if (overId === "answer-area" || overItemInAnswer) {
        const tile = bankOrder.find((t) => t.id === activeIdStr);
        if (!tile) return;
        const newA = [...answerItems];
        if (overItemInAnswer) {
          const idx = newA.findIndex((t) => t.id === overId);
          newA.splice(idx, 0, tile);
        } else {
          newA.push(tile);
        }
        setAnswerItems(newA);
        persistCurrent(newA);
      }
    } else {
      // 답 영역에서
      if (overId === "question-area") {
        const newA = answerItems.filter((t) => t.id !== activeIdStr);
        setAnswerItems(newA);
        persistCurrent(newA);
      } else if (overItemInAnswer && activeIdStr !== overId) {
        const oldIdx = answerItems.findIndex((t) => t.id === activeIdStr);
        const newIdx = answerItems.findIndex((t) => t.id === overId);
        const arr = arrayMove(answerItems, oldIdx, newIdx);
        setAnswerItems(arr);
        persistCurrent(arr);
      }
    }
  };

  const goPrev = () => { if (currentIndex > 0) setCurrentIndex((i) => i - 1); };
  const goNext = () => { if (currentIndex < total - 1) setCurrentIndex((i) => i + 1); };

  const allAnswered = problems.every((p) => {
    if (skippedIds.has(p.id)) return true;
    const saved = p.id === currentProblem?.id ? answerItems : savedAnswers[p.id];
    return saved && saved.length > 0;
  });

  const handleSubmit = () => {
    if (!allAnswered) return;
    const answers: Record<string, string> = {};
    problems.forEach((p) => {
      const tiles = p.id === currentProblem.id ? answerItems : savedAnswers[p.id] || [];
      answers[p.id] = skippedIds.has(p.id) ? "" : assembleForDisplay(tiles);
    });
    onComplete(answers, Array.from(skippedIds));
  };

  const handleSkip = () => {
    const next = new Set(skippedIds);
    next.add(currentProblem.id);
    setSkippedIds(next);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      const answers: Record<string, string> = {};
      problems.forEach((p) => {
        const tiles = p.id === currentProblem.id ? answerItems : savedAnswers[p.id] || [];
        answers[p.id] = next.has(p.id) ? "" : assembleForDisplay(tiles);
      });
      onComplete(answers, Array.from(next));
    }
  };

  const activeTile = bankOrder.find((t) => t.id === activeId);
  const isCurrentSkipped = skippedIds.has(currentProblem?.id);
  const currentAnswered = answerItems.length > 0 || isCurrentSkipped;

  if (!currentProblem) return null;

  const skipButton = (
    <button
      type="button"
      onClick={handleSkip}
      className={`inline-block text-sm rounded px-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isCurrentSkipped
          ? "text-foreground font-semibold"
          : "text-muted-foreground font-medium hover:text-foreground hover:scale-110"
      }`}
    >
      {isCurrentSkipped ? "모르겠어요 (선택됨)" : "모르겠어요"}
    </button>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white mt-4">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <QuizStageHeader instruction="단어를 끌거나 탭해서 문장을 완성하세요" />

        {/* 프롬프트(번역) — 회색 박스는 "읽을 재료"만 */}
        <div className="p-5 sm:p-6 bg-slate-50 rounded-2xl text-center">
          <p className="text-lg sm:text-xl font-semibold text-foreground break-keep">{unmaskTranslation(currentProblem.translation)}</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 답 영역 — 밑줄 라인(타일 실측 높이에 맞춘 반복 주기) */}
          <DroppableArea
            id="answer-area"
            className="px-1 pb-0 flex flex-wrap content-start items-end"
            style={{
              backgroundImage: ruledLines,
              backgroundPosition: `0 ${LINE_OFFSET_PX}px`,
              paddingTop: ROW_GAP_PX,
              rowGap: ROW_GAP_PX,
              minHeight: minAnswerAreaHeight,
            }}
          >
            {/* 화면에는 보이지 않는 측정용 타일 — 실제 타일과 동일한 높이를 갖도록 같은 컴포넌트를 재사용 */}
            <div
              ref={measureRef}
              aria-hidden
              style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", top: -9999, left: -9999 }}
            >
              <WordMagnetTile content="측정" isParticle={false} />
            </div>
            <SortableContext items={answerItems.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
              {answerItems.map((tile, idx) => (
                <SortableAnswerTile
                  key={tile.id}
                  tile={tile}
                  marginClass={idx > 0 ? (tile.isParticle ? "ml-1" : "ml-3") : ""}
                  onTap={handleTap}
                />
              ))}
            </SortableContext>
          </DroppableArea>

          {/* 단어 은행 — 사용한 타일은 회색 빈칸으로 */}
          <DroppableArea
            id="question-area"
            className="mt-10 min-h-[64px] flex flex-wrap items-start gap-2.5"
          >
            {bankOrder.map((tile) =>
              answerItems.some((a) => a.id === tile.id) ? (
                <TilePlaceholder key={tile.id} content={tile.content} />
              ) : (
                <DraggableTile key={tile.id} tile={tile} onTap={handleTap} />
              )
            )}
          </DroppableArea>

          <DragOverlay>{activeTile ? <TileBox tile={activeTile} /> : null}</DragOverlay>
        </DndContext>

        {/* 네비게이션 */}
        <div className="grid grid-cols-3 items-center pt-2 gap-2">
          <div className="justify-self-start min-w-0 max-w-full">
            {currentIndex === 0 && onBack ? (
              <Button
                variant="outline"
                onClick={onBack}
                className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">{backLabel ?? "이전"}</span>
            <span className="sm:hidden">이전</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> 이전
              </Button>
            )}
          </div>

          <div className="flex justify-center">{skipButton}</div>

          <div className="justify-self-end min-w-0">
            {currentIndex < total - 1 ? (
              <Button
                onClick={goNext}
                disabled={!currentAnswered}
                className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
              >
                다음 문제 <ChevronRight className="w-4 h-4 ml-1.5 sm:ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
              >
                결과 확인 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
