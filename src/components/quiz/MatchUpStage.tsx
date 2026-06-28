import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

export interface MatchUpProblemData {
  id: string; // problem_id
  korean_text: string;
  meaning_text: string;
}

export interface MatchUpResult {
  selectedProblemId: string;
  selectedMeaning: string;
  isCorrect: boolean;
}

interface MatchUpStageProps {
  problems: MatchUpProblemData[];
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (results: Record<string, MatchUpResult>) => void;
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

export function MatchUpStage({ problems, onProgressUpdate, onComplete, onBack, backLabel }: MatchUpStageProps) {
  const leftItems = useMemo(() => shuffle(problems), [problems]);
  const rightItems = useMemo(() => shuffle(problems), [problems]);

  // matches: 좌 problemId → 우(뜻) problemId
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);

  const matchedCount = Object.keys(matches).length;
  const total = problems.length;
  const allMatched = matchedCount === total && total > 0;

  useEffect(() => {
    onProgressUpdate?.(matchedCount, total, `${matchedCount}/${total}`);
  }, [matchedCount, total, onProgressUpdate]);

  const rightUsedBy = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(matches).forEach(([leftId, rightId]) => { m[rightId] = leftId; });
    return m;
  }, [matches]);

  const linkPair = (leftId: string, rightId: string) => {
    setMatches((prev) => ({ ...prev, [leftId]: rightId }));
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const handleLeftClick = (leftId: string) => {
    // 이미 연결된 단어 → 해제
    if (matches[leftId]) {
      setMatches((prev) => { const next = { ...prev }; delete next[leftId]; return next; });
      setSelectedLeft(null);
      setSelectedRight(null);
      return;
    }
    // 뜻이 먼저 선택돼 있으면 연결
    if (selectedRight) {
      linkPair(leftId, selectedRight);
      return;
    }
    setSelectedRight(null);
    setSelectedLeft((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightClick = (rightId: string) => {
    // 이미 사용 중인 뜻 → 해제
    const usedBy = rightUsedBy[rightId];
    if (usedBy) {
      setMatches((prev) => { const next = { ...prev }; delete next[usedBy]; return next; });
      setSelectedLeft(null);
      setSelectedRight(null);
      return;
    }
    // 단어가 먼저 선택돼 있으면 연결
    if (selectedLeft) {
      linkPair(selectedLeft, rightId);
      return;
    }
    setSelectedLeft(null);
    setSelectedRight((prev) => (prev === rightId ? null : rightId));
  };

  const handleSubmit = () => {
    if (!allMatched) return;
    const results: Record<string, MatchUpResult> = {};
    for (const p of problems) {
      const selectedProblemId = matches[p.id];
      const selected = problems.find((q) => q.id === selectedProblemId);
      results[p.id] = {
        selectedProblemId,
        selectedMeaning: selected?.meaning_text ?? "",
        isCorrect: selectedProblemId === p.id,
      };
    }
    onComplete(results);
  };

  const tileClass = (state: "matched" | "selected" | "left" | "right") => {
    const base =
      "w-full flex items-center justify-center rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] text-center transition-all";
    switch (state) {
      case "matched":
        return `${base} border-success bg-success/10`;
      case "selected":
        return `${base} border-primary ring-2 ring-primary/40 bg-primary/10 shadow-sm`;
      case "left":
        return `${base} border-primary/25 bg-primary/5 hover:border-primary/50`;
      case "right":
        return `${base} border-slate-200 bg-slate-50/80 hover:border-primary/40`;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          단어와 뜻을 짝지어 보세요
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {/* 좌: 한국어 단어 */}
          <div className="space-y-2.5">
            {leftItems.map((p) => {
              const isMatched = !!matches[p.id];
              const isSelected = selectedLeft === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleLeftClick(p.id)}
                  className={tileClass(isMatched ? "matched" : isSelected ? "selected" : "left")}
                >
                  <span className="font-bold text-sm sm:text-lg text-foreground break-keep">{p.korean_text}</span>
                </button>
              );
            })}
          </div>

          {/* 우: 뜻 */}
          <div className="space-y-2.5">
            {rightItems.map((p) => {
              const isMatched = !!rightUsedBy[p.id];
              const isSelected = selectedRight === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRightClick(p.id)}
                  className={tileClass(isMatched ? "matched" : isSelected ? "selected" : "right")}
                >
                  <span className="text-sm sm:text-base text-foreground break-keep">{p.meaning_text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          {onBack ? (
            <Button
              variant="outline"
              onClick={onBack}
              className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={handleSubmit}
            disabled={!allMatched}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            결과 확인 <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
