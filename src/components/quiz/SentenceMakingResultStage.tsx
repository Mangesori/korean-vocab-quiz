import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronRight } from "lucide-react";

interface SentenceAttempt {
  attemptNumber: number;
  sentence: string;
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
}

// 학생 답변과 모범 답안을 비교하여 틀린 단어를 빨간색으로 표시
function renderSentenceWithDiff(studentSentence: string, modelAnswer: string | null | undefined, isPerfect: boolean) {
  if (isPerfect || !modelAnswer) {
    return <span className={isPerfect ? "text-success" : "text-slate-700"}>{studentSentence}</span>;
  }
  
  const studentWords = studentSentence.trim().split(/\s+/);
  const modelWords = modelAnswer.trim().split(/\s+/);
  
  return (
    <>
      {studentWords.map((word, idx) => {
        // 모범 답안에 똑같은 텍스트가 존재하는지 여부로 단순 Diff 처리
        const isCorrect = modelWords.includes(word);
        if (!isCorrect) {
          return <span key={idx} className="text-destructive font-bold mr-1.5 border-b-2 border-destructive/30 pb-0.5">{word}</span>;
        }
        return <span key={idx} className="mr-1.5 text-slate-700">{word}</span>;
      })}
    </>
  );
}

// 모범 답안에서 학생이 틀린(수정된) 부분만 파란색(Primary)으로 표시
function renderModelAnswerWithDiff(modelAnswer: string, studentSentence: string) {
  const modelWords = modelAnswer.trim().split(/\s+/);
  const studentWords = studentSentence.trim().split(/\s+/);
  
  return (
    <>
      {modelWords.map((word, idx) => {
        const isOriginal = studentWords.includes(word);
        if (!isOriginal) {
          return <span key={idx} className="text-[#6366F1] font-bold mr-1.5 border-b-2 border-[#6366F1]/30 pb-0.5">{word}</span>;
        }
        return <span key={idx} className="mr-1.5 text-slate-700">{word}</span>;
      })}
    </>
  );
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
}

export function SentenceMakingResultStage({
  problems,
  results,
  onNext,
  nextLabel,
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

          return (
            <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span 
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                        isPerfect ? "bg-success" : "bg-[#6366F1]"
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
                       isPerfect ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"
                    }`}>
                      내 답변
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed">
                      {renderSentenceWithDiff(attempt.sentence, attempt.modelAnswer, isPerfect)}
                    </h3>
                  </div>
                  
                  {(!isPerfect && attempt.modelAnswer) && (
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-[#6366F1]/10 text-[#6366F1]">
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
      <div className="flex justify-center mt-8 pt-4">
        <Button
          onClick={onNext}
          className="w-full sm:w-auto min-w-[200px] h-12 text-base shadow-md font-semibold bg-[#6366F1] hover:bg-[#4F46E5] transition-colors rounded-xl"
        >
          {nextLabel}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
