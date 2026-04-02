import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SentenceMakingStage } from "@/components/quiz/SentenceMakingStage";
import { SpeakingStage } from "@/components/quiz/SpeakingStage";
import { FillBlankStage } from "@/components/quiz/FillBlankStage";
import { FillBlankResultStage } from "@/components/quiz/FillBlankResultStage";
import { SentenceMakingResultStage } from "@/components/quiz/SentenceMakingResultStage";
import { SpeakingResultStage } from "@/components/quiz/SpeakingResultStage";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, Eye, EyeOff, ChevronRight, ChevronLeft, CheckCircle, Lightbulb, Volume2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { maskTranslation } from "@/utils/maskTranslation";

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
  // 새로운 퀴즈 유형 옵션
  sentence_making_enabled?: boolean;
  recording_enabled?: boolean;
}

interface SentenceMakingProblemData {
  id: string;
  word: string;
}

interface RecordingProblemData {
  id: string;
  sentence: string;
  mode: "read" | "listen";
  sentenceAudioUrl: string | null;
  translation: string | null;
}

type QuizStage = "fill_blank" | "fill_blank_result" | "sentence_making" | "sentence_making_result" | "recording" | "recording_result" | "completed";

interface UserAnswer {
  problemId: string;
  answer: string;
  isCorrect: boolean;
}



