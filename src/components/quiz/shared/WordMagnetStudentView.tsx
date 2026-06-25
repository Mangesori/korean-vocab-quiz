import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface WordMagnetStudentItem {
  translation: string | null;
  items: Array<{ content: string; isParticle: boolean }>;
}

/**
 * 문장 순서 맞추기 학생 미리보기(한 문제씩 캐러셀, 타일 셔플).
 * QuizPreview·QuizDetail이 동일하게 사용한다(캐러셀 디자인으로 통일).
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
    <Card className="w-full border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white">
      <CardContent className="p-0 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
        <div className="p-5 sm:p-10 bg-transparent sm:bg-slate-50 border-none rounded-2xl flex flex-col min-h-[160px] items-center justify-center">
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium mb-3 sm:mb-5 text-center">
            주어진 타일을 끌어 알맞은 문장을 만드세요
          </p>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 text-center break-keep">
            {problem.translation}
          </p>
        </div>

        {/* 셔플된 단어 마그넷 타일 목록 */}
        <div className="flex flex-wrap gap-2.5 justify-center py-4 bg-muted/20 rounded-xl px-4 min-h-[80px] items-center">
          {shuffledItems.map((item, idx) => (
            <div
              key={idx}
              className={`px-4 py-2 text-md font-semibold rounded-xl border-2 select-none shadow-sm cursor-default ${
                item.isParticle
                  ? "bg-amber-50 border-amber-300/80 text-amber-800"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              {item.content}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
            disabled={previewIndex === 0}
            className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
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
