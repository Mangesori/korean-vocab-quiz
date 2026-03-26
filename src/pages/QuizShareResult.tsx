import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Volume2, Lightbulb, FileText, Pencil, Mic, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
}

interface UserAnswer {
  problemId: string;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer?: string;
  sentence?: string;
  translation?: string;
}

interface SentenceMakingProblem {
  id: string;
  problem_id: string;
  word: string;
  word_meaning?: string;
  model_answer: string;
}

interface RecordingProblem {
  id: string;
  problem_id: string;
  sentence: string;
  mode: 'read' | 'listen';
  sentence_audio_url?: string;
  translation?: string;
}

interface QuizResult {
  quizId?: string;
  quizTitle: string;
  score: number;
  total: number;
  answers: UserAnswer[];
  sentenceMakingResults?: Record<string, any[]>;
  speakingResults?: Record<string, any[]>;
}

export default function QuizShareResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 문제 데이터
  const [fillBlankProblems, setFillBlankProblems] = useState<Problem[]>([]);
  const [sentenceMakingProblems, setSentenceMakingProblems] = useState<SentenceMakingProblem[]>([]);
  const [recordingProblems, setRecordingProblems] = useState<RecordingProblem[]>([]);
  
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showRecordingTrans, setShowRecordingTrans] = useState<Record<string, boolean>>({});
  const [wordsPerSet, setWordsPerSet] = useState<number>(5);

  useEffect(() => {
    const loadData = async () => {
      const resultDataStr = localStorage.getItem('anonymous_quiz_result');
      if (!resultDataStr) {
        navigate('/');
        return;
      }

      const resultData: QuizResult = JSON.parse(resultDataStr);
      setResult(resultData);

      if (resultData.quizId) {
        // 문제 데이터 조회
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', resultData.quizId)
          .single();

        if (quizData) {
          setWordsPerSet(quizData.words_per_set || 5);
          
          const { data: problemsData } = await supabase
            .from('quiz_problems')
            .select('problem_id, sentence_audio_url')
            .eq('quiz_id', resultData.quizId);

          const audioMap = new Map(
            problemsData?.map(p => [p.problem_id, p.sentence_audio_url]) || []
          );

          const problemsWithAudio = (quizData.problems as any[]).map(problem => ({
            ...problem,
            sentence_audio_url: audioMap.get(problem.id) || problem.sentence_audio_url,
          }));

          setFillBlankProblems(problemsWithAudio);

          if (quizData.sentence_making_enabled) {
            const { data: smProblems } = await supabase
              .from('sentence_making_problems')
              .select('id, problem_id, word, word_meaning, model_answer')
              .eq('quiz_id', resultData.quizId);
            if (smProblems) setSentenceMakingProblems(smProblems as any[]);
          }

          if (quizData.recording_enabled) {
            const { data: recProblems } = await supabase
              .from('recording_problems')
              .select('id, problem_id, sentence, mode, sentence_audio_url, translation')
              .eq('quiz_id', resultData.quizId);
            if (recProblems) setRecordingProblems(recProblems as any[]);
          }
        }
      }
      setIsLoading(false);
    };

    loadData();
  }, [navigate]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!result) return null;

  // 점수 계산 로직
  // 1. 빈칸 채우기
  const hasFillBlank = result.answers && result.answers.length > 0;
  const fillBlankTotal = result.answers?.length || 0;
  const fillBlankScore = result.answers?.filter(a => a.isCorrect).length || 0;
  const fillBlankPercentage = fillBlankTotal > 0 ? Math.round((fillBlankScore / fillBlankTotal) * 100) : 0;

  // 2. 문장 만들기
  const smResults = result.sentenceMakingResults || {};
  const hasSentenceMaking = Object.keys(smResults).length > 0;
  const smTotal = hasSentenceMaking ? sentenceMakingProblems.length : 0;
  const smPassed = sentenceMakingProblems.filter(p => {
    const attempts = smResults[p.id] || [];
    const lastAttempt = attempts[attempts.length - 1];
    return lastAttempt?.isPassed;
  }).length;
  const smScore = smPassed * 100; // 문제당 100점으로 가정 방식
  const smTotalScoreCalc = smTotal * 100;
  const smPercentage = smTotalScoreCalc > 0 ? Math.round((smScore / smTotalScoreCalc) * 100) : 0;

  // 3. 말하기 연습
  const recResults = result.speakingResults || {};
  const hasRecording = Object.keys(recResults).length > 0;
  const recTotal = hasRecording ? recordingProblems.length : 0;
  const recPassed = recordingProblems.filter(p => {
    const attempts = recResults[p.id] || [];
    const lastAttempt = attempts[attempts.length - 1];
    return lastAttempt?.isPassed;
  }).length;
  const recScore = recPassed * 100;
  const recTotalScoreCalc = recTotal * 100;
  const recPercentage = recTotalScoreCalc > 0 ? Math.round((recScore / recTotalScoreCalc) * 100) : 0;

  // 전체 점수
  const totalScore = fillBlankScore + smPassed + recPassed;
  const totalQuestions = fillBlankTotal + smTotal + recTotal;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
  const isGood = percentage >= 80;
  const isMedium = percentage >= 50 && percentage < 80;

  const multipleTypes = [hasFillBlank, hasSentenceMaking, hasRecording].filter(Boolean).length > 1;

  // 그룹화 로직 (빈칸 채우기)
  const groupedProblems: Problem[][] = [];
  if (hasFillBlank && fillBlankProblems.length > 0) {
    for (let i = 0; i < fillBlankProblems.length; i += wordsPerSet) {
      groupedProblems.push(fillBlankProblems.slice(i, i + wordsPerSet));
    }
  }

  const getAnswerForProblem = (problemId: string) => {
    return result.answers?.find(a => a.problemId === problemId);
  };

  const handlePlayAudio = (url: string | undefined, id: string) => {
    if (!url) return;
    if (playingAudio === id) {
      setPlayingAudio(null);
      return;
    }
    setPlayingAudio(id);
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
    audio.play();
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Result Header */}
          <div className="flex flex-col items-center justify-center py-6 mb-8 mt-2 animate-fade-in">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-500 mb-6">{result.quizTitle}</h1>
            <div className="relative inline-flex items-center justify-center mb-4">
              <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm tracking-tight text-center">
                {percentage}%
              </p>
              {percentage >= 100 && (
                <span className="absolute -top-4 -right-8 text-4xl animate-bounce">🎉</span>
              )}
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm px-6 py-2.5 rounded-full shadow-sm border border-slate-100 mt-2">
              <p className="text-lg sm:text-xl font-bold text-slate-700 text-center">
                {totalQuestions}문제 중 {totalScore}문제를 맞혔어요!
              </p>
            </div>
            
            <p className="mt-4 text-base sm:text-lg font-bold text-slate-500">
              {isGood ? '정말 잘했어요! 👏' : isMedium ? '좋아요! 조금만 더 힘내볼까요? 💪' : '다시 한번 도전해보세요! 📚'}
            </p>
          </div>

          {/* 탭 기반 상세 리뷰 */}
          {multipleTypes ? (
            <Tabs defaultValue={hasFillBlank ? "fill_blank" : hasSentenceMaking ? "sentence_making" : "recording"} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3 mb-8 h-auto p-1.5 bg-slate-100/60 rounded-2xl gap-1">
                {hasFillBlank && (
                  <TabsTrigger value="fill_blank" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">빈칸 채우기</span>
                    </div>
                    <span className="text-xl font-bold text-blue-500">{fillBlankPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasSentenceMaking && (
                  <TabsTrigger value="sentence_making" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Pencil className="w-4 h-4" />
                      <span className="text-sm">문장 만들기</span>
                    </div>
                    <span className="text-xl font-bold text-green-500">{smPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasRecording && (
                  <TabsTrigger value="recording" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Mic className="w-4 h-4" />
                      <span className="text-sm">말하기 연습</span>
                    </div>
                    <span className="text-xl font-bold text-purple-500">{recPercentage}%</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* 빈칸 채우기 내용 */}
              {hasFillBlank && (
                <TabsContent value="fill_blank">
                  <div className="space-y-8">
                    {groupedProblems.map((setProblems, setIdx) => (
                      <div key={setIdx} className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-lg font-bold text-foreground">세트 {setIdx + 1}</span>
                          <div className="h-px bg-border flex-1" />
                        </div>
                        <div className="grid gap-4">
                          {setProblems.map((problem, idx) => {
                             const userAnswer = getAnswerForProblem(problem.id);
                             const isCorrect = userAnswer?.isCorrect || false;
                             const problemNumber = setIdx * wordsPerSet + idx + 1;
                             return (
                               <QuizReviewCard
                                 key={problem.id || idx}
                                 problem={problem}
                                 userAnswer={userAnswer?.userAnswer}
                                 isCorrect={isCorrect}
                                 problemNumber={problemNumber}
                               />
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* 문장 만들기 리뷰 */}
              {hasSentenceMaking && (
                <TabsContent value="sentence_making">
                  <div className="space-y-4 mt-8">
                    {sentenceMakingProblems.map((problem, idx) => {
                      const attempts = smResults[problem.id] || [];
                      const lastAttempt = attempts[attempts.length - 1];
                      const isPassed = lastAttempt?.isPassed || false;
                      const hasModelAnswer = lastAttempt && lastAttempt.totalScore < 100 && problem.model_answer;
                      const isPerfect = lastAttempt?.totalScore === 100;

                      return (
                        <Card key={problem.id} className="border-0 shadow-sm bg-white overflow-hidden rounded-2xl">
                          <CardContent className="p-0">
                            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-50">
                              <div className="flex items-center gap-3">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white shadow-sm ${
                                  isPerfect ? "bg-success shadow-success/20" : "bg-[#6366F1] shadow-[#6366F1]/20"
                                }`}>
                                  {idx + 1}
                                </div>
                                <Badge variant="secondary" className="font-semibold text-base px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                                  {problem.word}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 pr-2">
                                {isPassed ? (
                                  <CheckCircle className="w-6 h-6 text-success drop-shadow-sm" />
                                ) : (
                                  <XCircle className="w-6 h-6 text-warning drop-shadow-sm" />
                                )}
                              </div>
                            </div>
                            
                            <div className="p-4 sm:p-5 sm:pt-6 bg-slate-50/50">
                              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                <div className="flex-1 space-y-2.5">
                                  <div className="flex items-start sm:items-center gap-3">
                                    <span className={`shrink-0 text-xs font-bold py-1 w-[4.5rem] text-center rounded-lg mt-0.5 sm:mt-0 ${
                                      isPerfect ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"
                                    }`}>
                                      내 답변
                                    </span>
                                    <h3 className={`text-[1.05rem] font-bold leading-normal pt-0.5 sm:pt-0 ${
                                      isPerfect ? "text-success" : "text-foreground"
                                    }`}>
                                      {lastAttempt?.sentence || "(입력 없음)"}
                                    </h3>
                                  </div>
                                  
                                  {(!isPerfect && problem.model_answer) && (
                                    <div className="flex items-start sm:items-center gap-3 mt-2 sm:mt-3">
                                      <span className="shrink-0 text-xs font-bold py-1 w-[4.5rem] text-center rounded-lg bg-[#6366F1]/10 text-[#6366F1] mt-0.5 sm:mt-0">
                                        추천 문장
                                      </span>
                                      <h3 className="text-[1.05rem] font-bold text-slate-700 leading-normal pt-0.5 sm:pt-0">
                                        {problem.model_answer}
                                      </h3>
                                    </div>
                                  )}
                                  
                                  {lastAttempt?.feedback && (
                                    <div className="mt-4 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{lastAttempt.feedback.replace(/Model Answer:\s*.*/i, '').trim()}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              )}

              {/* 말하기 연습 리뷰 */}
              {hasRecording && (
                <TabsContent value="recording">
                  <div className="space-y-4">
                    {recordingProblems.map((problem, idx) => {
                      const attempts = recResults[problem.id] || [];
                      const lastAttempt = attempts[attempts.length - 1];
                      const isPassed = (lastAttempt as any)?.isPassed ?? lastAttempt?.is_passed ?? false;
                      const wordFeedback = (lastAttempt as any)?.wordLevelFeedback ?? lastAttempt?.word_level_feedback ?? [];
                      
                      // Feedback rendering helpers
                      const renderSentenceFeedback = () => {
                        if (!wordFeedback || wordFeedback.length === 0) {
                          return <span className={isPassed ? "text-success font-bold" : ""}>{problem.sentence}</span>;
                        }
                        const lowScoreWords = new Set(
                          wordFeedback.filter((w: any) => w.accuracyScore < 60).map((w: any) => w.word.replace(/[.,!?。，！？]/g, ""))
                        );
                        if (lowScoreWords.size === 0) {
                          return <span className="text-success font-bold">{problem.sentence}</span>;
                        }
                        return (
                          <span className="font-bold">
                            {problem.sentence.split(/(\s+)/).map((word, i) => {
                              const cleanWord = word.replace(/[.,!?。，！？]/g, "");
                              if (lowScoreWords.has(cleanWord)) {
                                return <span key={i} className="text-destructive">{word}</span>;
                              }
                              return <span key={i} className="text-success">{word}</span>;
                            })}
                          </span>
                        );
                      };

                      const generateGeneralFeedback = () => {
                        if (!lastAttempt) return "";
                        const lowWords = wordFeedback.filter((w: any) => w.accuracyScore < 60).map((w: any) => w.word.replace(/[.,!?。，！？]/g, ""));
                        if (lowWords.length > 0) {
                          const displayWords = lowWords.slice(0, 3).join("', '");
                          const suffix = lowWords.length > 3 ? "' and others" : "'";
                          return `Pay closer attention to the pronunciation of '${displayWords}${suffix}. Listen to the native speaker and try again!`;
                        }
                        if (isPassed) {
                          const overall = (lastAttempt as any)?.overallScore ?? lastAttempt?.overall_score ?? 0;
                          if (overall >= 90) return "Excellent pronunciation! You sound very natural and clear.";
                          let feedback = "Good job! ";
                          if (((lastAttempt as any)?.fluencyScore ?? lastAttempt?.fluency_score ?? 100) < 80) {
                            feedback += "Try to speak a bit more smoothly without pausing.";
                          } else if (((lastAttempt as any)?.prosodyScore ?? lastAttempt?.prosody_score ?? 100) < 80) {
                            feedback += "Pay a little more attention to the natural rhythm and intonation.";
                          } else if (((lastAttempt as any)?.completenessScore ?? lastAttempt?.completeness_score ?? 100) < 80) {
                            feedback += "Make sure to pronounce every word in the sentence clearly.";
                          } else {
                            feedback += "Keep practicing to make it even more natural.";
                          }
                          return feedback;
                        }
                        return "Please listen carefully to the native speaker and try again.";
                      };

                      return (
                        <Card key={problem.id} className="overflow-hidden border bg-white rounded-xl shadow-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isPassed ? "bg-success" : "bg-destructive"}`}>
                                  {idx + 1}
                                </span>
                                <div className={`text-sm font-semibold px-3 py-1 rounded-full ${problem.mode === "listen" ? "text-orange-700 bg-orange-100" : "text-primary/80 bg-primary/10"}`}>
                                  {problem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
                                </div>
                              </div>
                              {problem.translation && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setShowRecordingTrans(prev => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                                >
                                  <Lightbulb className={`w-4 h-4 sm:mr-2 ${showRecordingTrans[problem.id] ? "text-warning" : ""}`} />
                                  <span className="hidden sm:inline">번역 보기</span>
                                </Button>
                              )}
                            </div>
                            
                            <h3 className="text-lg font-bold mb-4 text-slate-800 leading-relaxed pl-3">
                              {problem.sentence}
                            </h3>
                            
                            {showRecordingTrans[problem.id] && problem.translation && (
                              <p className="text-sm text-muted-foreground mb-6 bg-slate-50 p-3 rounded-lg">
                                {problem.translation}
                              </p>
                            )}
                            
                            <div className={`flex flex-col gap-3 mb-4 ${problem.mode === "listen" ? "mt-6" : "mt-4"}`}>
                              {problem.mode === "listen" && problem.sentence_audio_url && (
                                <div className="flex items-center gap-0 sm:gap-4">
                                  <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">원어민 음성</p>
                                  <button 
                                    onClick={() => handlePlayAudio(problem.sentence_audio_url, problem.id)}
                                    className="flex-1 flex items-center justify-center bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-2xl py-3 px-4 transition-colors"
                                  >
                                    <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingAudio === problem.id ? "text-cyan-600 animate-pulse" : "text-cyan-500"}`} />
                                    <div className="flex gap-[3px] items-center h-5">
                                      {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                                        <div 
                                          key={`orig-${i}`} 
                                          className={`w-[3px] rounded-full transition-all duration-300 ${playingAudio === problem.id ? "bg-cyan-500 animate-pulse" : "bg-cyan-200"}`} 
                                          style={{ height: `${h * 3}px`, opacity: playingAudio === problem.id ? (h / 8) + 0.2 : 1 }} 
                                        />
                                      ))}
                                    </div>
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center gap-0 sm:gap-4">
                                <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">내 발음 (공유됨)</p>
                                <button 
                                  disabled
                                  className="flex-1 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 transition-colors opacity-50 cursor-not-allowed"
                                >
                                  <Volume2 className="w-5 h-5 mr-3 sm:mr-4 text-slate-400" />
                                  <div className="flex-1 text-center text-sm font-medium text-slate-400">
                                    재생할 수 없음
                                  </div>
                                </button>
                              </div>
                            </div>

                            <div className="mt-6 border-t border-slate-100 pt-5 space-y-4 px-1 sm:px-3">
                              <div className="text-lg">
                                {renderSentenceFeedback()}
                              </div>
                              
                              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-sm text-slate-600 leading-relaxed break-keep">{generateGeneralFeedback()}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="space-y-8 mt-4">
              {groupedProblems.map((setProblems, setIdx) => (
                <div key={setIdx} className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-lg font-bold text-foreground">세트 {setIdx + 1}</span>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  <div className="grid gap-4">
                    {setProblems.map((problem, idx) => {
                       const userAnswer = getAnswerForProblem(problem.id);
                       const isCorrect = userAnswer?.isCorrect || false;
                       const problemNumber = setIdx * wordsPerSet + idx + 1;
                       return (
                         <QuizReviewCard
                           key={problem.id}
                           problem={problem}
                           userAnswer={userAnswer?.userAnswer}
                           isCorrect={isCorrect}
                           problemNumber={problemNumber}
                         />
                       );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 flex justify-center">
             <Button
               size="lg"
               onClick={() => navigate('/')}
               className="rounded-full shadow-md font-bold px-8"
             >
               홈으로 가기
             </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
