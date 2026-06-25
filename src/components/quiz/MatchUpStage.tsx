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

/**
 * 짝 색상 매칭 팔레트 — 한지 톤과 어울리는 저채도 5색.
 * 같은 명도·채도에서 색상(hue)만 돌려 배경과 충돌하지 않게 했다.
 * 색은 보조 스캐닝용이고, 짝의 진짜 식별자는 번호 배지다.
 * (최대 절제를 원하면 PAIR_TONES를 전부 첫 번째(green) 항목으로 두면 그린 단색 + 번호만 남는다.)
 */
const PAIR_TONES = [
  { bg: "#EAF3EE", border: "#BFD9C9", badge: "#1E6B47" }, // green
  { bg: "#E5F0EF", border: "#AECFCB", badge: "#2C7A73" }, // teal
  { bg: "#FAF1E1", border: "#E3C893", badge: "#A9772B" }, // amber
  { bg: "#F8ECE6", border: "#E0C0B0", badge: "#B0653C" }, // clay
  { bg: "#F1EAF0", border: "#CFBCCB", badge: "#86597A" }, // mauve
];
const toneFor = (n: number) => PAIR_TONES[(n - 1) % PAIR_TONES.length];

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

  const [matches, setMatches] = useState<Record<string, string>>({});
  // leftId → 짝 번호. 매칭 시점에 고정 할당되어 이후 다른 매칭에 영향받지 않는다.
  const [pairNo, setPairNo] = useState<Record<string, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // 현재 사용 중이 아닌 가장 작은 양의 정수(해제 시 빈 번호 재사용 → 1..n 유지)
  const nextFreeNumber = (used: number[]) => {
    const set = new Set(used);
    let n = 1;
    while (set.has(n)) n++;
    return n;
  };

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

  // 매칭 시점에 고정된 짝 번호를 좌·우 양쪽에 매핑 (표시 순서와 무관)
  const pairNumber = useMemo(() => {
    const num: Record<string, number> = {};
    Object.entries(matches).forEach(([leftId, rightId]) => {
      const n = pairNo[leftId];
      if (n) {
        num[leftId] = n;
        num[rightId] = n;
      }
    });
    return num;
  }, [matches, pairNo]);

  const handleLeftClick = (leftId: string) => {
    if (matches[leftId]) {
      setMatches((prev) => { const next = { ...prev }; delete next[leftId]; return next; });
      setPairNo((prev) => { const next = { ...prev }; delete next[leftId]; return next; });
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightClick = (rightId: string) => {
    const usedBy = rightUsedBy[rightId];
    if (usedBy) {
      setMatches((prev) => { const next = { ...prev }; delete next[usedBy]; return next; });
      setPairNo((prev) => { const next = { ...prev }; delete next[usedBy]; return next; });
      return;
    }
    if (!selectedLeft) return;
    const leftId = selectedLeft;
    setMatches((prev) => ({ ...prev, [leftId]: rightId }));
    setPairNo((prev) => ({ ...prev, [leftId]: nextFreeNumber(Object.values(prev)) }));
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
          단어를 탭한 뒤 알맞은 뜻을 탭하세요
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {/* 좌: 한국어 단어 */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-primary/70 text-center mb-1">단어</p>
            {leftItems.map((p) => {
              const isMatched = !!matches[p.id];
              const isSelected = selectedLeft === p.id;
              const tone = isMatched ? toneFor(pairNumber[p.id]) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleLeftClick(p.id)}
                  style={tone ? { backgroundColor: tone.bg, borderColor: tone.border } : undefined}
                  className={`w-full flex items-center gap-2 rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] text-left transition-all ${
                    isMatched
                      ? ""
                      : isSelected
                        ? "border-primary ring-2 ring-primary/40 bg-primary/10 shadow-sm"
                        : "border-primary/25 bg-primary/5 hover:border-primary/50"
                  }`}
                >
                  {isMatched && tone && (
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: tone.badge }}
                    >
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
            <p className="text-xs font-semibold text-slate-400 text-center mb-1">뜻</p>
            {rightItems.map((p) => {
              const usedBy = rightUsedBy[p.id];
              const isMatched = !!usedBy;
              const tone = isMatched ? toneFor(pairNumber[p.id]) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRightClick(p.id)}
                  style={tone ? { backgroundColor: tone.bg, borderColor: tone.border } : undefined}
                  className={`w-full flex items-center gap-2 rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] text-left transition-all ${
                    isMatched ? "" : "border-slate-200 bg-slate-50/80 hover:border-primary/40"
                  }`}
                >
                  {isMatched && tone && (
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: tone.badge }}
                    >
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
            확인 <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