export default function QuizTake() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wordsPerSet, setWordsPerSet] = useState(5);
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('share');
  const anonymousName = searchParams.get('name') || "";
  const isAnonymous = !!shareToken && !user;
  const [isInitialized, setIsInitialized] = useState(false);

  // 멀티 스테이지 퀴즈 지원
  const [currentStage, setCurrentStage] = useState<QuizStage>("fill_blank");
  const [stageResults, setStageResults] = useState<Record<string, any>>({});
  const [sentenceMakingProblems, setSentenceMakingProblems] = useState<SentenceMakingProblemData[]>([]);
  const [recordingProblems, setRecordingProblems] = useState<RecordingProblemData[]>([]);
  const [fillBlankAnswers, setFillBlankAnswers] = useState<any[]>([]);
  const [sentenceMakingResults, setSentenceMakingResults] = useState<Record<string, any>>({});
  
  const [stageProgress, setStageProgress] = useState({ current: 0, total: 0, label: "" });

  const handleProgressUpdate = useCallback((current: number, total: number, label: string) => {
    setStageProgress({ current, total, label });
  }, []);

  // 전역 단계(Stepper) 구성을 위한 배열 계산
  const globalStages = useMemo(() => {
    if (!quiz) return [];
    const stages = [{ id: "fill_blank", label: "단어 학습" }];
    if (quiz.sentence_making_enabled) stages.push({ id: "sentence_making", label: "문장 만들기" });
    if (quiz.recording_enabled) stages.push({ id: "recording", label: "말하기 연습" });
    return stages;
  }, [quiz]);

  const getCurrentGlobalStageIndex = () => {
    if (currentStage.includes("recording")) return globalStages.findIndex(s => s.id === "recording");
    if (currentStage.includes("sentence_making")) return globalStages.findIndex(s => s.id === "sentence_making");
    return 0; // fill_blank 가본값
  };

  // Wait for initial render to complete before checking auth
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    // quiz가 이미 로드되었으면 다시 로드하지 않음 (창 포커스 시 재실행 방지)
    if (quiz) return;

    if ((user || shareToken) && id) {
      fetchQuiz();
    }
  }, [user?.id, shareToken, id]);

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
      let quizData: Quiz;

      if (shareToken) {
        // Shared link access (Anonymous or Logged-in): load quiz directly
        const { data: quiz, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", id)
          .single();

        if (quizError || !quiz) {
          console.error("Quiz fetch error:", quizError);
          toast.error("퀴즈를 불러올 수 없습니다");
          navigate("/");
          return;
        }

        // Problems are already in the quiz.problems JSONB field
        // Remove answers for security
        const problemsWithoutAnswers = ((quiz.problems as any[]) || []).map((p: any) => ({
          id: p.id,
          word: p.word,
          sentence: p.sentence,
          hint: p.hint,
          translation: p.translation,
          sentence_audio_url: p.sentence_audio_url,
        }));

        quizData = {
          ...quiz,
          problems: problemsWithoutAnswers,
        } as Quiz;
      } else {
        // Authenticated users with assigned quiz: use RPC function
        const { data, error } = await supabase.rpc("get_quiz_for_student", {
          _quiz_id: id,
        });

        if (error) {
          console.error("Quiz fetch error:", error);
          toast.error("퀴즈를 불러올 수 없습니다");
          navigate("/dashboard");
          return;
        }

        quizData = data as unknown as Quiz;
      }

      // Shuffle problems
      const shuffled = [...quizData.problems].sort(() => Math.random() - 0.5);
      
      // quiz_problems 테이블에서 audio URL 가져오기 (if not already loaded)
      if (!isAnonymous) {
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
          sentence_audio_url: audioMap.get(problem.id) || problem.sentence_audio_url,
        }));
        
        setQuiz({ ...quizData, problems: problemsWithAudio });
      } else {
        setQuiz({ ...quizData, problems: shuffled });
      }
      
      setWordsPerSet(quizData.words_per_set || 5);

      // 문장 만들기 문제 가져오기
      if (quizData.sentence_making_enabled) {
        const { data: smProblems } = await supabase
          .from("sentence_making_problems")
          .select("id, word")
          .eq("quiz_id", id);

        if (smProblems && smProblems.length > 0) {
          // 문제 순서 셔플
          const shuffledSM = [...smProblems].sort(() => Math.random() - 0.5);
          setSentenceMakingProblems(shuffledSM);
        }
      }

      // 녹음 문제 가져오기
      if (quizData.recording_enabled) {
        const { data: recProblems } = await supabase
          .from("recording_problems")
          .select("id, sentence, mode, sentence_audio_url, translation")
          .eq("quiz_id", id);

        if (recProblems && recProblems.length > 0) {
          // 문제 순서 셔플
          const shuffledRec = [...recProblems].sort(() => Math.random() - 0.5);
          setRecordingProblems(shuffledRec.map(p => ({
            id: p.id,
            sentence: p.sentence,
            mode: p.mode as "read" | "listen",
            sentenceAudioUrl: p.sentence_audio_url,
            translation: p.translation,
          })));
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Quiz fetch error:", err);
      toast.error("퀴즈를 불러올 수 없습니다");
      navigate("/dashboard");
    }
  };

  const handleAnswerChange = (problemId: string, value: string) => {
    setUserAnswers({ ...userAnswers, [problemId]: value });
  };

  const handleSubmit = useCallback(async () => {
    if (!quiz || isSubmitting) return;
    
    // Shared Link users (Anonymous OR Logged-in): direct submission
    if (shareToken) {
      setIsSubmitting(true);

      try {
        // Load full quiz data with answers for scoring
        const { data: fullQuiz, error } = await supabase
          .from("quizzes")
          .select("problems")
          .eq("id", quiz.id)
          .single();

        if (error || !fullQuiz) {
          toast.error("결과를 계산할 수 없습니다");
          setIsSubmitting(false);
          return;
        }

        const fullProblems = (fullQuiz.problems as any[]) || [];
        
        // Calculate score
        let correctCount = 0;
        const detailedAnswers = quiz.problems.map(problem => {
          const userAnswer = (userAnswers[problem.id] || "").trim();
          const fullProblem = fullProblems.find((p: any) => p.id === problem.id);
          const correctAnswer = fullProblem?.answer || "";
          const isCorrect = userAnswer === correctAnswer;
          
          if (isCorrect) correctCount++;
          
          return {
            problemId: problem.id,
            userAnswer,
            correctAnswer,
            isCorrect,
            sentence: problem.sentence,
            translation: problem.translation,
            audioUrl: problem.sentence_audio_url,
            word: problem.word,
          };
        });

        // Save result to localStorage
        const resultData = {
          quizId: quiz.id,
          quizTitle: quiz.title,
          score: correctCount,
          total: quiz.problems.length,
          answers: detailedAnswers,
          sentenceMakingResults: quiz.sentence_making_enabled ? sentenceMakingResults : undefined,
          speakingResults: quiz.recording_enabled ? stageResults.recording : undefined,
        };
        
        localStorage.setItem('anonymous_quiz_result', JSON.stringify(resultData));
        
        // Calculate sub-scores for sentence_making and recording
        let smScore = 0, smTotal = 0;
        let recScore = 0, recTotal = 0;

        if (quiz.sentence_making_enabled && Object.keys(sentenceMakingResults).length > 0) {
          smTotal = sentenceMakingProblems.length;
          smScore = sentenceMakingProblems.filter((p: any) =>
            (sentenceMakingResults[p.id] as any[])?.some((a: any) => a.isPassed)
          ).length;
        }

        if (quiz.recording_enabled && stageResults.recording) {
          recTotal = recordingProblems.length;
          recScore = recordingProblems.filter((p: any) => {
            const problemAttempts = (stageResults.recording[p.id] || []) as any[];
            return problemAttempts.some((a: any) => a.isPassed);
          }).length;
        }

        // Save to Database
        if (shareToken) {
          const { data: insertedResult, error: insertError } = await supabase
            .from("quiz_results")
            .insert({
              quiz_id: quiz.id,
              student_id: user ? user.id : null,
              score: correctCount + smScore + recScore,
              total_questions: quiz.problems.length + smTotal + recTotal,
              answers: detailedAnswers,
              is_anonymous: !user,
              anonymous_name: user ? "" : (anonymousName || "Anonymous"),
              share_token: shareToken,
              completed_at: new Date().toISOString(),
              fill_blank_score: correctCount,
              fill_blank_total: quiz.problems.length,
              sentence_making_score: smTotal > 0 ? smScore : null,
              sentence_making_total: smTotal > 0 ? smTotal : null,
              recording_score: recTotal > 0 ? recScore : null,
              recording_total: recTotal > 0 ? recTotal : null,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error("Failed to save result:", insertError);
            toast.error("결과 저장에 실패했지만, 로컬 결과는 확인할 수 있습니다.");
          }

          // Save sentence_making_answers
          if (insertedResult && quiz.sentence_making_enabled && Object.keys(sentenceMakingResults).length > 0) {
            const smAnswers: any[] = [];
            for (const [problemId, attempts] of Object.entries(sentenceMakingResults) as [string, any[]][]) {
              for (const attempt of attempts) {
                smAnswers.push({
                  quiz_id: quiz.id,
                  result_id: insertedResult.id,
                  problem_id: problemId,
                  student_id: user ? user.id : null,
                  attempt_number: attempt.attemptNumber,
                  student_sentence: attempt.sentence,
                  word_usage_score: attempt.wordUsageScore || 0,
                  grammar_score: attempt.grammarScore || 0,
                  naturalness_score: attempt.naturalnessScore || 0,
                  total_score: attempt.totalScore,
                  ai_feedback: attempt.feedback,
                  model_answer: attempt.modelAnswer,
                  is_passed: attempt.isPassed,
                });
              }
            }
            const { error: smError } = await (supabase as any).from("sentence_making_answers").insert(smAnswers);
            if (smError) console.error("Failed to save sentence making answers:", smError);
          }

          // Save recording_answers
          if (insertedResult && quiz.recording_enabled && stageResults.recording) {
            const recAnswers: any[] = [];
            for (const [problemId, attempts] of Object.entries(stageResults.recording) as [string, any[]][]) {
              for (const attempt of attempts) {
                recAnswers.push({
                  quiz_id: quiz.id,
                  result_id: insertedResult.id,
                  problem_id: problemId,
                  student_id: user ? user.id : null,
                  attempt_number: attempt.attemptNumber,
                  recording_url: attempt.recordingUrl,
                  pronunciation_score: attempt.pronunciationScore,
                  accuracy_score: attempt.accuracyScore,
                  fluency_score: attempt.fluencyScore,
                  completeness_score: attempt.completenessScore,
                  prosody_score: attempt.prosodyScore,
                  overall_score: attempt.overallScore,
                  word_level_feedback: attempt.wordLevelFeedback,
                  is_passed: attempt.isPassed,
                });
              }
            }
            const { error: recError } = await (supabase as any).from("recording_answers").insert(recAnswers);
            if (recError) console.error("Failed to save recording answers:", recError);
          }

          // Increment completion count for the share link
          const { data: shareData } = await supabase
            .from("quiz_shares")
            .select("completion_count")
            .eq("share_token", shareToken)
            .single();

          if (shareData) {
            await supabase
              .from("quiz_shares")
              .update({ completion_count: shareData.completion_count + 1 })
              .eq("share_token", shareToken);
          }
        }
        
        // Navigate to result page
        navigate(`/quiz/share/result?token=${shareToken}`);
      } catch (error) {
        console.error("Anonymous submit error:", error);
        toast.error("결과를 저장할 수 없습니다");
        setIsSubmitting(false);
        return; // Stop here if error
      }

      // Notification logic - use RPC to bypass RLS for anonymous users
      if (shareToken) {
        try {
          // Call the security definer function to send notification
          const { error: notifyError } = await supabase.rpc("notify_quiz_completion", {
            _quiz_id: quiz.id,
            _anonymous_name: anonymousName || "Anonymous"
          });

          if (notifyError) {
             console.error("Failed to send notification via RPC:", notifyError);
          }
        } catch (err) {
          console.error("Notification handling error:", err);
        }
      }
      
      return navigate(`/quiz/share/result?token=${shareToken}`);
    }

    if (!user) return; // Should not happen if shareToken logic covers it, but for safety

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

      // 유형별 점수 계산 및 데이터 저장
      const fillBlankScore = result.score;
      const fillBlankTotal = result.total;
      let smScore = 0, smTotal = 0;
      let recScore = 0, recTotal = 0;

      // 문장 만들기 답안 저장
      if (quiz.sentence_making_enabled && Object.keys(sentenceMakingResults).length > 0) {
        const smAnswers: any[] = [];
        for (const [problemId, attempts] of Object.entries(sentenceMakingResults) as [string, any[]][]) {
          for (const attempt of attempts) {
            smAnswers.push({
              quiz_id: quiz.id,
              result_id: result.result_id,
              problem_id: problemId,
              student_id: user!.id,
              attempt_number: attempt.attemptNumber,
              student_sentence: attempt.sentence,
              word_usage_score: attempt.wordUsageScore || 0,
              grammar_score: attempt.grammarScore || 0,
              naturalness_score: attempt.naturalnessScore || 0,
              total_score: attempt.totalScore,
              ai_feedback: attempt.feedback,
              model_answer: attempt.modelAnswer,
              is_passed: attempt.isPassed,
            });
          }
        }
        const { error: smError } = await (supabase as any).from("sentence_making_answers").insert(smAnswers);
        if (smError) console.error("Failed to save sentence making answers:", smError);

        smTotal = sentenceMakingProblems.length;
        smScore = sentenceMakingProblems.filter((p: any) =>
          (sentenceMakingResults[p.id] as any[])?.some((a: any) => a.isPassed)
        ).length;
      }

      // 녹음 답안 저장
      if (quiz.recording_enabled && stageResults.recording) {
        const recAnswers: any[] = [];
        for (const [problemId, attempts] of Object.entries(stageResults.recording) as [string, any[]][]) {
          for (const attempt of attempts) {
            recAnswers.push({
              quiz_id: quiz.id,
              result_id: result.result_id,
              problem_id: problemId,
              student_id: user!.id,
              attempt_number: attempt.attemptNumber,
              recording_url: attempt.recordingUrl,
              pronunciation_score: attempt.pronunciationScore,
              accuracy_score: attempt.accuracyScore,
              fluency_score: attempt.fluencyScore,
              completeness_score: attempt.completenessScore,
              prosody_score: attempt.prosodyScore,
              overall_score: attempt.overallScore,
              word_level_feedback: attempt.wordLevelFeedback,
              is_passed: attempt.isPassed,
            });
          }
        }
        const { error: recError } = await (supabase as any).from("recording_answers").insert(recAnswers);
        if (recError) console.error("Failed to save recording answers:", recError);

        recTotal = recordingProblems.length;
        recScore = recordingProblems.filter((p: any) => {
          const problemAttempts = (stageResults.recording[p.id] || []) as any[];
          return problemAttempts.some((a: any) => a.isPassed);
        }).length;
      }

      // quiz_results 유형별 점수 업데이트 (SECURITY DEFINER RPC 사용)
      const { error: updateError } = await supabase.rpc("update_quiz_result_scores" as any, {
        _result_id: result.result_id,
        _fill_blank_score: fillBlankScore,
        _fill_blank_total: fillBlankTotal,
        _sentence_making_score: smScore,
        _sentence_making_total: smTotal,
        _recording_score: recScore,
        _recording_total: recTotal,
      });
      if (updateError) console.error("Failed to update quiz_results scores:", updateError);

      // Navigate to results
      navigate(`/quiz/${quiz.id}/result/${result.result_id}`);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("제출에 실패했습니다");
      setIsSubmitting(false);
    }
  }, [quiz, user, userAnswers, navigate, isSubmitting, isAnonymous, shareToken, anonymousName, sentenceMakingResults, stageResults, sentenceMakingProblems, recordingProblems]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading || isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow anonymous users with share token - check shareToken first!
  if (!user && !shareToken) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in users must be students (unless they have a share token)
  if (user && role !== "student" && !shareToken) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz) return null;

  // 다음 스테이지 결정 (fill_blank 완료 후 -> fill_blank_result 또는 completed)
  const getStageAfterFillBlankResult = (): QuizStage => {
    if (quiz.sentence_making_enabled) return "sentence_making";
    if (quiz.recording_enabled) return "recording";
    return "completed";
  };

  const getNextStage = (current: QuizStage): QuizStage => {
    if (current === "fill_blank") {
      return "fill_blank_result";
    }
    if (current === "fill_blank_result") {
      if (quiz.sentence_making_enabled) return "sentence_making";
      if (quiz.recording_enabled) return "recording";
      return "completed";
    }
    if (current === "sentence_making") {
      return "sentence_making_result";
    }
    if (current === "sentence_making_result") {
      if (quiz.recording_enabled) return "recording";
      return "completed";
    }
    if (current === "recording") {
      return "recording_result";
    }
    if (current === "recording_result") {
      return "completed";
    }
    return "completed";
  };

  // 빈칸 채우기 완료 핸들러
  const handleFillBlankComplete = async () => {
    // 다른 스테이지가 없으면 바로 제출
    if (!quiz.sentence_making_enabled && !quiz.recording_enabled) {
      await handleSubmit();
      return;
    }

    // 서버에서 정답 가져와서 채점 (임시, 최종 제출은 나중에)
    try {
      const { data: fullQuiz, error } = await supabase
        .from("quizzes")
        .select("problems")
        .eq("id", quiz.id)
        .single();

      if (error || !fullQuiz) {
        toast.error("결과를 계산할 수 없습니다.");
        return;
      }

      const fullProblems = (fullQuiz.problems as any[]) || [];
      const detailedAnswers = quiz.problems.map((problem) => {
        const userAnswer = (userAnswers[problem.id] || "").trim();
        const fullProblem = fullProblems.find((p: any) => p.id === problem.id);
        const correctAnswer = fullProblem?.answer || "";
        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

        return {
          problemId: problem.id,
          userAnswer,
          correctAnswer,
          isCorrect,
          sentence: problem.sentence,
          word: problem.word,
          hint: problem.hint,
          translation: problem.translation,
          sentence_audio_url: problem.sentence_audio_url,
        };
      });

      setFillBlankAnswers(detailedAnswers);
      setStageResults((prev) => ({ ...prev, fill_blank: userAnswers }));
      setCurrentStage("fill_blank_result");
    } catch (err) {
      console.error("Fill blank result error:", err);
      toast.error("결과를 불러올 수 없습니다.");
    }
  };

  // 빈칸 채우기 결과 → 다음 스테이지로
  const handleFillBlankResultNext = () => {
    const next = getStageAfterFillBlankResult();
    if (next === "completed") {
      handleSubmit();
    } else {
      setCurrentStage(next);
    }
  };

  // 문장 만들기 완료 핸들러 → 결과 페이지로
  const handleSentenceMakingComplete = (results: Record<string, any>) => {
    setStageResults((prev) => ({ ...prev, sentence_making: results }));
    setSentenceMakingResults(results);
    setCurrentStage("sentence_making_result");
  };

  // 문장 만들기 결과 → 다음 스테이지로
  const handleSentenceMakingResultNext = () => {
    const next = getNextStage("sentence_making_result");
    if (next === "completed") {
      handleSubmit();
    } else {
      setCurrentStage(next);
    }
  };

  // 녹음 완료 핸들러 → 전체 결과 페이지로
  const handleRecordingComplete = (results: Record<string, any>) => {
    setStageResults((prev) => ({ ...prev, recording: results }));
    setCurrentStage("recording_result");
  };

  // 녹음 전체 결과에서 완료
  const handleRecordingResultComplete = () => {
    handleSubmit();
  };



  const renderStageContent = () => {
    // 빈칸 채우기 결과 스테이지 렌더링
    if (currentStage === "fill_blank_result" && fillBlankAnswers.length > 0) {
      const nextStage = getStageAfterFillBlankResult();
      const nextLabel =
        nextStage === "sentence_making"
          ? "다음 단계로"
          : nextStage === "recording"
          ? "다음 단계로"
          : "결과 제출";

      const correctCount = fillBlankAnswers.filter((a) => a.isCorrect).length;
      const totalCount = fillBlankAnswers.length;
      const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">빈칸 채우기 결과</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-6 mb-6">
            <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{score}점</p>
            <p className="text-lg font-medium text-slate-600 mt-3">
              {totalCount}문제 중 <span className="text-primary font-bold">{correctCount}</span>문제를 맞혔어요!
            </p>
          </div>
          <FillBlankResultStage
            answers={fillBlankAnswers}
            onNext={handleFillBlankResultNext}
            nextLabel={nextLabel}
          />
        </div>
      );
    }

    // 문장 만들기 스테이지 렌더링
    if (currentStage === "sentence_making" && quiz.sentence_making_enabled && sentenceMakingProblems.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <SentenceMakingStage
            quizId={quiz.id}
            problems={sentenceMakingProblems}
            difficulty={quiz.difficulty}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleSentenceMakingComplete}
          />
        </div>
      );
    }

    // 문장 만들기 결과 스테이지 렌더링
    if (currentStage === "sentence_making_result" && Object.keys(sentenceMakingResults).length > 0) {
      const nextStage = getNextStage("sentence_making_result");
      const nextLabel =
        nextStage === "recording"
          ? "다음 단계로"
          : "결과 제출";

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">문장 만들기 결과</h2>
          </div>
          <SentenceMakingResultStage
            problems={sentenceMakingProblems}
            results={sentenceMakingResults}
            onNext={handleSentenceMakingResultNext}
            nextLabel={nextLabel}
          />
        </div>
      );
    }

    if (currentStage === "recording" && quiz.recording_enabled && recordingProblems.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <SpeakingStage
            quizId={quiz.id}
            problems={recordingProblems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleRecordingComplete}
          />
        </div>
      );
    }

    // 녹음 전체 결과 스테이지 렌더링
    if (currentStage === "recording_result" && stageResults.recording) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">말하기 연습 결과</h2>
          </div>
          <SpeakingResultStage
            problems={recordingProblems.map((p) => ({
              id: p.id,
              sentence: p.sentence,
              mode: p.mode,
              sentenceAudioUrl: p.sentenceAudioUrl,
              translation: p.translation,
            }))}
            attempts={stageResults.recording}
            onComplete={handleRecordingResultComplete}
          />
        </div>
      );
    }

    // 기본: 빈칸 채우기 (fill_blank)
    return (
      <div className="container w-full max-w-5xl mx-auto px-4 py-8">
        <FillBlankStage
          problems={quiz.problems as any}
          wordsPerSet={wordsPerSet}
          isAnonymous={isAnonymous}
          hasNextStage={!!(quiz.sentence_making_enabled || quiz.recording_enabled)}
          userAnswers={userAnswers}
          onAnswerChange={handleAnswerChange}
          onProgressUpdate={handleProgressUpdate}
          onComplete={handleFillBlankComplete}
        />
      </div>
    );
  };

  const currentGlobalIndex = getCurrentGlobalStageIndex();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      {/* 퀴즈 공통 Header & Global Stepper */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:gap-4">
            
            {/* 첫 번째 줄: 퀴즈 제목 + 난이도, (데스크톱) 스텝퍼, 타이머 */}
            <div className="flex items-center justify-between gap-4">
              
              {/* 왼쪽: 퀴즈 제목 + 난이도 뱃지 */}
              <div className="flex items-center gap-3 shrink-0">
                <h1 className="font-bold text-lg text-foreground truncate max-w-[150px] sm:max-w-[200px] lg:max-w-xs">{quiz.title}</h1>
                <LevelBadge level={quiz.difficulty} />
              </div>

              {/* 중앙: Global Stepper UI (모바일에선 숨김) */}
              {globalStages.length > 1 && (
                <div className="hidden sm:flex flex-1 justify-center items-center gap-1 lg:gap-2">
                  {globalStages.map((stage, idx) => (
                    <div key={stage.id} className="flex items-center">
                      <div className={`flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                        idx === currentGlobalIndex
                          ? "bg-primary text-primary-foreground shadow-md"
                          : idx < currentGlobalIndex
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground bg-muted"
                      }`}>
                        {/* 활성화된 뱃지의 숫자 배경을 눈에 잘 띄게 흰색으로 적용 */}
                        <span className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs shadow-sm font-bold ${
                          idx === currentGlobalIndex 
                            ? "bg-white text-primary" 
                            : idx < currentGlobalIndex 
                            ? "bg-primary text-white" 
                            : "bg-background text-muted-foreground"
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="hidden md:inline-block px-1">{stage.label}</span>
                      </div>
                      {idx < globalStages.length - 1 && (
                        <div className="w-2 sm:w-6 lg:w-8 h-px bg-border mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 오른쪽: 타이머 */}
              <div className="shrink-0">
                {quiz.timer_enabled && timeLeft !== null && (
                  <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold border ${timeLeft < 30 ? "bg-destructive/10 text-destructive border-transparent" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="font-mono">{formatTime(timeLeft)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 두 번째 줄: 진행 상황 정보(프로그레스 바) */}
            {stageProgress.total > 0 && !currentStage.includes("_result") && currentStage !== "completed" && (
              <div className="flex items-center justify-between gap-4 w-full px-1">
                <Progress 
                  value={stageProgress.total > 0 ? (stageProgress.current / stageProgress.total) * 100 : 0} 
                  className="flex-1 h-2.5" 
                />
                <span className="shrink-0 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm border border-slate-200">
                  {stageProgress.label}
                </span>
              </div>
            )}
            
          </div>
        </div>
      </div>
      
      {/* 현재 스테이지별 내용 */}
      {renderStageContent()}
    </div>
  );
}
