import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WordMagnetTile } from "@/components/quiz/shared/WordMagnetTile";

export interface WordMagnetStudentItem {
  translation: string | null;
  items: Array<{ content: string; isParticle: boolean }>;
}

/**
 * 문장 순서 맞추기 학생 미리보기(한 문제씩 캐러셀).
 * 실제 퀴즈(WordMagnetStage)의 "연결 전" idle 화면과 동일하게 — "내 문장"(빈 영역) +
 * "단어 은행"(셔플 타일). 타일은 공유 컴포넌트(WordMagnetTile)로 모양 일치.
 */
export function WordMagnetStudentView({ problems }: { problems: WordMagnetStudentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [shuffledItems, setShuffledItems] = useState<Array<{ content: string; isParticle: boolean }>>([]);

  useEffect(() => {
    if (previewIndex > problems.length - 1) {
      setPreviewIndex(Math.max(0, problems.length - 1));
    }
  }, [problems.length, previewIndex]);

  useEffect(() => {
    const p = problems[previewIndex];
    if (p) {
      const itemsCopy = [...(p.items || [])];
      for (let i = itemsCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsCopy[i], itemsCopy[j]] = [itemsCopy[j], itemsCopy[i]];
      }
      setShuffledItems(itemsCopy);
    } else {
      setShuffledItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, problems]);

  const problem = problems[previewIndex];
  const total = problems.length;
  if (!problem) return null;

  return (
    <Card className="w-full max-w-3xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-6 md:p-8 space-y-5">
        <p className="text-center text-sm sm:text-base text-muted-foreground font-medium">
          단어를 끌거나 탭해서 문장을 완성하세요
        </p>

        {/* 프롬프트(번역) */}
        <div className="p-5 sm:p-6 bg-slate-50 rounded-2xl text-center">
          <p className="text-lg sm:text-xl font-semibold text-foreground break-keep">{problem.translation}</p>
        </div>

        {/* 내 문장 (빈 영역) */}
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1.5">내 문장</p>
          <div className="min-h-[72px] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center content-start gap-y-2">
            <span className="text-sm text-muted-foreground px-1">아래 단어를 탭하거나 끌어다 놓으세요</span>
          </div>
        </div>

        {/* 단어 은행 */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mt-4 mb-1.5">단어 은행</p>
          <div className="min-h-[72px] rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-3 flex flex-wrap items-start gap-2">
            {shuffledItems.map((item, idx) => (
              <WordMagnetTile key={idx} content={item.content} isParticle={item.isParticle} />
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <Button
            variant="outline"
            onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
            disabled={previewIndex === 0}
            className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> 이전
          </Button>
          <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
          <Button
            onClick={() => setPreviewIndex((prev) => Math.min(total - 1, prev + 1))}
            disabled={previewIndex === total - 1}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
