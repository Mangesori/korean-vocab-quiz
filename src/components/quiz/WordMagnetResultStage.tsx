import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, ChevronLeft } from "lucide-react";

export interface WordMagnetGradeResult {
  problemId: string;
  translation: string;
  correctSentence: string;
  userSentence: string;
  isCorrect: boolean;
}

interface WordMagnetResultStageProps {
  results: WordMagnetGradeResult[];
  onNext: () => void;
  nextLabel: string;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * 문장 순서 맞추기 결과 — 빈칸 채우기(QuizReviewCard)·문장 만들기 결과와 동일한
 * 카드 패턴으로 통일: 번호 배지(정답=success/오답=destructive) + 영문 번역 배지 +
 * 우측 상태 아이콘, 아래 '내 답변 / 정답' 라벨 행.
 */
export function WordMagnetResultStage({ results, onNext, nextLabel, onBack, backLabel }: WordMagnetResultStageProps) {
  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* 상단 요약 — 다른 결과 화면과 동일 */}
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{score}점</p>
        <p className="text-lg font-medium text-slate-600 mt-3">
          {total}문제 중 <span className="text-primary font-bold">{correctCount}</span>문제를 맞혔어요!
        </p>
      </div>

      {/* 문제별 결과 카드 */}
      <div className="space-y-4">
        {results.map((r, idx) => (
          <Card key={r.problemId} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                      r.isCorrect ? "bg-success" : "bg-destructive"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-md break-keep">
                    {r.translation}
                  </span>
                </div>
                {r.isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
              </div>

              {r.isCorrect ? (
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                    정답
                  </span>
                  <p className="text-lg font-bold leading-relaxed text-foreground break-keep">{r.correctSentence}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-destructive/10 text-destructive">
                      내 답변
                    </span>
                    <p className="text-lg font-bold leading-relaxed text-destructive line-through break-keep">
                      {r.userSentence || "—"}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                      정답
                    </span>
                    <p className="text-lg font-bold leading-relaxed text-primary break-keep">{r.correctSentence}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 다음 단계 */}
      <div className="flex justify-between items-center mt-8 pt-4">
        {onBack ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> {backLabel ?? "이전"}
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={onNext}
          className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
        >
          {nextLabel} <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
