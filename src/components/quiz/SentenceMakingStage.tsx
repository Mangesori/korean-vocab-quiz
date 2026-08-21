import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { HintButton } from "@/components/quiz/shared/HintButton";
import type { GradedError } from "@/types/quiz";

interface SentenceMakingProblem {
  id: string;
  word: string;
  word_meaning?: string | null;
}

interface SentenceAttempt {
  attemptNumber: number;
  sentence: string;
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
  /**
   * 채점이 찾아낸 오류. 세부 점수 3종(단어사용·문법·자연스러움)을 대체한다.
   * 그 세 숫자는 화면에 표시된 적이 없으면서 저장만 되고 있었고, 정작 유용한
   * 오류 목록은 버려지고 있었다. (2026-08-03, GRADING-CRITERIA.md 참조)
   */
  errors: GradedError[];
  skipped?: boolean;
}

interface SentenceMakingStageProps {
  quizId: string;
  problems: SentenceMakingProblem[];
  difficulty: string;
  translationLanguage?: string;
  /** 라이브 세션 중계용. 답이 바뀔 때마다 문항별 현재 입력값과 활성 문항을 알린다.
   *  라이브가 아닐 땐 전달되지 않으므로 기존 동작에 영향이 없다. */
  onAnswerPeek?: (answers: string[], activeIndex: number, prompts: string[]) => void;
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (results: Record<string, SentenceAttempt[]>) => void;
  onBack?: () => void;
  backLabel?: string;
  /** 공유 링크로 비로그인 응시 중이면 넘긴다. grade-sentence가 이 값으로 익명 채점을 허용한다. */
  shareToken?: string;
  /** 라이브 세션 게스트(비로그인)로 응시 중이면 넘긴다. 위와 같은 이유. */
  liveParticipantId?: string;
}

type Phase = "input" | "grading" | "results";

