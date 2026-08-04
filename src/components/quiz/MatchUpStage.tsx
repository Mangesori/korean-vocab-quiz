import { useState, useEffect, useMemo, useRef } from "react";
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
  wordsPerSet?: number;
  // 세트당 제한 시간이 다 됐을 때 QuizTake가 증가시키는 카운터. 값이 바뀔 때마다(마운트 시
  // 최초 값은 무시) 안 맞춘 짝이 있어도 강제로 다음 세트로 넘기거나(마지막 세트면) 제출한다.
  timeUpToken?: number;
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

export function MatchUpStage({ problems, wordsPerSet = 5, timeUpToken, onProgressUpdate, onComplete, onBack, backLabel }: MatchUpStageProps) {
  const [currentSetIndex, setCurrentSetIndex] = useState(0);

  // 문제를 세트 단위로 분할
  const problemSets = useMemo(() => {
    return Array.from({ length: Math.ceil(problems.length / wordsPerSet) }, (_, i) =>
      problems.slice(i * wordsPerSet, (i + 1) * wordsPerSet)
    );
  }, [problems, wordsPerSet]);

  const currentSet = problemSets[currentSetIndex] || [];
  const totalSets = problemSets.length;

  // 세트가 변경될 때만 보기 셔플 (currentSetIds 문자열로 의도적 고정)
  const currentSetIds = currentSet.map((p) => p.id).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leftItems = useMemo(() => shuffle(currentSet), [currentSetIds]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rightItems = useMemo(() => shuffle(currentSet), [currentSetIds]);

  // matches: 좌 problemId → 우(뜻) problemId
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);

  const currentSetMatched = currentSet.length > 0 && currentSet.every((p) => matches[p.id]);
  const allMatched = Object.keys(matches).length === problems.length && problems.length > 0;

  useEffect(() => {
    if (!onProgressUpdate) return;
    const startNum = currentSetIndex * wordsPerSet + 1;
    const endNum = Math.min((currentSetIndex + 1) * wordsPerSet, problems.length);
    const label = startNum === endNum ? `${startNum}/${problems.length}` : `${startNum}-${endNum}/${problems.length}`;
    onProgressUpdate(currentSetIndex + 1, totalSets, label);
  }, [currentSetIndex, totalSets, problems.length, wordsPerSet, onProgressUpdate]);

  const handleNextSet = () => {
    if (currentSetIndex < totalSets - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

  const handlePrevSet = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1);
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

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

  // force: 시간 초과로 강제 제출할 때 안 맞춘 짝이 있어도 진행한다(짝 없는 문제는 자동 오답 처리).
  const handleSubmit = (force = false) => {
    if (!force && !allMatched) return;
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

  // 세트당 제한 시간 초과 처리. prevTimeUpToken은 마운트 시 받은 초기값(다른 스테이지에서
  // 이미 증가해 있던 값일 수 있음)을 기준으로 삼아, 이후 "진짜 증가"에만 반응한다.
  const prevTimeUpTokenRef = useRef(timeUpToken ?? 0);
  useEffect(() => {
    const prev = prevTimeUpTokenRef.current;
    const current = timeUpToken ?? 0;
    prevTimeUpTokenRef.current = current;
    if (current <= prev) return;

    if (currentSetIndex < totalSets - 1) {
      handleNextSet();
    } else {
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUpToken]);

  const tileClass = (state: "matched" | "selected" | "left" | "right") => {
    const base =
      "w-full flex items-center justify-center rounded-2xl border-2 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] text-center transition-all";
    switch (state) {
      case "matched":
        return `${base} border-success bg-success/10`;
      case "selected":
        return `${base} border-primary ring-2 ring-primary/40 bg-primary/20 shadow-sm`;
      case "left":
        return `${base} border-primary/25 bg-primary/5 hover:border-primary/50`;
      case "right":
        return `${base} border-slate-200 bg-slate-50/80 hover:border-primary/40`;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white mt-4">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base lg:text-lg text-foreground font-bold">
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
          {currentSetIndex === 0 ? (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={!onBack}
              className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">{backLabel ?? "이전"}</span>
            <span className="sm:hidden">이전</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handlePrevSet}
              className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> 이전 세트
            </Button>
          )}

          {currentSetIndex < totalSets - 1 ? (
            <Button
              onClick={handleNextSet}
              disabled={!currentSetMatched}
              className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
            >
              다음 세트 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit()}
              disabled={!allMatched}
              className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
            >
              결과 확인 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
