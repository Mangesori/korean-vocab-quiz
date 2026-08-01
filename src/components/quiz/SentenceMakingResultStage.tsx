import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { renderSentenceWithDiff, renderModelAnswerWithDiff } from "@/components/quiz/quizResultUtils";

interface SentenceAttempt {
  attemptNumber: number;
  sentence: string;
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
}


interface SentenceMakingProblem {
  id: string;
  word: string;
  translation?: string;
}

interface SentenceMakingResultStageProps {
  problems: SentenceMakingProblem[];
  results: Record<string, SentenceAttempt[]>;
  onNext: () => void;
  nextLabel: string;
  /** 라이브 세션에서 선생님이 학생 결과를 그대로 볼 때, 학생용 이동 버튼은 숨긴다. */
  hideActions?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export function SentenceMakingResultStage({
  problems,
  results,
  onNext,
  nextLabel,
  hideActions,
  onBack,
  backLabel,
}: SentenceMakingResultStageProps) {
  const totalScore = problems.reduce((sum, p) => {
    const attempt = results[p.id]?.[0];
    return sum + (attempt?.totalScore || 0);
  }, 0);
  const avgScore = problems.length > 0 ? Math.round(totalScore / problems.length) : 0;
  const passedCount = problems.filter((p) => results[p.id]?.[0]?.isPassed).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* 상단 요약 라벨/카드 */}
      <div className="flex flex-col items-center justify-center py-6 mb-8">
        <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{avgScore}점</p>
        <p className="text-lg font-medium text-slate-600 mt-3">
          {problems.length}문제 중 <span className="text-primary font-bold">{passedCount}</span>문제를 맞혔어요!
        </p>
      </div>

      {/* 문제별 결과 목록 */}
      <div className="space-y-4">
        {problems.map((problem, idx) => {
          const attempt = results[problem.id]?.[0];
          if (!attempt) return null;

          const isPerfect = attempt.totalScore === 100;
          const isGood = isPerfect || attempt.isPassed;

          return (
            <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                        isGood ? "bg-success" : "bg-primary"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Badge variant="outline" className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700">
                      {problem.word}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {attempt.isPassed ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-warning" />
                    )}
                  </div>
                </div>
                
                <div className="mb-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 ${
                       isGood ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"
                    }`}>
                      내 답변
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed">
                      {renderSentenceWithDiff(attempt.sentence, attempt.modelAnswer,
                        isPerfect || !attempt.modelAnswer || attempt.sentence.trim() === attempt.modelAnswer.trim()
                      )}
                    </h3>
                  </div>

                  {(!isPerfect && attempt.modelAnswer && attempt.modelAnswer.trim() !== attempt.sentence.trim()) && (
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                        추천 문장
                      </span>
                      <h3 className="text-lg leading-relaxed">
                        {renderModelAnswerWithDiff(attempt.modelAnswer, attempt.sentence)}
                      </h3>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {attempt.feedback?.replace(/Model Answer:\s*.*/i, '')?.trim()}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 다음 단계 버튼 */}
      {!hideActions && (
      <div className="flex justify-between items-center mt-8 pt-4">
        {onBack ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {backLabel ?? "이전"}
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={onNext}
          className="h-12 px-6 text-base shadow-md font-semibold bg-primary hover:bg-primary/90 transition-colors rounded-xl"
        >
          {nextLabel}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
      )}
    </div>
  );
}