export function SentenceMakingStage({
  quizId,
  problems,
  difficulty,
  translationLanguage,
  onAnswerPeek,
  onProgressUpdate,
  onComplete,
  onBack,
  backLabel,
  shareToken,
  liveParticipantId,
}: SentenceMakingStageProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentences, setSentences] = useState<Record<string, string>>({});
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, SentenceAttempt[]>>({});
  const [gradingIndex, setGradingIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  // 라이브 중계: 문항별 현재 입력값과 지금 보고 있는 문항을 알린다.
  useEffect(() => {
    if (!onAnswerPeek) return;
    onAnswerPeek(
      problems.map((p) => sentences[p.id] ?? ""),
      currentIndex,
      problems.map((p) => p.word)
    );
  }, [sentences, currentIndex, problems, onAnswerPeek]);


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
  const allFilled = problems.every((p) => sentences[p.id]?.trim() || skippedIds.has(p.id));
  const isCurrentSkipped = skippedIds.has(currentProblem?.id);

  // 입력 단계: 이전/다음
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    const next = new Set(skippedIds);
    next.add(currentProblem.id);
    setSkippedIds(next);
    if (currentIndex < problems.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      handleGradeAll(next);
    }
  };

  // 전체 채점 시작 (일괄 채점). '모르겠어요'로 건너뛴 문제는 AI 채점 없이 0점 처리.
  const handleGradeAll = async (skipOverride?: Set<string>) => {
    const effectiveSkipped = skipOverride ?? skippedIds;
    setPhase("grading");
    setGradingIndex(0);

    const allResults: Record<string, SentenceAttempt[]> = {};

    for (const problem of problems) {
      if (effectiveSkipped.has(problem.id)) {
        allResults[problem.id] = [
          {
            attemptNumber: 1,
            sentence: "",
            totalScore: 0,
            feedback: "모르겠어요를 선택했습니다.",
            modelAnswer: "",
            isPassed: false,
            errors: [],
            skipped: true,
          },
        ];
      }
    }

    try {
      // 건너뛴 문제를 제외하고 나머지만 한 번에 보내서 일괄 채점
      const problemsToGrade = problems
        .filter((p) => !effectiveSkipped.has(p.id))
        .map((p) => ({
          word: p.word,
          studentSentence: sentences[p.id] || "",
          problemId: p.id,
        }));

      if (problemsToGrade.length === 0) {
        setResults(allResults);
        onComplete(allResults);
        return;
      }

      setGradingIndex(0);
      let completedCount = 0;
      const gradingResults: any[] = [];
      const BATCH_SIZE = 5; // AI 응답 타임아웃(60초) 방지를 위해 5개씩 처리

      for (let i = 0; i < problemsToGrade.length; i += BATCH_SIZE) {
        const chunk = problemsToGrade.slice(i, i + BATCH_SIZE);
        const batchStart = completedCount;

        // 실제로는 배치 단위로 채점되지만, 응답을 기다리는 동안 화면에는
        // 문제 하나씩 끝나는 것처럼 보이도록 진행률을 흉내냄.
        // 배치의 마지막 숫자는 실제 응답이 와야만 보여줌.
        let fakeStep = 0;
        const fakeTimer = setInterval(() => {
          if (fakeStep < chunk.length - 1) {
            fakeStep += 1;
            setGradingIndex(Math.min(batchStart + fakeStep, problems.length - 1));
          }
        }, 3000);

        let data, error;
        try {
          ({ data, error } = await supabase.functions.invoke("grade-sentence", {
            body: {
              problems: chunk,
              difficulty,
              translationLanguage,
              // 비로그인 응시자(공유 링크·라이브 게스트)는 이 값으로 서버가 익명 채점을 허용한다.
              ...(shareToken ? { shareToken } : {}),
              ...(liveParticipantId ? { liveParticipantId } : {}),
            },
          }));
        } finally {
          clearInterval(fakeTimer);
        }

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
        totalScore: number;
        feedback: string;
        modelAnswer: string;
        isPassed: boolean;
        errors?: GradedError[];
      }> = gradingResults;

      for (const result of results) {
        const problem = problems.find((p) => p.id === result.problemId);
        if (problem) {
          allResults[problem.id] = [
            {
              attemptNumber: 1,
              sentence: sentences[problem.id] || "",
              totalScore: result.totalScore,
              feedback: result.feedback,
              modelAnswer: result.modelAnswer,
              isPassed: result.isPassed,
              // 구버전 엣지 함수가 배포돼 있으면 errors가 없을 수 있다.
              errors: result.errors ?? [],
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
              totalScore: 0,
              feedback: "채점 결과를 받지 못했습니다.",
              modelAnswer: "",
              isPassed: false,
              errors: [],
            },
          ];
        }
      }
    } catch (error) {
      console.error("Batch grading error:", error);
      // 일괄 채점 실패 시 나머지 문제를 0점 처리 ('모르겠어요'로 건너뛴 문제는 이미
      // allResults에 채워져 있으므로 덮어쓰지 않음)
      for (const problem of problems) {
        if (effectiveSkipped.has(problem.id)) continue;
        allResults[problem.id] = [
          {
            attemptNumber: 1,
            sentence: sentences[problem.id] || "",
            totalScore: 0,
            feedback: "채점에 실패했습니다. 나중에 다시 시도해주세요.",
            modelAnswer: "",
            isPassed: false,
            errors: [],
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
  const skipButton = (
    <button
      type="button"
      onClick={handleSkip}
      className={`inline-block text-sm rounded px-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isCurrentSkipped
          ? "text-foreground font-semibold"
          : "text-muted-foreground font-medium hover:text-foreground hover:scale-110"
      }`}
    >
      {isCurrentSkipped ? "모르겠어요 (선택됨)" : "모르겠어요"}
    </button>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white mb-4 sm:mb-8 mt-4">

      <CardContent className="p-0 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
        <QuizStageHeader
          instruction="이 단어를 사용하여 문장을 만드세요"
          action={<HintButton active={showHint} onToggle={() => setShowHint(!showHint)} />}
        />

        {/* 제시 단어 — 회색 박스는 "이 문제의 재료"만 */}
        <div className="p-5 sm:p-10 bg-slate-50 border-none rounded-2xl flex flex-col items-center justify-center min-h-[180px] sm:min-h-[200px]">
          <Badge variant="outline" className="text-lg sm:text-xl lg:text-2xl px-6 py-2 sm:py-3 font-bold bg-white shadow-sm border-slate-200 rounded-2xl text-slate-800">
            {currentProblem.word}
          </Badge>

          <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && currentProblem.word_meaning ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {currentProblem.word_meaning || ""}
          </p>
        </div>

          {/* 입력 */}
          <div className="px-1">
            <Textarea
              value={sentences[currentProblem.id] || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSentences((prev) => ({ ...prev, [currentProblem.id]: value }));
                if (isCurrentSkipped) {
                  setSkippedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(currentProblem.id);
                    return next;
                  });
                }
              }}
              placeholder={`"${currentProblem.word}"을(를) 사용하여 문장을 만드세요.`}
              className="min-h-[100px] text-md rounded-xl bg-slate-50"
            />
          </div>

          {/* 이전/다음/채점 버튼 */}
          <div className="grid grid-cols-3 items-center mt-6 gap-2">
            {/* min-w-0 이 없으면 긴 뒤로가기 라벨이 칸을 넘쳐 가운데 버튼을 덮는다. */}
            <div className="justify-self-start min-w-0 max-w-full">
              {currentIndex === 0 && onBack ? (
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">{backLabel ?? "이전"}</span>
            <span className="sm:hidden">이전</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> 이전
                </Button>
              )}
            </div>

            <div className="flex justify-center min-w-0">{skipButton}</div>

            <div className="justify-self-end min-w-0">
              {currentIndex < problems.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!sentences[currentProblem.id]?.trim() && !isCurrentSkipped}
                  className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
                >
                  다음 문제 <ChevronRight className="w-4 h-4 ml-1.5 sm:ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleGradeAll()}
                  disabled={!allFilled}
                  className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
                >
                  결과 확인 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
                </Button>
              )}
            </div>
          </div>
      </CardContent>
    </Card>
  );
}
