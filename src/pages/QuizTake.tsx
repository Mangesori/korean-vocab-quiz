import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SentenceMakingStage } from "@/components/quiz/SentenceMakingStage";
import { SpeakingStage } from "@/components/quiz/SpeakingStage";
import { FillBlankStage } from "@/components/quiz/FillBlankStage";
import { FillBlankResultStage } from "@/components/quiz/FillBlankResultStage";
import { SentenceMakingResultStage } from "@/components/quiz/SentenceMakingResultStage";
import { SpeakingResultStage } from "@/components/quiz/SpeakingResultStage";
import { MatchUpStage, type MatchUpProblemData, type MatchUpResult } from "@/components/quiz/MatchUpStage";
import { MatchUpResultStage } from "@/components/quiz/MatchUpResultStage";
import { TypeAnswerStage, type TypeAnswerProblemData, type TypeAnswerGradeResult } from "@/components/quiz/TypeAnswerStage";
import { TypeAnswerResultStage } from "@/components/quiz/TypeAnswerResultStage";
import { WordMagnetStage, type WordMagnetProblemData } from "@/components/quiz/WordMagnetStage";
import { WordMagnetResultStage, type WordMagnetGradeResult } from "@/components/quiz/WordMagnetResultStage";
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
  matchup_enabled?: boolean;
  type_answer_enabled?: boolean;
  word_magnet_enabled?: boolean;
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

