import { useState, useEffect, useMemo } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { assembleForDisplay } from "@/lib/korean/wordMagnet";
import { WordMagnetTile } from "@/components/quiz/shared/WordMagnetTile";

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
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (answers: Record<string, string>) => void;
  onBack?: () => void;
  backLabel?: string;
}

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

function DroppableArea({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      {children}
    </div>
  );
}

export function WordMagnetStage({ problems, onProgressUpdate, onComplete, onBack, backLabel }: WordMagnetStageProps) {
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
  const [questionItems, setQuestionItems] = useState<Tile[]>([]);
  // 문제별로 배치한 답(타일 배열) 저장
  const [savedAnswers, setSavedAnswers] = useState<Record<string, Tile[]>>({});
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const total = problems.length;
  const currentProblem = problems[currentIndex];

  // 문제 전환 시 현재 문제의 타일 구성 로드
  useEffect(() => {
    if (!currentProblem) return;
    const all = tilesByProblem[currentProblem.id] || [];
    const saved = savedAnswers[currentProblem.id];
    if (saved && saved.length > 0) {
      const usedIds = new Set(saved.map((t) => t.id));
      setAnswerItems(saved);
      setQuestionItems(shuffle(all.filter((t) => !usedIds.has(t.id))));
    } else {
      setAnswerItems([]);
      setQuestionItems(shuffle(all));
    }
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

  const handleTap = (tile: Tile) => {
    const inAnswer = answerItems.some((t) => t.id === tile.id);
    if (inAnswer) {
      const newA = answerItems.filter((t) => t.id !== tile.id);
      setAnswerItems(newA);
      setQuestionItems((q) => [...q, tile]);
      persistCurrent(newA);
    } else {
      const newA = [...answerItems, tile];
      setQuestionItems((q) => q.filter((t) => t.id !== tile.id));
      setAnswerItems(newA);
      persistCurrent(newA);
    }
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overId = String(over.id);

    const fromAnswer = answerItems.some((t) => t.id === activeIdStr);
    const overItemInAnswer = answerItems.find((t) => t.id === overId);

    if (!fromAnswer) {
      // 은행 → 답 영역
      if (overId === "answer-area" || overItemInAnswer) {
        const tile = questionItems.find((t) => t.id === activeIdStr);
        if (!tile) return;
        const newQ = questionItems.filter((t) => t.id !== activeIdStr);
        const newA = [...answerItems];
        if (overItemInAnswer) {
          const idx = newA.findIndex((t) => t.id === overId);
          newA.splice(idx, 0, tile);
        } else {
          newA.push(tile);
        }
        setQuestionItems(newQ);
        setAnswerItems(newA);
        persistCurrent(newA);
      }
    } else {
      // 답 영역에서
      if (overId === "question-area") {
        const tile = answerItems.find((t) => t.id === activeIdStr)!;
        const newA = answerItems.filter((t) => t.id !== activeIdStr);
        setAnswerItems(newA);
        setQuestionItems((q) => [...q, tile]);
        persistCurrent(newA);
      } else if (overItemInAnswer && activeIdStr !== overId) {
        const oldIdx = answerItems.findIndex((t) => t.id === activeIdStr);
        const newIdx = answerItems.findIndex((t) => t.id === overId);
        const arr = [...answerItems];
        const [m] = arr.splice(oldIdx, 1);
        arr.splice(newIdx, 0, m);
        setAnswerItems(arr);
        persistCurrent(arr);
      }
    }
  };

  const goPrev = () => { if (currentIndex > 0) setCurrentIndex((i) => i - 1); };
  const goNext = () => { if (currentIndex < total - 1) setCurrentIndex((i) => i + 1); };

  const allAnswered = problems.every((p) => {
    const saved = p.id === currentProblem?.id ? answerItems : savedAnswers[p.id];
    return saved && saved.length > 0;
  });

  const handleSubmit = () => {
    if (!allAnswered) return;
    const answers: Record<string, string> = {};
    problems.forEach((p) => {
      const tiles = p.id === currentProblem.id ? answerItems : savedAnswers[p.id] || [];
      answers[p.id] = assembleForDisplay(tiles);
    });
    onComplete(answers);
  };

  const activeTile = [...questionItems, ...answerItems].find((t) => t.id === activeId);
  const currentAnswered = answerItems.length > 0;

  if (!currentProblem) return null;

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          단어를 끌거나 탭해서 문장을 완성하세요
        </p>

        {/* 프롬프트(번역) */}
        <div className="p-5 sm:p-6 bg-slate-50 rounded-2xl text-center">
          <p className="text-lg sm:text-xl font-semibold text-foreground break-keep">{currentProblem.translation}</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 답 영역 */}
          <p className="text-xs font-semibold text-primary/70 mb-1.5">내 문장</p>
          <DroppableArea
            id="answer-area"
            className="min-h-[72px] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center content-start gap-y-2"
          >
            {answerItems.length === 0 && (
              <span className="text-sm text-muted-foreground px-1">아래 단어를 탭하거나 끌어다 놓으세요</span>
            )}
            {answerItems.map((tile, idx) => (
              <div key={tile.id} className={idx > 0 ? (tile.isParticle ? "ml-1" : "ml-3") : ""}>
                <DraggableTile tile={tile} onTap={handleTap} />
              </div>
            ))}
          </DroppableArea>

          {/* 단어 은행 */}
          <p className="text-xs font-semibold text-slate-400 mt-4 mb-1.5">단어 은행</p>
          <DroppableArea
            id="question-area"
            className="min-h-[72px] rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-3 flex flex-wrap items-start gap-2"
          >
            {questionItems.map((tile) => (
              <DraggableTile key={tile.id} tile={tile} onTap={handleTap} />
            ))}
          </DroppableArea>

          <DragOverlay>{activeTile ? <TileBox tile={activeTile} /> : null}</DragOverlay>
        </DndContext>

        {/* 네비게이션 */}
        <div className="flex justify-between items-center pt-2">
          {currentIndex === 0 ? (
            onBack ? (
              <Button
                variant="outline"
                onClick={onBack}
                className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
              </Button>
            ) : (
              <span />
            )
          ) : (
            <Button
              variant="outline"
              onClick={goPrev}
              className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> 이전
            </Button>
          )}

          {currentIndex < total - 1 ? (
            <Button
              onClick={goNext}
              disabled={!currentAnswered}
              className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
            >
              다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
            >
              확인 <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
