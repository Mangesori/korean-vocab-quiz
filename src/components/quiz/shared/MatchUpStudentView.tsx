import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface MatchUpStudentItem {
  korean_text: string;
  meaning_text: string;
}

/**
 * 짝 맞추기 학생 미리보기 — 실제 퀴즈(MatchUpStage)의 "연결 전" 상태와
 * 시각적으로 동일하게 맞췄다(좌측 그린 카드 / 우측 슬레이트 카드, 좌측 정렬).
 * 색상 매칭은 실제 풀이 중에만 나타나므로 미리보기는 idle 상태를 보여준다.
 */
export function MatchUpStudentView({ problems }: { problems: MatchUpStudentItem[] }) {
  const [shuffledMeanings, setShuffledMeanings] = useState<string[]>([]);

  useEffect(() => {
    const arr = problems.map((p) => p.meaning_text);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledMeanings(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems.length]);

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white">
      <CardContent className="p-4 sm:p-8">
        <p className="text-center text-sm text-muted-foreground font-medium mb-5">단어를 탭한 뒤 알맞은 뜻을 탭하세요</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-primary/70 text-center mb-1">단어</p>
            {problems.map((p, i) => (
              <div
                key={i}
                className="w-full flex items-center rounded-2xl border-2 border-primary/25 bg-primary/5 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] font-bold text-sm sm:text-lg text-foreground break-keep"
              >
                {p.korean_text}
              </div>
            ))}
          </div>
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 text-center mb-1">뜻</p>
            {shuffledMeanings.map((m, i) => (
              <div
                key={i}
                className="w-full flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4 sm:py-4 min-h-[3rem] sm:min-h-[4rem] text-sm sm:text-base text-foreground break-keep"
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
