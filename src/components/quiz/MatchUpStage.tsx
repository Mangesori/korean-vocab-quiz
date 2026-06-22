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
  selectedProblemId: string; // 학생이 연결한 뜻의 원본 problem_id
  selectedMeaning: string;
  isCorrect: boolean;
}

interface MatchUpStageProps {
  problems: MatchUpProblemData[];
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (results: Record<string, MatchUpResult>) => void;
  onBack?: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchUpStage({ problems, onProgressUpdate, onComplete, onBack }: MatchUpStageProps) {
  // 좌(한국어)·우(뜻) 각각 독립적으로 셔플
  const leftItems = useMemo(() => shuffle(problems), [problems]);
  const rightItems = useMemo(() => shuffle(problems), [problems]);

  // matches: 좌 problemId -> 우(뜻) problemId
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const matchedCount = Object.keys(matches).length;
  const total = problems.length;
  const allMatched = matchedCount === total && total > 0;

  useEffect(() => {
    onProgressUpdate?.(matchedCount, total, `${matchedCount}/${total}`);
  }, [matchedCount, total, onProgressUpdate]);

  // 우측 뜻이 어떤 좌측에 연결됐는지 역맵 (좌 problemId)
  const rightUsedBy = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(matches).forEach(([leftId, rightId]) => {
      m[rightId] = leftId;
    });
    return m;
  }, [matches]);

  // 연결 순서를 표시하기 위한 번호 부여 (좌측 problemId 기준 안정적 순서)
  const pairNumber = useMemo(() => {
    const order: Record<string, number> = {};
    leftItems.forEach((p, idx) => {
      if (matches[p.id]) order[p.id] = idx; // placeholder, 실제 번호는 아래에서
    });
    // 좌측 화면 순서대로 매칭된 항목에 1..n 부여
    let n = 1;
    const num: Record<string, number> = {};
    leftItems.forEach((p) => {
      if (matches[p.id]) {
        num[p.id] = n;
        num[matches[p.id]] = n; // 우측 동일 번호
        n++;
      }
    });
    return num;
  }, [leftItems, matches]);

  const handleLeftClick = (leftId: string) => {
    // 이미 매칭된 좌측을 누르면 해제
    if (matches[leftId]) {
      setMatches((prev) => {
        const next = { ...prev };
        delete next[leftId];
        return next;
      });
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightClick = (rightId: string) => {
    // 이미 사용된 뜻을 누르면 그 연결 해제
    const usedBy = rightUsedBy[rightId];
    if (usedBy) {
      setMatches((prev) => {
        const next = { ...prev };
        delete next[usedBy];
        return next;
      });
      return;
    }
    // 좌측이 선택된 상태에서만 연결
    if (!selectedLeft) return;
    setMatches((prev) => ({ ...prev, [selectedLeft]: rightId }));
    setSelectedLeft(null);
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

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          단어와 뜻을 연결하세요
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
                  className={`w-full flex items-center gap-2 rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 text-left transition-all ${
                    isMatched
                      ? "border-primary bg-accent"
                      : isSelected
                        ? "border-primary ring-2 ring-primary/30 bg-white"
                        : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  {isMatched && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                      {pairNumber[p.id]}
                    </span>
                  )}
                  <span className="font-bold text-sm sm:text-lg text-foreground break-keep">{p.korean_text}</span>
                </button>
              );
            })}
          </div>

          {/* 우: 뜻 */}
          <div className="space-y-2.5">
            {rightItems.map((p) => {
              const usedBy = rightUsedBy[p.id];
              const isMatched = !!usedBy;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRightClick(p.id)}
                  className={`w-full flex items-center gap-2 rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 text-left transition-all ${
                    isMatched
                      ? "border-primary bg-accent"
                      : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  {isMatched && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                      {pairNumber[p.id]}
                    </span>
                  )}
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
              <ChevronLeft className="w-4 h-4 mr-2" /> 이전
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={handleSubmit}
            disabled={!allMatched}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            확인 <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
