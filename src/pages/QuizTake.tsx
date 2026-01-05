import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, Eye, EyeOff, ChevronRight, ChevronLeft, CheckCircle, Lightbulb, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";

interface Problem {
  id: string;
  word: string;
  answer?: string; // 학생용 데이터에서는 제거됨
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
}

interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  timer_enabled: boolean;
  timer_seconds: number | null;
  problems: Problem[];
  teacher_id: string;
  words: string[];
  words_per_set: number;
  translation_language: string;
}

interface UserAnswer {
  problemId: string;
  answer: string;
  isCorrect: boolean;
}

// 번역에서 정답 부분을 마스킹
const maskAnswerInTranslation = (translation: string, word: string): string => {
  if (!translation || !word) return translation;

  const words = translation.split(" ");
  const wordCount = words.length;

  if (wordCount <= 3) {
    // 짧은 문장: 가운데 단어 가리기
    const middleIdx = Math.floor(wordCount / 2);
    words[middleIdx] = "_____";
  } else {
    // 긴 문장: 2-3번째 단어 가리기 (보통 동사 위치)
    const verbIdx = Math.min(2, wordCount - 1);
    words[verbIdx] = "_____";
  }

  return words.join(" ");
};

export default function QuizTake() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wordsPerSet, setWordsPerSet] = useState(5);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchQuiz();
    }
  }, [user, id]);

  useEffect(() => {
    if (quiz?.timer_enabled && quiz.timer_seconds && timeLeft === null) {
      setTimeLeft(quiz.timer_seconds);
    }
  }, [quiz]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchQuiz = async () => {
    try {
      // 학생용 함수 사용 - 정답이 제거된 퀴즈 데이터 반환
      const { data, error } = await supabase.rpc("get_quiz_for_student", {
        _quiz_id: id,
      });

      if (error) {
        console.error("Quiz fetch error:", error);
        toast.error("퀴즈를 불러올 수 없습니다");
        navigate("/dashboard");
        return;
      }

      // Shuffle problems
      const quizData = data as unknown as Quiz;
      const shuffled = [...quizData.problems].sort(() => Math.random() - 0.5);
      
      // quiz_problems 테이블에서 audio URL 가져오기
      const { data: problemsData } = await supabase
        .from("quiz_problems")
        .select("problem_id, sentence_audio_url")
        .eq("quiz_id", id);
      
      // audio URL을 문제에 매핑
      const audioMap = new Map(
        problemsData?.map(p => [p.problem_id, p.sentence_audio_url]) || []
      );
      
      const problemsWithAudio = shuffled.map(problem => ({
        ...problem,
        sentence_audio_url: audioMap.get(problem.id) || undefined,
      }));
      
      setQuiz({ ...quizData, problems: problemsWithAudio });
      setWordsPerSet(quizData.words_per_set || 5);
      setIsLoading(false);
    } catch (err) {
      console.error("Quiz fetch error:", err);
      toast.error("퀴즈를 불러올 수 없습니다");
      navigate("/dashboard");
    }
  };

  // Group problems into sets
  const problemSets = quiz
    ? Array.from({ length: Math.ceil(quiz.problems.length / wordsPerSet) }, (_, i) =>
        quiz.problems.slice(i * wordsPerSet, (i + 1) * wordsPerSet),
      )
    : [];

  const currentSet = problemSets[currentSetIndex] || [];
  const totalSets = problemSets.length;
  const progress = quiz ? ((currentSetIndex + 1) / totalSets) * 100 : 0;

  // 세트가 변경될 때만 보기 단어 순서를 셔플 (리렌더링 시 순서 유지)
  const shuffledWordBank = useMemo(() => {
    return [...currentSet]
      .map((p) => p.word)
      .sort(() => Math.random() - 0.5);
  }, [currentSetIndex, quiz?.id]);

  const handleAnswerChange = (problemId: string, value: string) => {
    setUserAnswers({ ...userAnswers, [problemId]: value });
  };

  const toggleTranslation = (problemId: string) => {
    setShowTranslations((prev) => ({ ...prev, [problemId]: !prev[problemId] }));
  };

  const playAudio = useCallback((audioUrl: string, problemId: string) => {
    if (!audioUrl) return;
    
    // 이미 재생 중인 오디오 중지
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

  const handleSubmit = useCallback(async () => {
    if (!quiz || !user || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 서버에서 점수 계산 - 정답 조작 방지
      const studentAnswers: Record<string, string> = {};
      quiz.problems.forEach((problem) => {
        studentAnswers[problem.id] = userAnswers[problem.id] || "";
      });

      const { data, error } = await supabase.rpc("submit_quiz_answers", {
        _quiz_id: quiz.id,
        _student_answers: studentAnswers,
      });

      if (error) {
        console.error("Submit error:", error);
        throw new Error(error.message);
      }

      const result = data as { success: boolean; result_id: string; score: number; total: number };

      if (!result.success) {
        throw new Error("Submission failed");
      }

      // Navigate to results
      navigate(`/quiz/${quiz.id}/result/${result.result_id}`);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("제출에 실패했습니다");
      setIsSubmitting(false);
    }
  }, [quiz, user, userAnswers, navigate, isSubmitting]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const allAnswered = () => {
    if (!quiz) return false;
    return quiz.problems.every((p) => userAnswers[p.id]?.trim());
  };

  const currentSetAnswered = () => {
    return currentSet.every((p) => userAnswers[p.id]?.trim());
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || role !== "student") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-lg">{quiz.title}</h1>
              <LevelBadge level={quiz.difficulty} />
            </div>

            <div className="flex items-center gap-4">
              {quiz.timer_enabled && timeLeft !== null && (
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${timeLeft < 30 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {currentSetIndex * wordsPerSet + 1}-
                {Math.min((currentSetIndex + 1) * wordsPerSet, quiz.problems.length)} / {quiz.problems.length}
              </span>
            </div>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Set Label */}
        <div className="mb-4 text-center">
          <span className="inline-block px-4 py-2 bg-muted rounded-md text-lg font-semibold">
            세트 {currentSetIndex + 1}
          </span>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardContent className="py-6">
            {/* Word Bank - get words from CURRENT SET's problems, shuffled once per set */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
              <div className="flex flex-wrap justify-center gap-2">
                {shuffledWordBank.map((word, idx) => (
                  <span key={idx} className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium">
                    {word}
                  </span>
                ))}
              </div>
            </div>

            {/* Problems List */}
            <div className="space-y-0 divide-y">
              {currentSet.map((problem, idx) => {
                const problemNumber = currentSetIndex * wordsPerSet + idx + 1;
                // Clean up sentence: remove trailing punctuation duplicates
                let sentence = problem.sentence;
                sentence = sentence.replace(/([.?!])\s*\.+\s*$/, "$1");
                sentence = sentence.replace(/\.\s*\.$/, ".");
                const parts = sentence.split(/\(\s*\)|\(\)/);

                return (
                  <div key={problem.id} className="py-4">
                    {/* Mobile Layout: Stacked */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex items-start gap-2">
                        <span className="text-primary font-bold">{problemNumber}.</span>
                        <div className="flex-1">
                          <p className="text-base leading-relaxed">
                            {parts[0]}
                            <span className="text-muted-foreground">( _____ )</span>
                            {problem.hint && <span className="text-primary text-sm ml-1">{problem.hint}</span>}
                            {parts[1]}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {problem.sentence_audio_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => playAudio(problem.sentence_audio_url!, problem.id)}
                            >
                              <Volume2 className={`w-4 h-4 ${playingAudio === problem.id ? "text-primary animate-pulse" : ""}`} />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleTranslation(problem.id)}
                          >
                            <Lightbulb className={`w-4 h-4 ${showTranslations[problem.id] ? "text-warning" : ""}`} />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={userAnswers[problem.id] || ""}
                        onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                        className="h-10 text-center"
                        placeholder="정답 입력"
                        autoComplete="off"
                      />
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                          {maskAnswerInTranslation(problem.translation, problem.answer)}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout: Inline */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-bold min-w-[24px]">{problemNumber}.</span>
                        <div className="flex-1 flex items-center flex-wrap gap-1">
                          {parts.map((part, partIdx, arr) => (
                            <span key={partIdx} className="inline-flex items-center">
                              <span className="text-base whitespace-nowrap">{part}</span>
                              {partIdx < arr.length - 1 && (
                                <>
                                  <Input
                                    value={userAnswers[problem.id] || ""}
                                    onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                    className="w-48 h-8 mx-1 text-center text-sm inline-block"
                                    autoComplete="off"
                                  />
                                  {problem.hint && <span className="text-primary text-sm">{problem.hint}</span>}
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {problem.sentence_audio_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => playAudio(problem.sentence_audio_url!, problem.id)}
                            >
                              <Volume2 className={`w-4 h-4 mr-1 ${playingAudio === problem.id ? "text-primary animate-pulse" : ""}`} />
                              듣기
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleTranslation(problem.id)}
                          >
                            <Lightbulb className={`w-4 h-4 mr-1 ${showTranslations[problem.id] ? "text-warning" : ""}`} />
                            힌트
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-2 ml-8 px-4 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                          {maskAnswerInTranslation(problem.translation, problem.answer)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handlePrevSet} disabled={currentSetIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전
          </Button>

          {currentSetIndex === totalSets - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !allAnswered()}
              className="bg-success hover:bg-success/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              제출하기
            </Button>
          ) : (
            <Button onClick={handleNextSet} disabled={!currentSetAnswered()}>
              다음 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