type QuizStage = "fill_blank" | "fill_blank_result" | "matchup" | "matchup_result" | "type_answer" | "type_answer_result" | "word_magnet" | "word_magnet_result" | "sentence_making" | "sentence_making_result" | "recording" | "recording_result" | "completed";

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
  const [matchupProblems, setMatchupProblems] = useState<MatchUpProblemData[]>([]);
  const [matchupResults, setMatchupResults] = useState<Record<string, MatchUpResult>>({});
  const [typeAnswerProblems, setTypeAnswerProblems] = useState<TypeAnswerProblemData[]>([]);
  const [typeAnswerResults, setTypeAnswerResults] = useState<TypeAnswerGradeResult[]>([]);
  const [wordMagnetProblems, setWordMagnetProblems] = useState<WordMagnetProblemData[]>([]);
  const [wordMagnetResults, setWordMagnetResults] = useState<WordMagnetGradeResult[]>([]);
  const [fillBlankAnswers, setFillBlankAnswers] = useState<any[]>([]);
  const [sentenceMakingResults, setSentenceMakingResults] = useState<Record<string, any>>({});
  const [quizResultId, setQuizResultId] = useState<string | null>(null);
  const [savedFillBlankScore, setSavedFillBlankScore] = useState<{ score: number; total: number } | null>(null);
  const [savedSentenceMakingScore, setSavedSentenceMakingScore] = useState<{ score: number; total: number } | null>(null);
  const [savedMatchupScore, setSavedMatchupScore] = useState<{ score: number; total: number } | null>(null);
  const [savedTypeAnswerScore, setSavedTypeAnswerScore] = useState<{ score: number; total: number } | null>(null);
  const [savedWordMagnetScore, setSavedWordMagnetScore] = useState<{ score: number; total: number } | null>(null);
  const [isRedo, setIsRedo] = useState(false);
  
  const [stageProgress, setStageProgress] = useState({ current: 0, total: 0, label: "" });

  const handleProgressUpdate = useCallback((current: number, total: number, label: string) => {
    setStageProgress({ current, total, label });
  }, []);

  // 전역 단계(Stepper) 구성을 위한 배열 계산
  const globalStages = useMemo(() => {
    if (!quiz) return [];
    const stages: { id: string; label: string }[] = [];
    if (quiz.fill_blank_enabled !== false) stages.push({ id: "fill_blank", label: "빈칸 채우기" });
    if (quiz.matchup_enabled) stages.push({ id: "matchup", label: "매치업" });
    if (quiz.type_answer_enabled) stages.push({ id: "type_answer", label: "답 입력" });
    if (quiz.word_magnet_enabled) stages.push({ id: "word_magnet", label: "워드 마그넷" });
    if (quiz.sentence_making_enabled) stages.push({ id: "sentence_making", label: "문장 만들기" });
    if (quiz.recording_enabled) stages.push({ id: "recording", label: "말하기 연습" });
    return stages;
  }, [quiz]);

  const getCurrentGlobalStageIndex = () => {
    if (currentStage.includes("recording")) return globalStages.findIndex(s => s.id === "recording");
    if (currentStage.includes("sentence_making")) return globalStages.findIndex(s => s.id === "sentence_making");
    if (currentStage.includes("word_magnet")) return globalStages.findIndex(s => s.id === "word_magnet");
    if (currentStage.includes("type_answer")) return globalStages.findIndex(s => s.id === "type_answer");
    if (currentStage.includes("matchup")) return globalStages.findIndex(s => s.id === "matchup");
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

  // 빈칸 채우기를 끈 퀴즈: 첫 활성 스테이지에서 시작 (resume은 checkProgress가 덮어씀)
  useEffect(() => {
    if (!quiz || quiz.fill_blank_enabled !== false) return;
    if (currentStage !== "fill_blank") return;
    if (quiz.matchup_enabled) setCurrentStage("matchup");
    else if (quiz.type_answer_enabled) setCurrentStage("type_answer");
    else if (quiz.word_magnet_enabled) setCurrentStage("word_magnet");
    else if (quiz.sentence_making_enabled) setCurrentStage("sentence_making");
    else if (quiz.recording_enabled) setCurrentStage("recording");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

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

  // 이전 진행 상태 확인 — 로그인 학생이 같은 퀴즈에 재진입할 때 완료된 단계 건너뜀
  useEffect(() => {
    if (!quiz || !user || isAnonymous) return;

    const checkProgress = async () => {
      const { data: existing } = await (supabase as any)
        .from("quiz_results")
        .select("id, score, total_questions, matchup_score, matchup_total, type_answer_score, type_answer_total, word_magnet_score, word_magnet_total, sentence_making_score, sentence_making_total, recording_score")
        .eq("quiz_id", quiz.id)
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existing) return;

      const muDone = !quiz.matchup_enabled || (existing as any).matchup_score !== null;
      const taDone = !quiz.type_answer_enabled || (existing as any).type_answer_score !== null;
      const wmDone = !quiz.word_magnet_enabled || (existing as any).word_magnet_score !== null;
      const smDone = !quiz.sentence_making_enabled || existing.sentence_making_score !== null;
      const recDone = !quiz.recording_enabled || existing.recording_score !== null;

      if (muDone && taDone && wmDone && smDone && recDone) return;

      setQuizResultId(existing.id);
      setSavedFillBlankScore({
        score: existing.score,
        total: existing.total_questions ?? 0,
      });
      // 이미 완료한 후속 스테이지 점수 복원
      if (quiz.matchup_enabled && (existing as any).matchup_score !== null) {
        setSavedMatchupScore({
          score: (existing as any).matchup_score,
          total: (existing as any).matchup_total ?? 0,
        });
      }
      if (quiz.type_answer_enabled && (existing as any).type_answer_score !== null) {
        setSavedTypeAnswerScore({
          score: (existing as any).type_answer_score,
          total: (existing as any).type_answer_total ?? 0,
        });
      }
      if (quiz.word_magnet_enabled && (existing as any).word_magnet_score !== null) {
        setSavedWordMagnetScore({
          score: (existing as any).word_magnet_score,
          total: (existing as any).word_magnet_total ?? 0,
        });
      }
      if (quiz.sentence_making_enabled && existing.sentence_making_score !== null) {
        setSavedSentenceMakingScore({
          score: existing.sentence_making_score,
          total: existing.sentence_making_total ?? 0,
        });
      }

      if (!muDone) {
        setCurrentStage("matchup");
        toast.info("빈칸 채우기를 이미 완료했습니다. 매치업부터 시작합니다.");
      } else if (!taDone) {
        setCurrentStage("type_answer");
        toast.info("이전 단계를 완료했습니다. 답 입력부터 시작합니다.");
      } else if (!wmDone) {
        setCurrentStage("word_magnet");
        toast.info("이전 단계를 완료했습니다. 워드 마그넷부터 시작합니다.");
      } else if (!smDone) {
        setCurrentStage("sentence_making");
        toast.info("이전 단계를 완료했습니다. 문장 만들기부터 시작합니다.");
      } else {
        setCurrentStage("recording");
        toast.info("이전 단계를 완료했습니다. 말하기 연습부터 시작합니다.");
      }
    };

    checkProgress();
  }, [quiz?.id, user?.id]);

  // 선생님 알림 덮어쓰기 — SECURITY DEFINER RPC로 RLS 우회
  // stage: '문장 만들기' | '말하기 연습'
  const updateProgressNotification = async (stage: string, message: string) => {
    if (!user || isAnonymous || !quiz) return;
    await supabase.rpc("update_quiz_progress_notification" as any, {
      _quiz_id: quiz.id,
      _student_id: user.id,
      _stage: stage,
      _message: message,
      _is_redo: isRedo,
    });
  };

  // 결과 행 id 확보 — 빈칸 제출이 없는(빈칸 OFF) 퀴즈에서 첫 스테이지가 행을 생성한다.
  const ensureResultId = async (): Promise<string | null> => {
    if (isAnonymous || !user || !quiz) return null;
    if (quizResultId) return quizResultId;
    const { data, error } = await supabase.rpc("ensure_quiz_result" as any, { _quiz_id: quiz.id });
    if (error) {
      console.error("ensure_quiz_result error:", error);
      return null;
    }
    const rid = (data as any)?.result_id ?? null;
    if (rid) {
      setQuizResultId(rid);
      setIsRedo((data as any)?.is_redo ?? false);
    }
    return rid;
  };

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

      // 매치업 문제 가져오기
      if (quizData.matchup_enabled) {
        const { data: muProblems } = await (supabase as any)
          .from("matchup_problems")
          .select("problem_id, korean_text, meaning_text")
          .eq("quiz_id", id);

        if (muProblems && muProblems.length > 0) {
          setMatchupProblems(
            muProblems.map((p) => ({
              id: p.problem_id,
              korean_text: p.korean_text,
              meaning_text: p.meaning_text,
            }))
          );
        }
      }

      // 답 입력 문제(프롬프트만) 가져오기 — 정답 노출 방지를 위해 RPC 사용
      if (quizData.type_answer_enabled) {
        const { data: taData } = await (supabase as any).rpc("get_type_answer_problems_for_student", {
          _quiz_id: id,
        });
        if (Array.isArray(taData) && taData.length > 0) {
          const shuffledTA = [...taData].sort(() => Math.random() - 0.5);
          setTypeAnswerProblems(
            shuffledTA.map((p: any) => ({ id: p.problem_id, prompt: p.prompt }))
          );
        }
      }

      // 워드 마그넷 문제(타일만, 정답 어순 제외) 가져오기 — RPC가 타일 셔플
      if (quizData.word_magnet_enabled) {
        const { data: wmData } = await (supabase as any).rpc("get_word_magnet_problems_for_student", {
          _quiz_id: id,
        });
        if (Array.isArray(wmData) && wmData.length > 0) {
          const shuffledWM = [...wmData].sort(() => Math.random() - 0.5);
          setWordMagnetProblems(
            shuffledWM.map((p: any) => ({
              id: p.problem_id,
              translation: p.translation || "",
              items: Array.isArray(p.items) ? p.items : [],
            }))
          );
        }
      }

      // 녹음 문제 가져오기
      if (quizData.recording_enabled) {
        const { data: recProblems } = await supabase
          .from("recording_problems")
          .select("id, sentence, mode, sentence_audio_url, translation, problem_id")
          .eq("quiz_id", id);

        if (recProblems && recProblems.length > 0) {
          // listen 모드인데 audio URL이 없는 문제 → quiz_problems에서 fallback
          const missingAudio = recProblems.filter(p => p.mode === "listen" && !p.sentence_audio_url);
          let fallbackMap: Record<string, string> = {};
          if (missingAudio.length > 0) {
            const { data: qpData } = await supabase
              .from("quiz_problems")
              .select("problem_id, sentence_audio_url")
              .eq("quiz_id", id)
              .in("problem_id", missingAudio.map(p => p.problem_id).filter(Boolean));
            if (qpData) {
              fallbackMap = Object.fromEntries(
                qpData.filter(p => p.sentence_audio_url).map(p => [p.problem_id, p.sentence_audio_url!])
              );
            }
          }

          // 문제 순서 셔플
          const shuffledRec = [...recProblems].sort(() => Math.random() - 0.5);
          setRecordingProblems(shuffledRec.map(p => ({
            id: p.id,
            sentence: p.sentence,
            mode: p.mode as "read" | "listen",
            sentenceAudioUrl: p.sentence_audio_url || fallbackMap[p.problem_id] || null,
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
      let dbSaveSuccess = true;

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
        const normalizeAnswer = (s: string) => s.toLowerCase().trim().replace(/[.。!?！？,，\s]+$/, "");

        // Calculate score (빈칸 OFF면 빈칸 채점 건너뜀)
        const fbEnabled = quiz.fill_blank_enabled !== false;
        let correctCount = 0;
        const detailedAnswers = !fbEnabled ? [] : quiz.problems.map(problem => {
          const userAnswer = (userAnswers[problem.id] || "").trim();
          const fullProblem = fullProblems.find((p: any) => p.id === problem.id);
          const correctAnswer = fullProblem?.answer || "";
          const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
          
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
        
        // Calculate sub-scores for matchup, sentence_making and recording
        let smScore = 0, smTotal = 0;
        let recScore = 0, recTotal = 0;
        let muScore = 0, muTotal = 0;
        let taScore = 0, taTotal = 0;
        let wmScore = 0, wmTotal = 0;

        if (quiz.matchup_enabled && Object.keys(matchupResults).length > 0) {
          muTotal = matchupProblems.length;
          muScore = matchupProblems.filter((p) => matchupResults[p.id]?.isCorrect).length;
        }

        if (quiz.type_answer_enabled && typeAnswerResults.length > 0) {
          taTotal = typeAnswerResults.length;
          taScore = typeAnswerResults.filter((r) => r.isCorrect).length;
        }

        if (quiz.word_magnet_enabled && wordMagnetResults.length > 0) {
          wmTotal = wordMagnetResults.length;
          wmScore = wordMagnetResults.filter((r) => r.isCorrect).length;
        }

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
          const { data: insertedResult, error: insertError } = await (supabase as any)
            .from("quiz_results")
            .insert({
              quiz_id: quiz.id,
              student_id: user ? user.id : null,
              score: correctCount + smScore + recScore + muScore + taScore + wmScore,
              total_questions: (fbEnabled ? quiz.problems.length : 0) + smTotal + recTotal + muTotal + taTotal + wmTotal,
              answers: detailedAnswers,
              is_anonymous: !user,
              anonymous_name: user ? "" : (anonymousName || "Anonymous"),
              share_token: shareToken,
              completed_at: new Date().toISOString(),
              fill_blank_score: fbEnabled ? correctCount : null,
              fill_blank_total: fbEnabled ? quiz.problems.length : null,
              matchup_score: muTotal > 0 ? muScore : null,
              matchup_total: muTotal > 0 ? muTotal : null,
              type_answer_score: taTotal > 0 ? taScore : null,
              type_answer_total: taTotal > 0 ? taTotal : null,
              word_magnet_score: wmTotal > 0 ? wmScore : null,
              word_magnet_total: wmTotal > 0 ? wmTotal : null,
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
            dbSaveSuccess = false;
          }

          // Save matchup_answers
          if (insertedResult && quiz.matchup_enabled && Object.keys(matchupResults).length > 0) {
            const muAnswers = matchupProblems.map((p) => ({
              quiz_id: quiz.id,
              result_id: insertedResult.id,
              problem_id: p.id,
              student_id: user ? user.id : null,
              attempt_number: 1,
              selected_meaning: matchupResults[p.id]?.selectedMeaning ?? "",
              is_correct: matchupResults[p.id]?.isCorrect ?? false,
            }));
            const { error: muError } = await (supabase as any).from("matchup_answers").insert(muAnswers);
            if (muError) console.error("Failed to save matchup answers:", muError);
          }

          // Save word_magnet_answers
          if (insertedResult && quiz.word_magnet_enabled && wordMagnetResults.length > 0) {
            const wmAnswers = wordMagnetResults.map((r) => ({
              quiz_id: quiz.id,
              result_id: insertedResult.id,
              problem_id: r.problemId,
              student_id: user ? user.id : null,
              attempt_number: 1,
              student_sentence: r.userSentence,
              is_correct: r.isCorrect,
            }));
            const { error: wmError } = await (supabase as any).from("word_magnet_answers").insert(wmAnswers);
            if (wmError) console.error("Failed to save word magnet answers:", wmError);
          }

          // Save type_answer_answers
          if (insertedResult && quiz.type_answer_enabled && typeAnswerResults.length > 0) {
            const taAnswers = typeAnswerResults.map((r) => ({
              quiz_id: quiz.id,
              result_id: insertedResult.id,
              problem_id: r.problemId,
              student_id: user ? user.id : null,
              attempt_number: 1,
              student_answer: r.userAnswer,
              is_correct: r.isCorrect,
            }));
            const { error: taError } = await (supabase as any).from("type_answer_answers").insert(taAnswers);
            if (taError) console.error("Failed to save type answer answers:", taError);
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
      if (shareToken && dbSaveSuccess) {
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
      let resultId: string;
      let fbScore: number;
      let fbTotal: number;

      if (quizResultId) {
        // 중간 저장된 결과 재사용 (빈칸 또는 다른 스테이지가 이미 생성)
        resultId = quizResultId;
        fbScore = savedFillBlankScore?.score ?? 0;
        fbTotal = savedFillBlankScore?.total ?? 0;
      } else if (quiz.fill_blank_enabled === false) {
        // 빈칸 OFF + 결과 행 미생성 → 생성
        const ensured = await ensureResultId();
        if (!ensured) throw new Error("결과를 생성할 수 없습니다");
        resultId = ensured;
        fbScore = 0;
        fbTotal = 0;
      } else {
        // 서버에서 점수 계산 - 정답 조작 방지
        const studentAnswers: Record<string, string> = {};
        quiz.problems.forEach((problem) => {
          studentAnswers[problem.id] = userAnswers[problem.id] || "";
        });

        const { data, error } = await supabase.rpc("submit_quiz_answers", {
          _quiz_id: quiz.id,
          _student_answers: studentAnswers,
          _problem_order: quiz.problems.map((p) => p.id),
        });

        if (error) {
          console.error("Submit error:", error);
          throw new Error(error.message);
        }

        const result = data as { success: boolean; result_id: string; score: number; total: number };
        if (!result.success) throw new Error("Submission failed");

        resultId = result.result_id;
        fbScore = result.score;
        fbTotal = result.total;
      }

      let smScore = 0, smTotal = 0;
      let recScore = 0, recTotal = 0;

      // 문장 만들기 답안 저장 (중간 저장이 없었던 경우에만)
      if (!quizResultId && quiz.sentence_making_enabled && Object.keys(sentenceMakingResults).length > 0) {
        const smAnswers: any[] = [];
        for (const [problemId, attempts] of Object.entries(sentenceMakingResults) as [string, any[]][]) {
          for (const attempt of attempts) {
            smAnswers.push({
              quiz_id: quiz.id,
              result_id: resultId,
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
      }

      if (quiz.sentence_making_enabled && Object.keys(sentenceMakingResults).length > 0) {
        smTotal = sentenceMakingProblems.length;
        smScore = sentenceMakingProblems.filter((p: any) =>
          (sentenceMakingResults[p.id] as any[])?.some((a: any) => a.isPassed)
        ).length;
      } else if (quiz.sentence_making_enabled && savedSentenceMakingScore) {
        smScore = savedSentenceMakingScore.score;
        smTotal = savedSentenceMakingScore.total;
      }

      // 녹음 답안 저장 (중간 저장이 없었던 경우에만)
      if (!quizResultId && quiz.recording_enabled && stageResults.recording) {
        const recAnswers: any[] = [];
        for (const [problemId, attempts] of Object.entries(stageResults.recording) as [string, any[]][]) {
          for (const attempt of attempts) {
            recAnswers.push({
              quiz_id: quiz.id,
              result_id: resultId,
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
      }

      if (quiz.recording_enabled && stageResults.recording) {
        recTotal = recordingProblems.length;
        recScore = recordingProblems.filter((p: any) => {
          const problemAttempts = (stageResults.recording[p.id] || []) as any[];
          return problemAttempts.some((a: any) => a.isPassed);
        }).length;
      }

      // 빈칸 ON일 때만 빈칸/문장/녹음 점수 일괄 갱신 (빈칸 OFF면 빈칸 점수 NULL 유지)
      if (quiz.fill_blank_enabled !== false) {
        const { error: updateError } = await supabase.rpc("update_quiz_result_scores" as any, {
          _result_id: resultId,
          _fill_blank_score: fbScore,
          _fill_blank_total: fbTotal,
          _sentence_making_score: smScore,
          _sentence_making_total: smTotal,
          _recording_score: recScore,
          _recording_total: recTotal,
        });
        if (updateError) console.error("Failed to update quiz_results scores:", updateError);
      }

      // 모든 유형 점수를 합산해 집계 score/total 확정 (매치업·답입력·워드마그넷 포함)
      await supabase.rpc("finalize_quiz_result" as any, { _result_id: resultId });

      navigate(`/quiz/${quiz.id}/result/${resultId}`);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("제출에 실패했습니다");
      setIsSubmitting(false);
    }
  }, [quiz, user, userAnswers, navigate, isSubmitting, isAnonymous, shareToken, anonymousName, sentenceMakingResults, stageResults, sentenceMakingProblems, recordingProblems, quizResultId, savedFillBlankScore]);

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
    if (quiz.matchup_enabled) {
      if (Object.keys(matchupResults).length > 0) return "matchup_result";
      return "matchup";
    }
    if (quiz.type_answer_enabled) {
      if (typeAnswerResults.length > 0) return "type_answer_result";
      return "type_answer";
    }
    if (quiz.word_magnet_enabled) {
      if (wordMagnetResults.length > 0) return "word_magnet_result";
      return "word_magnet";
    }
    if (quiz.sentence_making_enabled) {
      // 문장 만들기가 이미 완료된 경우 결과 페이지로 바로 이동
      if (Object.keys(sentenceMakingResults).length > 0) return "sentence_making_result";
      return "sentence_making";
    }
    if (quiz.recording_enabled) return "recording";
    return "completed";
  };

  const getNextStage = (current: QuizStage): QuizStage => {
    if (current === "fill_blank") {
      return "fill_blank_result";
    }
    if (current === "fill_blank_result") {
      if (quiz.matchup_enabled) return "matchup";
      if (quiz.type_answer_enabled) return "type_answer";
      if (quiz.word_magnet_enabled) return "word_magnet";
      if (quiz.sentence_making_enabled) return "sentence_making";
      if (quiz.recording_enabled) return "recording";
      return "completed";
    }
    if (current === "matchup") {
      return "matchup_result";
    }
    if (current === "matchup_result") {
      if (quiz.type_answer_enabled) return "type_answer";
      if (quiz.word_magnet_enabled) return "word_magnet";
      if (quiz.sentence_making_enabled) return "sentence_making";
      if (quiz.recording_enabled) return "recording";
      return "completed";
    }
    if (current === "type_answer") {
      return "type_answer_result";
    }
    if (current === "type_answer_result") {
      if (quiz.word_magnet_enabled) return "word_magnet";
      if (quiz.sentence_making_enabled) return "sentence_making";
      if (quiz.recording_enabled) return "recording";
      return "completed";
    }
    if (current === "word_magnet") {
      return "word_magnet_result";
    }
    if (current === "word_magnet_result") {
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
    if (!quiz.matchup_enabled && !quiz.type_answer_enabled && !quiz.word_magnet_enabled && !quiz.sentence_making_enabled && !quiz.recording_enabled) {
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
      const normalizeAnswer = (s: string) => s.toLowerCase().trim().replace(/[.。!?！？,，\s]+$/, "");
      const detailedAnswers = quiz.problems.map((problem) => {
        const userAnswer = (userAnswers[problem.id] || "").trim();
        const fullProblem = fullProblems.find((p: any) => p.id === problem.id);
        const correctAnswer = fullProblem?.answer || "";
        const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);

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

      // 인증된 사용자 + 추가 스테이지: 빈칸 결과 중간 저장
      if (!isAnonymous && user && (quiz.matchup_enabled || quiz.type_answer_enabled || quiz.word_magnet_enabled || quiz.sentence_making_enabled || quiz.recording_enabled)) {
        const studentAnswers: Record<string, string> = {};
        quiz.problems.forEach((problem) => {
          studentAnswers[problem.id] = userAnswers[problem.id] || "";
        });
        const { data: submitData, error: submitError } = await supabase.rpc("submit_quiz_answers", {
          _quiz_id: quiz.id,
          _student_answers: studentAnswers,
          _problem_order: quiz.problems.map((p) => p.id),
        });
        if (!submitError && (submitData as any)?.success) {
          const res = submitData as { success: boolean; result_id: string; score: number; total: number; is_redo: boolean };
          setQuizResultId(res.result_id);
          setSavedFillBlankScore({ score: res.score, total: res.total });
          setIsRedo(res.is_redo ?? false);
        }
      }

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

  // 매치업 완료 핸들러 → 결과 페이지로
  const handleMatchupComplete = async (results: Record<string, MatchUpResult>) => {
    setMatchupResults(results);

    const muTotal = matchupProblems.length;
    const muScore = matchupProblems.filter((p) => results[p.id]?.isCorrect).length;
    setSavedMatchupScore({ score: muScore, total: muTotal });

    const rid = await ensureResultId();
    if (!isAnonymous && user && rid) {
      const muAnswers = matchupProblems.map((p) => ({
        quiz_id: quiz!.id,
        result_id: rid,
        problem_id: p.id,
        student_id: user.id,
        attempt_number: 1,
        selected_meaning: results[p.id]?.selectedMeaning ?? "",
        is_correct: results[p.id]?.isCorrect ?? false,
      }));
      const { error: muError } = await (supabase as any).from("matchup_answers").insert(muAnswers);
      if (muError) console.error("Failed to save matchup answers:", muError);

      await supabase.rpc("update_quiz_result_matchup_score" as any, {
        _result_id: rid,
        _score: muScore,
        _total: muTotal,
      });

      const fbScore = savedFillBlankScore?.score ?? 0;
      const fbTotal = savedFillBlankScore?.total ?? 0;
      await updateProgressNotification(
        "매치업",
        `${quiz!.title} — 빈칸 채우기: ${fbScore}/${fbTotal}, 매치업: ${muScore}/${muTotal}`
      );
    }

    setCurrentStage("matchup_result");
  };

  // 매치업 결과 → 다음 스테이지로
  const handleMatchupResultNext = () => {
    const next = getNextStage("matchup_result");
    if (next === "completed") {
      handleSubmit();
    } else {
      setCurrentStage(next);
    }
  };

  // 답 입력 완료 핸들러 → 서버 채점 후 결과 페이지로
  const handleTypeAnswerComplete = async (answers: Record<string, string>) => {
    // 서버 채점 (정답 노출 방지)
    let graded: TypeAnswerGradeResult[] = [];
    try {
      const { data, error } = await (supabase as any).rpc("grade_type_answers", {
        _quiz_id: quiz!.id,
        _answers: answers,
      });
      if (error) throw error;
      graded = (Array.isArray(data) ? data : []).map((r: any) => ({
        problemId: r.problemId,
        prompt: r.prompt,
        correctAnswer: r.correctAnswer,
        userAnswer: r.userAnswer,
        isCorrect: r.isCorrect,
      }));
    } catch (err) {
      console.error("Type answer grading error:", err);
      toast.error("채점에 실패했습니다.");
      return;
    }

    setTypeAnswerResults(graded);

    const taTotal = graded.length;
    const taScore = graded.filter((r) => r.isCorrect).length;
    setSavedTypeAnswerScore({ score: taScore, total: taTotal });

    const rid = await ensureResultId();
    if (!isAnonymous && user && rid) {
      const taAnswers = graded.map((r) => ({
        quiz_id: quiz!.id,
        result_id: rid,
        problem_id: r.problemId,
        student_id: user.id,
        attempt_number: 1,
        student_answer: r.userAnswer,
        is_correct: r.isCorrect,
      }));
      const { error: taError } = await (supabase as any).from("type_answer_answers").insert(taAnswers);
      if (taError) console.error("Failed to save type answer answers:", taError);

      await supabase.rpc("update_quiz_result_type_answer_score" as any, {
        _result_id: rid,
        _score: taScore,
        _total: taTotal,
      });

      const fbScore = savedFillBlankScore?.score ?? 0;
      const fbTotal = savedFillBlankScore?.total ?? 0;
      await updateProgressNotification(
        "답 입력",
        `${quiz!.title} — 빈칸 채우기: ${fbScore}/${fbTotal}, 답 입력: ${taScore}/${taTotal}`
      );
    }

    setCurrentStage("type_answer_result");
  };

  // 답 입력 결과 → 다음 스테이지로
  const handleTypeAnswerResultNext = () => {
    const next = getNextStage("type_answer_result");
    if (next === "completed") {
      handleSubmit();
    } else {
      setCurrentStage(next);
    }
  };

  // 워드 마그넷 완료 핸들러 → 서버 채점 후 결과 페이지로
  const handleWordMagnetComplete = async (answers: Record<string, string>) => {
    let graded: WordMagnetGradeResult[] = [];
    try {
      const { data, error } = await (supabase as any).rpc("grade_word_magnets", {
        _quiz_id: quiz!.id,
        _answers: answers,
      });
      if (error) throw error;
      graded = (Array.isArray(data) ? data : []).map((r: any) => ({
        problemId: r.problemId,
        translation: r.translation,
        correctSentence: r.correctSentence,
        userSentence: r.userSentence,
        isCorrect: r.isCorrect,
      }));
    } catch (err) {
      console.error("Word magnet grading error:", err);
      toast.error("채점에 실패했습니다.");
      return;
    }

    setWordMagnetResults(graded);

    const wmTotal = graded.length;
    const wmScore = graded.filter((r) => r.isCorrect).length;
    setSavedWordMagnetScore({ score: wmScore, total: wmTotal });

    const rid = await ensureResultId();
    if (!isAnonymous && user && rid) {
      const wmAnswers = graded.map((r) => ({
        quiz_id: quiz!.id,
        result_id: rid,
        problem_id: r.problemId,
        student_id: user.id,
        attempt_number: 1,
        student_sentence: r.userSentence,
        is_correct: r.isCorrect,
      }));
      const { error: wmError } = await (supabase as any).from("word_magnet_answers").insert(wmAnswers);
      if (wmError) console.error("Failed to save word magnet answers:", wmError);

      await supabase.rpc("update_quiz_result_word_magnet_score" as any, {
        _result_id: rid,
        _score: wmScore,
        _total: wmTotal,
      });

      const fbScore = savedFillBlankScore?.score ?? 0;
      const fbTotal = savedFillBlankScore?.total ?? 0;
      await updateProgressNotification(
        "워드 마그넷",
        `${quiz!.title} — 빈칸 채우기: ${fbScore}/${fbTotal}, 워드 마그넷: ${wmScore}/${wmTotal}`
      );
    }

    setCurrentStage("word_magnet_result");
  };

  // 워드 마그넷 결과 → 다음 스테이지로
  const handleWordMagnetResultNext = () => {
    const next = getNextStage("word_magnet_result");
    if (next === "completed") {
      handleSubmit();
    } else {
      setCurrentStage(next);
    }
  };

  // 문장 만들기 완료 핸들러 → 결과 페이지로
  const handleSentenceMakingComplete = async (results: Record<string, any>) => {
    setStageResults((prev) => ({ ...prev, sentence_making: results }));
    setSentenceMakingResults(results);

    const rid = await ensureResultId();
    if (!isAnonymous && user && rid) {
      const smAnswers: any[] = [];
      for (const [problemId, attempts] of Object.entries(results) as [string, any[]][]) {
        for (const attempt of attempts) {
          smAnswers.push({
            quiz_id: quiz!.id,
            result_id: rid,
            problem_id: problemId,
            student_id: user.id,
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
      if (smAnswers.length > 0) {
        const { error: smError } = await (supabase as any).from("sentence_making_answers").insert(smAnswers);
        if (smError) console.error("Failed to save sentence making answers:", smError);
      }

      // 이어서 풀기 재개 감지를 위해 sentence_making_score 즉시 저장
      const smScore = Object.values(results).reduce((acc: number, attempts: any[]) => {
        const best = attempts.reduce((b: any, a: any) => (!b || a.totalScore > b.totalScore) ? a : b, null);
        return acc + (best?.isPassed ? 1 : 0);
      }, 0);
      const smTotal = Object.keys(results).length;
      setSavedSentenceMakingScore({ score: smScore, total: smTotal });
      await supabase.rpc("update_quiz_result_sentence_score" as any, {
        _result_id: rid,
        _score: smScore,
        _total: smTotal,
      });

      const fbScore = savedFillBlankScore?.score ?? 0;
      const fbTotal = savedFillBlankScore?.total ?? 0;
      const smMsg = `${quiz!.title} — 빈칸 채우기: ${fbScore}/${fbTotal}, 문장 만들기: ${smScore}/${smTotal}`;
      await updateProgressNotification('문장 만들기', smMsg);
    }

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
  const handleRecordingComplete = async (results: Record<string, any>) => {
    setStageResults((prev) => ({ ...prev, recording: results }));

    const rid = await ensureResultId();
    if (!isAnonymous && user && rid) {
      const recAnswers: any[] = [];
      for (const [problemId, attempts] of Object.entries(results) as [string, any[]][]) {
        for (const attempt of attempts) {
          recAnswers.push({
            quiz_id: quiz!.id,
            result_id: rid,
            problem_id: problemId,
            student_id: user.id,
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
      if (recAnswers.length > 0) {
        const { error: recError } = await (supabase as any).from("recording_answers").insert(recAnswers);
        if (recError) console.error("Failed to save recording answers:", recError);
      }
      const recTotal = recordingProblems.length;
      const recScore = recordingProblems.filter((p: any) =>
        (results[p.id] as any[])?.some((a: any) => a.isPassed)
      ).length;

      await supabase.rpc("update_quiz_result_recording_score" as any, {
        _result_id: rid,
        _score: recScore,
        _total: recTotal,
      });

      const fbScoreR = savedFillBlankScore?.score ?? 0;
      const fbTotalR = savedFillBlankScore?.total ?? 0;
      const smScoreR = savedSentenceMakingScore?.score ?? 0;
      const smTotalR = savedSentenceMakingScore?.total ?? 0;
      const recParts = [`빈칸 채우기: ${fbScoreR}/${fbTotalR}`];
      if (quiz!.sentence_making_enabled && smTotalR > 0) recParts.push(`문장 만들기: ${smScoreR}/${smTotalR}`);
      recParts.push(`말하기 연습: ${recScore}/${recTotal}`);
      await updateProgressNotification('말하기 연습', `${quiz!.title} — ${recParts.join(', ')}`);
    }

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
        nextStage === "sentence_making_result"
          ? "문장 만들기 결과로"
          : nextStage === "sentence_making" || nextStage === "recording"
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

    // 매치업 스테이지 렌더링
    if (currentStage === "matchup" && quiz.matchup_enabled && matchupProblems.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <MatchUpStage
            problems={matchupProblems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleMatchupComplete}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
          />
        </div>
      );
    }

    // 매치업 결과 스테이지 렌더링
    if (currentStage === "matchup_result" && Object.keys(matchupResults).length > 0) {
      const nextStage = getNextStage("matchup_result");
      const nextLabel = nextStage === "completed" ? "결과 제출" : "다음 단계로";

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">매치업 결과</h2>
          </div>
          <MatchUpResultStage
            problems={matchupProblems}
            results={matchupResults}
            onNext={handleMatchupResultNext}
            nextLabel={nextLabel}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
          />
        </div>
      );
    }

    // 답 입력 스테이지 렌더링
    if (currentStage === "type_answer" && quiz.type_answer_enabled && typeAnswerProblems.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <TypeAnswerStage
            problems={typeAnswerProblems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleTypeAnswerComplete}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
          />
        </div>
      );
    }

    // 답 입력 결과 스테이지 렌더링
    if (currentStage === "type_answer_result" && typeAnswerResults.length > 0) {
      const nextStage = getNextStage("type_answer_result");
      const nextLabel = nextStage === "completed" ? "결과 제출" : "다음 단계로";

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">답 입력 결과</h2>
          </div>
          <TypeAnswerResultStage
            results={typeAnswerResults}
            onNext={handleTypeAnswerResultNext}
            nextLabel={nextLabel}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
          />
        </div>
      );
    }

    // 워드 마그넷 스테이지 렌더링
    if (currentStage === "word_magnet" && quiz.word_magnet_enabled && wordMagnetProblems.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <WordMagnetStage
            problems={wordMagnetProblems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleWordMagnetComplete}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
          />
        </div>
      );
    }

    // 워드 마그넷 결과 스테이지 렌더링
    if (currentStage === "word_magnet_result" && wordMagnetResults.length > 0) {
      const nextStage = getNextStage("word_magnet_result");
      const nextLabel = nextStage === "completed" ? "결과 제출" : "다음 단계로";

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">워드 마그넷 결과</h2>
          </div>
          <WordMagnetResultStage
            results={wordMagnetResults}
            onNext={handleWordMagnetResultNext}
            nextLabel={nextLabel}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
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
            translationLanguage={quiz.translation_language}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleSentenceMakingComplete}
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
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
            onBack={fillBlankAnswers.length > 0 ? () => setCurrentStage("fill_blank_result") : undefined}
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
            onBack={Object.keys(sentenceMakingResults).length > 0 ? () => setCurrentStage("sentence_making_result") : undefined}
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

    // 빈칸 OFF 퀴즈: 스테이지 데이터 로딩 중이면 스피너 (빈칸 스테이지로 폴백 방지)
    if (quiz.fill_blank_enabled === false) {
      return (
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                          : "text-muted-foreground bg-card border border-border"
                      }`}>
                        {/* 활성화된 뱃지의 숫자 배경을 눈에 잘 띄게 흰색으로 적용 */}
                        <span className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs shadow-sm font-bold ${
                          idx === currentGlobalIndex
                            ? "bg-white text-primary"
                            : idx < currentGlobalIndex
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
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
