import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SentenceMakingProblem {
  id: string;
  word: string;
  translation?: string;
}

interface SentenceAttempt {
  attemptNumber: number;
  sentence: string;
  wordUsageScore: number;
  grammarScore: number;
  naturalnessScore: number;
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
}

interface SentenceMakingStageProps {
  quizId: string;
  problems: SentenceMakingProblem[];
  difficulty: string;
  translationLanguage?: string;
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (results: Record<string, SentenceAttempt[]>) => void;
  onBack?: () => void;
}

type Phase = "input" | "grading" | "results";

export function SentenceMakingStage({
  quizId,
  problems,
  difficulty,
  translationLanguage,
  onProgressUpdate,
  onComplete,
  onBack,
}: SentenceMakingStageProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentences, setSentences] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, SentenceAttempt[]>>({});
  const [gradingIndex, setGradingIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (onProgressUpdate && problems.length > 0) {
      if (phase === "input") {
        onProgressUpdate(currentIndex + 1, problems.length, `${currentIndex + 1}/${problems.length}`);
      } else if (phase === "grading") {
        onProgressUpdate(gradingIndex + 1, problems.length, `${gradingIndex + 1}/${problems.length}`);
      }
    }
  }, [currentIndex, gradingIndex, phase, problems.length, onProgressUpdate]);


  const currentProblem = problems[currentIndex];
  const allFilled = problems.every((p) => sentences[p.id]?.trim());

  // 입력 단계: 이전/다음
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  // 전체 채점 시작 (일괄 채점)
  const handleGradeAll = async () => {
    setPhase("grading");
    setGradingIndex(0);

    const allResults: Record<string, SentenceAttempt[]> = {};

    try {
      // 모든 문제를 한 번에 보내서 일괄 채점
      const problemsToGrade = problems.map((p) => ({
        word: p.word,
        studentSentence: sentences[p.id] || "",
        problemId: p.id,
      }));

      setGradingIndex(0);
      let completedCount = 0;
      const gradingResults: any[] = [];
      const BATCH_SIZE = 5; // AI 응답 타임아웃(60초) 방지를 위해 5개씩 처리

      for (let i = 0; i < problemsToGrade.length; i += BATCH_SIZE) {
        const chunk = problemsToGrade.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("grade-sentence", {
          body: {
            problems: chunk,
            difficulty,
            translationLanguage,
          },
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.results) {
          gradingResults.push(...data.results);
        }

        completedCount += chunk.length;
        // 실제 채점이 완료된 개수만큼 업데이트 (최대 전체 문제 수 유지)
        setGradingIndex(Math.min(completedCount, problems.length - 1));
      }

      // 결과 매핑
      const results: Array<{
        problemId: string;
        wordUsageScore: number;
        grammarScore: number;
        naturalnessScore: number;
        totalScore: number;
        feedback: string;
        modelAnswer: string;
        isPassed: boolean;
      }> = gradingResults;

      for (const result of results) {
        const problem = problems.find((p) => p.id === result.problemId);
        if (problem) {
          allResults[problem.id] = [
            {
              attemptNumber: 1,
              sentence: sentences[problem.id] || "",
              wordUsageScore: result.wordUsageScore,
              grammarScore: result.grammarScore,
              naturalnessScore: result.naturalnessScore,
              totalScore: result.totalScore,
              feedback: result.feedback,
              modelAnswer: result.modelAnswer,
              isPassed: result.isPassed,
            },
          ];
        }
      }

      // 결과가 누락된 문제는 0점 처리
      for (const problem of problems) {
        if (!allResults[problem.id]) {
          allResults[problem.id] = [
            {
              attemptNumber: 1,
              sentence: sentences[problem.id] || "",
              wordUsageScore: 0,
              grammarScore: 0,
              naturalnessScore: 0,
              totalScore: 0,
              feedback: "채점 결과를 받지 못했습니다.",
              modelAnswer: "",
              isPassed: false,
            },
          ];
        }
      }
    } catch (error) {
      console.error("Batch grading error:", error);
      // 일괄 채점 실패 시 모든 문제를 0점 처리
      for (const problem of problems) {
        allResults[problem.id] = [
          {
            attemptNumber: 1,
            sentence: sentences[problem.id] || "",
            wordUsageScore: 0,
            grammarScore: 0,
            naturalnessScore: 0,
            totalScore: 0,
            feedback: "채점에 실패했습니다. 나중에 다시 시도해주세요.",
            modelAnswer: "",
            isPassed: false,
          },
        ];
      }
    }

    setResults(allResults);
    // 채점 완료 후 바로 onComplete 호출 (결과는 별도 SentenceMakingResultStage에서 표시)
    onComplete(allResults);
  };

  // 채점 진행 중 화면
  if (phase === "grading") {
    const progressPercent = ((gradingIndex + 1) / problems.length) * 100;
    return (
      <Card className="w-full max-w-5xl mx-auto">
        <CardContent className="py-12 text-center space-y-6">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <div>
            <h2 className="text-xl font-bold mb-2">채점 중...</h2>
            <p className="text-muted-foreground">
              {gradingIndex + 1} / {problems.length} 문제 채점 중
            </p>
          </div>
          <Progress value={progressPercent} className="max-w-sm mx-auto" />
        </CardContent>
      </Card>
    );
  }

  // 입력 단계
  return (
    <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white mb-4 sm:mb-8 mt-0 sm:mt-2 lg:mt-6">
      
      <CardContent className="p-0 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
        {/* 단어 표시 */}
          <div className="p-5 sm:p-10 bg-transparent sm:bg-slate-50 border-none rounded-2xl flex flex-col min-h-[220px] sm:min-h-[250px] mt-0 sm:mt-1">
            <div className="flex w-full items-center justify-end mb-2 sm:mb-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowHint(!showHint)}
                className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
              >
                <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${showHint ? "text-warning" : ""}`} />
                힌트
              </Button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium mb-3 sm:mb-5 text-center">
                이 단어를 사용하여 문장을 만드세요
              </p>
              <Badge variant="outline" className="text-lg sm:text-xl lg:text-2xl px-6 py-2 sm:py-3 font-bold bg-white shadow-sm border-slate-200 rounded-2xl text-slate-800">
                {currentProblem.word}
              </Badge>
              
              <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && currentProblem.translation ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {currentProblem.translation || ""}
              </p>
            </div>
          </div>

          {/* 입력 */}
          <div className="px-1">
            <Textarea
              value={sentences[currentProblem.id] || ""}
              onChange={(e) =>
                setSentences((prev) => ({ ...prev, [currentProblem.id]: e.target.value }))
              }
              placeholder={`"${currentProblem.word}"을(를) 사용하여 문장을 작성하세요...`}
              className="min-h-[100px] text-md rounded-xl border-slate-200 focus-visible:ring-primary/20"
            />
          </div>

        {/* 이전/다음/채점 버튼 */}
        <div className="flex justify-between items-center mt-6">
          {currentIndex === 0 && onBack ? (
            <Button
              variant="outline"
              onClick={onBack}
              className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> 빈칸 채우기 결과
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> 이전
            </Button>
          )}

          {currentIndex < problems.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!sentences[currentProblem.id]?.trim()}
              className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
            >
              다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleGradeAll}
              disabled={!allFilled}
              className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
            >
              다음 단계로 <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
