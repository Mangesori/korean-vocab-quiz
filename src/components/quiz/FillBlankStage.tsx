import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Volume2, Lightbulb, Lock, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { maskTranslation } from "@/utils/maskTranslation";

export interface FillBlankProblem {
  id: string;
  word: string;
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
}

interface FillBlankStageProps {
  problems: FillBlankProblem[];
  wordsPerSet: number;
  isAnonymous: boolean;
  hasNextStage: boolean;
  userAnswers: Record<string, string>;
  onAnswerChange: (problemId: string, value: string) => void;
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: () => void;
}

export function FillBlankStage({
  problems,
  wordsPerSet,
  isAnonymous,
  hasNextStage,
  userAnswers,
  onAnswerChange,
  onProgressUpdate,
  onComplete,
}: FillBlankStageProps) {
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Group problems into sets
  const problemSets = useMemo(() => {
    return Array.from({ length: Math.ceil(problems.length / wordsPerSet) }, (_, i) =>
      problems.slice(i * wordsPerSet, (i + 1) * wordsPerSet)
    );
  }, [problems, wordsPerSet]);

  const currentSet = problemSets[currentSetIndex] || [];
  const totalSets = problemSets.length;

  useEffect(() => {
    if (onProgressUpdate) {
      const startNum = currentSetIndex * wordsPerSet + 1;
      const endNum = Math.min((currentSetIndex + 1) * wordsPerSet, problems.length);
      const label = startNum === endNum ? `${startNum}/${problems.length}` : `${startNum}-${endNum}/${problems.length}`;
      onProgressUpdate(currentSetIndex + 1, totalSets, label);
    }
  }, [currentSetIndex, totalSets, problems.length, wordsPerSet, onProgressUpdate]);

  // 세트가 변경될 때 보기 단어 셔플
  const currentSetIds = currentSet.map(p => p.id).join(',');
  const shuffledWordBank = useMemo(() => {
    return [...currentSet]
      .map((p) => p.word)
      .sort(() => Math.random() - 0.5);
  }, [currentSetIds]);

  const toggleTranslation = (problemId: string) => {
    setShowTranslations((prev) => ({ ...prev, [problemId]: !prev[problemId] }));
  };

  const playAudio = useCallback((audioUrl: string | undefined, problemId: string) => {
    if (!audioUrl) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (playingAudio === problemId) {
      setPlayingAudio(null);
      return;
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingAudio(problemId);
    
    audio.onended = () => {
      setPlayingAudio(null);
      audioRef.current = null;
    };
    
    audio.onerror = () => {
      console.error("Audio playback error");
      setPlayingAudio(null);
      audioRef.current = null;
    };
    
    audio.play().catch((err) => {
      console.error("Audio play error:", err);
      setPlayingAudio(null);
    });
  }, [playingAudio]);

  const handleNextSet = () => {
    if (currentSetIndex < totalSets - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
      setShowTranslations({});
    }
  };

  const handlePrevSet = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1);
      setShowTranslations({});
    }
  };

  const currentSetAnswered = () => {
    return currentSet.every((p) => userAnswers[p.id]?.trim());
  };

  const allAnswered = () => {
    return problems.every((p) => userAnswers[p.id]?.trim());
  };

  const handleComplete = () => {
    if (!allAnswered() || isSubmitting) return;
    setIsSubmitting(true);
    onComplete();
  };

  return (
    <div className="w-full">
      {/* Main Card */}
      <Card className="border shadow-sm rounded-2xl overflow-hidden mb-8 bg-white max-w-5xl mx-auto mt-4">
        <CardContent className="p-0">
          {/* Word Bank */}
          <div className="bg-slate-50 border-b px-6 py-5 flex flex-col items-center">
            <p className="text-sm font-bold text-slate-500 mb-4">보기</p>
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
              {shuffledWordBank.map((word, idx) => (
                <Badge key={idx} variant="outline" className="px-4 py-1.5 rounded-full text-sm font-medium bg-white border-slate-200 text-slate-700 shadow-sm">
                  {word}
                </Badge>
              ))}
            </div>
          </div>

          {/* Problems List */}
          <div className="p-6 sm:p-8">
            <div className="space-y-0 divide-y">
              {currentSet.map((problem, idx) => {
                const problemNumber = currentSetIndex * wordsPerSet + idx + 1;
                let sentence = problem.sentence;
                sentence = sentence.replace(/([.?!])\s*\.+\s*$/, "$1");
                sentence = sentence.replace(/\.\s*\.$/, ".");
                const parts = sentence.split(/\(\s*\)|\(\)/);

                return (
                  <div key={problem.id} className="py-6 sm:py-5 first:pt-2 last:pb-2">
                    {/* Mobile Layout */}
                    <div className="flex flex-col gap-3 sm:hidden">
                      <div className="flex gap-2">
                        <span className="text-primary font-bold text-base min-w-[20px]">{problemNumber}.</span>
                        <span className="text-base font-medium leading-relaxed text-slate-800">
                          {parts[0]}
                          <span className="text-muted-foreground mx-1">( _____ )</span>
                          {problem.hint && <span className="text-primary font-medium mx-1">{problem.hint}</span>}
                          {parts[1]}
                        </span>
                      </div>
                      <div className="w-full space-y-3 mt-1">
                        <Input
                          value={userAnswers[problem.id] || ""}
                          onChange={(e) => onAnswerChange(problem.id, e.target.value)}
                          className="h-11 w-full text-center text-sm rounded-xl border-slate-200"
                          placeholder="정답 입력"
                          autoComplete="off"
                        />
                        <div className="flex gap-2 w-full">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    if (isAnonymous) {
                                      toast.info("회원가입하고 듣기 기능을 사용하세요!", {
                                        description: "회원은 모든 문장을 음성으로 들을 수 있습니다.",
                                      });
                                    } else if (problem.sentence_audio_url) {
                                      playAudio(problem.sentence_audio_url, problem.id);
                                    }
                                  }}
                                  className={`flex-1 h-10 rounded-xl text-slate-600 font-medium hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA] transition-all ${isAnonymous ? "opacity-60" : ""}`}
                                  size="sm"
                                >
                                  {isAnonymous ? (
                                    <><Lock className="w-4 h-4 mr-2" /> 듣기</>
                                  ) : (
                                    <><Volume2 className={`w-4 h-4 mr-2 ${playingAudio === problem.id ? "text-primary animate-pulse" : ""}`} /> 듣기</>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              {isAnonymous && <TooltipContent><p>회원 전용 기능</p></TooltipContent>}
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="outline"
                            onClick={() => toggleTranslation(problem.id)}
                            className={`flex-1 h-10 rounded-xl font-medium transition-all ${showTranslations[problem.id] ? "bg-amber-50 text-amber-600 border-amber-200" : "text-slate-600 hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA]"}`}
                            size="sm"
                          >
                            <Lightbulb className={`w-4 h-4 mr-2 ${showTranslations[problem.id] ? "text-amber-500" : ""}`} /> 힌트
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-3 px-4 py-3 bg-sky-50 rounded-xl text-sm border border-sky-100 text-slate-800">
                          {maskTranslation(problem.translation)}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-bold text-lg min-w-[24px]">{problemNumber}.</span>
                        <div className="flex-1 flex items-center flex-wrap gap-1 leading-loose">
                          <span className="text-lg font-medium text-slate-800 whitespace-nowrap">{parts[0]?.trim()}</span>
                          <Input
                            value={userAnswers[problem.id] || ""}
                            onChange={(e) => onAnswerChange(problem.id, e.target.value)}
                            className="w-48 h-10 ml-1 text-center text-base inline-block rounded-xl border-slate-200"
                            placeholder=""
                            autoComplete="off"
                          />
                          {problem.hint && <span className="text-primary text-base font-medium whitespace-nowrap">{problem.hint}</span>}
                          <span className="text-lg font-medium text-slate-800 whitespace-nowrap">{parts[1]?.trim()}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (isAnonymous) {
                                      toast.info("회원가입하고 듣기 기능을 사용하세요!", {
                                        description: "회원은 모든 문장을 음성으로 들을 수 있습니다.",
                                      });
                                    } else if (problem.sentence_audio_url) {
                                      playAudio(problem.sentence_audio_url, problem.id);
                                    }
                                  }}
                                  className={`h-9 px-3 rounded-xl text-sm text-slate-600 font-medium hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA] transition-all ${isAnonymous ? "opacity-60" : ""}`}
                                >
                                  {isAnonymous ? (
                                    <><Lock className="w-4 h-4 mr-1.5" /> 듣기</>
                                  ) : (
                                    <><Volume2 className={`w-4 h-4 mr-1.5 ${playingAudio === problem.id ? "text-primary animate-pulse" : ""}`} /> 듣기</>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              {isAnonymous && <TooltipContent><p>회원 전용 기능</p></TooltipContent>}
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleTranslation(problem.id)}
                            className={`h-9 px-3 rounded-xl text-sm font-medium transition-all ${showTranslations[problem.id] ? "bg-amber-50 text-amber-600 border-amber-200" : "text-slate-600 hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA]"}`}
                          >
                            <Lightbulb className={`w-4 h-4 mr-1.5 ${showTranslations[problem.id] ? "text-amber-500" : ""}`} /> 힌트
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-4 ml-8 px-4 py-3 bg-sky-50 rounded-xl text-sm border border-sky-100 text-slate-800">
                          {maskTranslation(problem.translation)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6 max-w-5xl mx-auto">
        <Button
          variant="outline"
          onClick={handlePrevSet}
          disabled={currentSetIndex === 0}
          className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-2" /> 이전 세트
        </Button>

        {currentSetIndex < totalSets - 1 ? (
          <Button
            onClick={handleNextSet}
            disabled={!currentSetAnswered()}
            className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
          >
            다음 세트 <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={isSubmitting || !allAnswered()}
            className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 제출 중...</>
            ) : hasNextStage ? (
              <>다음 단계로 <ChevronRight className="w-5 h-5 ml-2" /></>
            ) : (
              <><CheckCircle className="w-5 h-5 mr-2" /> 결과 제출</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
