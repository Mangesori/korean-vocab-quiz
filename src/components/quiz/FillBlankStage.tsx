import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toJamo } from "@/utils/hangul";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Volume2, Lightbulb, Lock, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { maskTranslation } from "@/utils/maskTranslation";
import { GrammarHintButton } from "@/components/quiz/shared/GrammarHintButton";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  // 세트당 제한 시간이 다 됐을 때 QuizTake가 증가시키는 카운터. 값이 바뀔 때마다(마운트 시
  // 최초 값은 무시) 안 채워진 문제가 있어도 강제로 다음 세트로 넘기거나(마지막 세트면) 제출한다.
  timeUpToken?: number;
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
  timeUpToken,
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

  // 답이 입력된 문제의 뱅크 단어 추적 (취소선용) — 자모 분해로 불규칙 활용 대응
  const usedBankWords = useMemo(() => {
    const used = new Set<string>();
    const bankWords = currentSet.map(p => p.word);

    currentSet.forEach((p) => {
      const answer = userAnswers[p.id]?.trim();
      if (!answer) return;

      if (bankWords.includes(answer)) {
        used.add(answer);
        return;
      }

      const ansJamo = toJamo(answer);
      let bestWord = p.word;
      let bestScore = 0;

      for (const bw of bankWords) {
        const bwJamo = toJamo(bw);
        let score = 0;
        while (score < bwJamo.length && score < ansJamo.length && bwJamo[score] === ansJamo[score]) {
          score++;
        }
        if (score > bestScore || (score === bestScore && bw === p.word)) {
          bestScore = score;
          bestWord = bw;
        }
      }

      used.add(bestScore > 0 ? bestWord : p.word);
    });

    return used;
  }, [currentSet, userAnswers]);

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

  // force: 시간 초과로 강제 제출할 때 미답 문제가 있어도 진행한다(오답 처리는 QuizTake 쪽 채점에서 됨).
  const handleComplete = (force = false) => {
    if (isSubmitting) return;
    if (!force && !allAnswered()) return;
    setIsSubmitting(true);
    onComplete();
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
      handleComplete(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUpToken]);

  return (
    <div className="w-full">
      {/* Main Card */}
      <Card className="border shadow-sm rounded-2xl overflow-hidden mb-8 bg-white max-w-5xl mx-auto mt-4">
        <CardContent className="p-0">
          {/* 안내 — 흰 면 = 읽는 것(안내), 회색 박스 = 푸는 재료(보기).
              예시는 안내문구 끝("입력하세요") 바로 옆 정보 아이콘의 Popover로 옮겼다
              (GrammarHintButton과 같은 패턴) — 항상 클릭으로만 열리고 바깥 클릭 시 닫힌다.
              세트가 바뀌어도 자동으로 열리지 않는다 — Popover는 오버레이라 자동으로 뜨면
              어색하다(클릭 안 했는데 떠 있다가 아무 데나 눌러 바로 닫히는 경험이 됨).
              헤더의 action(우측) 슬롯이 아니라 instruction 안에 인라인으로 넣어야 문구
              바로 옆에 붙는다 — action은 헤더 맨 오른쪽 끝으로 밀려나 문구와 멀어진다.
              트리거(아이콘)와 앵커(위치 기준)를 분리한다 — 트리거만 앵커로 쓰면 팝오버가
              아이콘 위치 기준으로 떠서 카드 중앙이 아니라 오른쪽으로 치우쳐 보인다.
              PopoverAnchor로 안내문구 wrapper 전체를 감싸 카드 콘텐츠 폭을 앵커로 삼는다. */}
          <Popover>
            <PopoverAnchor asChild>
              <div className="px-4 sm:px-8 pt-6 sm:pt-7 md:pt-8 pb-2 text-center">
                {/* md:pt-8(32px)로 다른 3개 유형의 데스크톱 상단 패딩과 맞춘다 */}
                <QuizStageHeader
                  instruction={
                    <span className="inline-flex items-center gap-1">
                      빈칸에 알맞은 단어를 문법 형태와 함께 입력하세요
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="예제 보기"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </PopoverTrigger>
                    </span>
                  }
                />
              </div>
            </PopoverAnchor>
            <PopoverContent side="bottom" className="w-auto max-w-[90vw] sm:max-w-lg flex flex-wrap items-center justify-center gap-2 p-3">
              {/* 예시는 칩 2개로 감싼다 — 결합되는 문법 요소만 text-primary로 칠해
                  "무엇이 결합되는지"를 색으로 말한다. 기본은 한 줄, 폭이 부족하면 줄바꿈 */}
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                미술관
                <span className="text-slate-400">+</span>
                <span className="font-bold text-primary">에</span>
                <span className="mx-0.5 text-slate-400">→</span>
                <span className="font-bold text-foreground">미술관<span className="text-primary">에</span></span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                가다
                <span className="text-slate-400">+</span>
                <span className="font-bold text-primary">-고 있다</span>
                <span className="text-slate-400">+</span>
                <span className="font-bold text-primary">아/어요</span>
                <span className="mx-0.5 text-slate-400">→</span>
                <span className="font-bold text-foreground">가<span className="text-primary">고 있어요</span></span>
              </span>
            </PopoverContent>
          </Popover>

          {/* Word Bank — 회색 박스는 "이 문제의 재료"만. 칩은 흰색이라 배경 위에서 떠 보인다 */}
          <div className="mx-4 sm:mx-8 mb-2 rounded-2xl bg-slate-50 px-5 py-4 sm:py-5 flex flex-col items-center">
            <p className="mb-1.5 text-xs font-bold tracking-wide text-muted-foreground">보기</p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full max-w-3xl">
              {shuffledWordBank.map((word, idx) => {
                const isUsed = usedBankWords.has(word);
                return (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={`px-4 py-1.5 rounded-full text-sm font-medium bg-white shadow-sm transition-all ${
                      isUsed
                        ? 'line-through text-muted-foreground border-border opacity-60'
                        : 'text-foreground border-border'
                    }`}
                  >
                    {word}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Problems List */}
          <div className="px-6 sm:px-8 pt-4 pb-6 sm:pb-8">
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
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex gap-2">
                        <span className="text-primary font-bold text-base min-w-[20px]">{problemNumber}.</span>
                        <span className="text-base font-medium leading-relaxed text-foreground">
                          {parts[0]}
                          <span className="text-muted-foreground mx-1">( _____ )</span>
                          {parts[1]}
                        </span>
                      </div>
                      <div className="w-full space-y-2">
                        {/* 문법 버튼은 입력칸 "오른쪽" — 행이 1단으로 유지된다.
                            포커스 링은 이 래퍼가 focus-within으로 그린다 — 입력칸에 포커스가
                            가면 문법 버튼까지 하나의 링으로 감싸이게(입력칸 자체 링은 꺼둠) */}
                        <div className="flex items-center rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                          <Input
                            value={userAnswers[problem.id] || ""}
                            onChange={(e) => onAnswerChange(problem.id, e.target.value)}
                            className={`h-11 flex-1 min-w-0 text-center text-sm border-border bg-slate-50 focus-visible:ring-0 focus-visible:ring-offset-0 ${problem.hint ? "rounded-l-xl rounded-r-none border-r-0" : "rounded-xl"}`}
                            placeholder="정답 입력"
                            autoComplete="off"
                          />
                          {problem.hint && <GrammarHintButton hint={problem.hint} heightClass="h-11" />}
                        </div>
                        <div className="flex gap-2 w-full">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  tabIndex={-1}
                                  onClick={() => {
                                    if (isAnonymous) {
                                      toast.info("회원가입하고 듣기 기능을 사용하세요!", {
                                        description: "회원은 모든 문장을 음성으로 들을 수 있습니다.",
                                      });
                                    } else if (problem.sentence_audio_url) {
                                      playAudio(problem.sentence_audio_url, problem.id);
                                    }
                                  }}
                                  className={`flex-1 h-10 rounded-xl text-muted-foreground font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all ${isAnonymous ? "opacity-60" : ""}`}
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
                            tabIndex={-1}
                            onClick={() => toggleTranslation(problem.id)}
                            className={`flex-1 h-10 rounded-xl font-medium transition-all ${showTranslations[problem.id] ? "bg-warning/10 text-warning border-warning/30" : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"}`}
                            size="sm"
                          >
                            <Lightbulb className={`w-4 h-4 mr-2 ${showTranslations[problem.id] ? "text-warning" : ""}`} /> 번역
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-3 px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
                          {maskTranslation(problem.translation)}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      {/* 문법 버튼이 입력칸 오른쪽 인라인이라 행이 1단 — 단순 수직 중앙 정렬로 충분하다.
                          문장을 flex가 아니라 일반 인라인 흐름(p)으로 둔다 — flex-wrap은 각 span을
                          "덩어리" 단위로 통째로 다음 줄에 내려버려서, 입력칸 뒤에 붙는 짧은 구절도
                          자리가 남아도 무조건 줄바꿈됐다. 일반 텍스트 흐름이어야 단어 단위로 줄바꿈된다. */}
                      <div className="flex items-center gap-3">
                        <p className="flex-1 text-lg leading-relaxed">
                          <span className="text-primary font-bold">{problemNumber}.</span>{" "}
                          <span className="font-medium text-foreground">{parts[0]?.trim()}</span>{" "}
                          {/* 입력칸+문법 버튼은 한 덩어리 — 줄바꿈 시 둘이 갈라지지 않게 묶는다.
                              포커스 링은 이 래퍼가 focus-within으로 그린다 — 입력칸에 포커스가
                              가면 문법 버튼까지 하나의 링으로 감싸이게(입력칸 자체 링은 꺼둠) */}
                          <span className="inline-flex items-center align-middle mx-1 rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                            <Input
                              value={userAnswers[problem.id] || ""}
                              onChange={(e) => onAnswerChange(problem.id, e.target.value)}
                              className={`w-48 h-10 text-center text-base border-border bg-slate-50 focus-visible:ring-0 focus-visible:ring-offset-0 ${problem.hint ? "rounded-l-xl rounded-r-none border-r-0" : "rounded-xl"}`}
                              placeholder="정답 입력"
                              autoComplete="off"
                            />
                            {problem.hint && <GrammarHintButton hint={problem.hint} />}
                          </span>{" "}
                          <span className="font-medium text-foreground">{parts[1]?.trim()}</span>
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  tabIndex={-1}
                                  onClick={() => {
                                    if (isAnonymous) {
                                      toast.info("회원가입하고 듣기 기능을 사용하세요!", {
                                        description: "회원은 모든 문장을 음성으로 들을 수 있습니다.",
                                      });
                                    } else if (problem.sentence_audio_url) {
                                      playAudio(problem.sentence_audio_url, problem.id);
                                    }
                                  }}
                                  className={`h-9 px-3 rounded-xl text-sm text-muted-foreground font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all ${isAnonymous ? "opacity-60" : ""}`}
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
                            tabIndex={-1}
                            onClick={() => toggleTranslation(problem.id)}
                            className={`h-9 px-3 rounded-xl text-sm font-medium transition-all ${showTranslations[problem.id] ? "bg-warning/10 text-warning border-warning/30" : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"}`}
                          >
                            <Lightbulb className={`w-4 h-4 mr-1.5 ${showTranslations[problem.id] ? "text-warning" : ""}`} /> 번역
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-4 ml-8 px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
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
          className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-border text-muted-foreground text-xs sm:text-sm font-semibold hover:bg-white hover:text-foreground shadow-sm"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> 이전 세트
        </Button>

        {currentSetIndex < totalSets - 1 ? (
          <Button
            onClick={handleNextSet}
            disabled={!currentSetAnswered()}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            다음 세트 <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1.5 sm:ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => handleComplete()}
            disabled={isSubmitting || !allAnswered()}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 animate-spin" /> 제출 중...</>
            ) : (
              <>결과 확인 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
