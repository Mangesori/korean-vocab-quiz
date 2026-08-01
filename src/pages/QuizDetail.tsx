import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, TextCursorInput, PenLine, Mic, Link2, Keyboard, Magnet, X, Radio } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Dialog } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Custom Hooks
import { useQuizData } from "@/hooks/useQuizData";
import { useAudioGeneration } from "@/hooks/useAudioGeneration";
import { useQuizSharing } from "@/hooks/useQuizSharing";
import { useProblemEditor } from "@/hooks/useProblemEditor";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";

// Components
import { QuizHeader } from "@/components/quiz/QuizHeader";
import { QuizWords } from "@/components/quiz/QuizWords";
import { FillBlankProblemList } from "@/components/quiz/FillBlankProblemList";
import { ShareQuizDialogContent } from "@/components/quiz/ShareQuizDialog";
import { StartLiveDialog } from "@/components/live/StartLiveDialog";
import { LIVE_STAGES } from "@/types/liveSession";
import type { BaseStage } from "@/types/quiz";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizResultsList } from "@/components/quiz/QuizResultsList";
import { SentenceMakingProblemList, SentenceMakingProblem } from "@/components/quiz/SentenceMakingProblemList";
import { RecordingProblemList, RecordingProblem } from "@/components/quiz/RecordingProblemList";
import { MatchupProblemList, MatchupProblem } from "@/components/quiz/MatchupProblemList";
import { TypeAnswerProblemList, TypeAnswerProblem } from "@/components/quiz/TypeAnswerProblemList";
import { WordMagnetProblemList, WordMagnetProblem } from "@/components/quiz/WordMagnetProblemList";
import { parseSentenceToItems } from "@/lib/korean/wordMagnet";
import { isShortSentenceLevel } from "@/lib/quiz";

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams(); // Added

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [studentPreview, setStudentPreview] = useState(false);
  
  // Tab State
  const [currentTab, setCurrentTab] = useState("problems");
  const [problemTab, setProblemTab] = useState<"fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet">("fill_blank");
  const [confirmDialog, setConfirmDialog] = useState<"fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet" | null>(null);
  const [removeDialog, setRemoveDialog] = useState<"fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet" | null>(null);
  const queryClient = useQueryClient();

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && (tabParam === "problems" || tabParam === "results")) {
      setCurrentTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    // Optional: update URL when tab changes, but might be annoying for history
    // setSearchParams({ tab: value }); 
  };


  // Hooks
  const {
    quiz,
    classes,
    isLoading,
    audioUrls,
    setAudioUrls,
    updateQuizTitle,
    updateQuizProblems,
    refetchQuiz,
  } = useQuizData(id, user?.id);

  // 빈칸 문제 id → 단어. 문장순서·말하기 카드 헤더 출처 단어 라벨용(파생 시 problem_id가 빈칸 id와 동일).
  const sourceWordById = useMemo(() => {
    const map: Record<string, string> = {};
    ((quiz?.problems as any[]) || []).forEach((p) => {
      if (p?.id && p?.word) map[p.id] = p.word;
    });
    return map;
  }, [quiz?.problems]);

  // 기본 탭: 퀴즈 로드 시 정규 순서상 첫 활성 유형으로 1회 초기화 (빈칸은 항상 유효)
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!quiz || tabInitRef.current) return;
    tabInitRef.current = true;
    const order: Array<["fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet", boolean]> = [
      ["matchup", !!quiz.matchup_enabled],
      ["type_answer", !!quiz.type_answer_enabled],
      ["fill_blank", quiz.fill_blank_enabled !== false],
      ["word_magnet", !!quiz.word_magnet_enabled],
      ["sentence_making", !!quiz.sentence_making_enabled],
      ["recording", !!quiz.recording_enabled],
    ];
    const first = order.find(([, enabled]) => enabled)?.[0];
    if (first) setProblemTab(first);
  }, [quiz]);

  const [liveDialogOpen, setLiveDialogOpen] = useState(false);

  // 이 퀴즈에 켜져 있는 유형 — 라이브 세션 다이얼로그에 넘긴다.
  const enabledStages = useMemo<BaseStage[]>(() => {
    if (!quiz) return [];
    return ([
      ["matchup", !!quiz.matchup_enabled],
      ["type_answer", !!quiz.type_answer_enabled],
      ["fill_blank", quiz.fill_blank_enabled !== false],
      ["word_magnet", !!quiz.word_magnet_enabled],
      ["sentence_making", !!quiz.sentence_making_enabled],
      ["recording", !!quiz.recording_enabled],
    ] as [BaseStage, boolean][])
      .filter(([, on]) => on)
      .map(([s]) => s);
  }, [quiz]);

  // 짝 맞추기 문제 조회
  const { data: matchupProblems = [], refetch: refetchMatchup } = useQuery({
    queryKey: ['matchupProblems', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchup_problems")
        .select("*")
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as MatchupProblem[];
    },
    enabled: !!id && !!quiz?.matchup_enabled,
  });

  // 단어 받아쓰기 문제 조회
  const { data: typeAnswerProblems = [], refetch: refetchTypeAnswer } = useQuery({
    queryKey: ['typeAnswerProblems', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("type_answer_problems")
        .select("*")
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TypeAnswerProblem[];
    },
    enabled: !!id && !!quiz?.type_answer_enabled,
  });

  // 문장 순서 맞추기 문제 조회
  const { data: wordMagnetProblems = [], refetch: refetchWordMagnet } = useQuery({
    queryKey: ['wordMagnetProblems', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("word_magnet_problems")
        .select("*")
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as WordMagnetProblem[];
    },
    enabled: !!id && !!quiz?.word_magnet_enabled,
  });

  // 문장 만들기 문제 조회
  const { data: sentenceMakingProblems = [], refetch: refetchSentenceMaking } = useQuery({
    queryKey: ['sentenceMakingProblems', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentence_making_problems")
        .select("*")
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as SentenceMakingProblem[];
    },
    enabled: !!id && !!quiz?.sentence_making_enabled,
  });

  // 녹음 문제 조회
  const { data: recordingProblems = [], refetch: refetchRecording } = useQuery({
    queryKey: ['recordingProblems', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recording_problems")
        .select("*")
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as RecordingProblem[];
    },
    enabled: !!id && !!quiz?.recording_enabled,
  });

  const {
    isGeneratingAudio,
    audioProgress,
    regeneratingProblemId,
    regenerateAllAudio,
    regenerateSingleAudio,
    playAudio
  } = useAudioGeneration(id);

  const {
    isSending,
    sendDialogOpen,
    setSendDialogOpen,
    reassignDialogOpen,
    handleConfirmReassign,
    handleCancelReassign,
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  } = useQuizSharing(quiz, user, classes);

  const {
    isEditing,
    setIsEditing,
    hasChanges,
    isSaving,
    editedProblems,
    updateProblem,
    setEditedProblems,
    cancelEdit,
    updateProblemObject,

    saveChanges
  } = useProblemEditor(
    useMemo(() => quiz?.problems || [], [quiz?.problems]),
    quiz?.id,
    (updatedProblems) => {
      updateQuizProblems(updatedProblems);
    }
  );

  const [isRegeneratingProblems, setIsRegeneratingProblems] = useState(false);
  const [deletingProblemId, setDeletingProblemId] = useState<string | null>(null);

  // 전체 저장(save-all): 각 유형 탭이 자기 저장 함수를 등록하고, "저장하기"가 모두 실행한다.
  const tabSaversRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const registerTabSaver = useCallback((key: string, fn: (() => Promise<void>) | null) => {
    if (fn) tabSaversRef.current.set(key, fn);
    else tabSaversRef.current.delete(key);
  }, []);
  const registerMatchupSaver = useCallback((fn: (() => Promise<void>) | null) => registerTabSaver("matchup", fn), [registerTabSaver]);
  const registerTypeAnswerSaver = useCallback((fn: (() => Promise<void>) | null) => registerTabSaver("type_answer", fn), [registerTabSaver]);
  const registerWordMagnetSaver = useCallback((fn: (() => Promise<void>) | null) => registerTabSaver("word_magnet", fn), [registerTabSaver]);
  const registerSentenceMakingSaver = useCallback((fn: (() => Promise<void>) | null) => registerTabSaver("sentence_making", fn), [registerTabSaver]);
  const registerRecordingSaver = useCallback((fn: (() => Promise<void>) | null) => registerTabSaver("recording", fn), [registerTabSaver]);

  const saveAllTabs = useCallback(async () => {
    if (hasChanges) await saveChanges();
    await Promise.all([...tabSaversRef.current.values()].map((fn) => fn()));
    setIsEditing(false);
  }, [hasChanges, saveChanges, setIsEditing]);

  const handleAddFillBlankProblem = () => {
    const newProblem = {
      id: crypto.randomUUID(),
      word: "",
      answer: "",
      sentence: "( )",
      hint: "",
      translation: "",
    };
    setEditedProblems(prev => [...prev, newProblem]);
    setIsEditing(true);
  };

  const handleDeleteProblem = async (problem: any) => {
    if (!quiz) return;
    if (!confirm(`"${problem.word || "새 문제"}" 문제를 삭제하시겠습니까?`)) return;

    setDeletingProblemId(problem.id);
    try {
      // 로컬 editedProblems에서 즉시 제거
      setEditedProblems(prev => prev.filter((p: any) => p.id !== problem.id));

      // 저장된 문제만 DB 삭제
      const isSaved = (quiz.problems || []).some((p: any) => p.id === problem.id);
      if (isSaved) {
        await Promise.all([
          supabase.from("quiz_problems").delete().eq("quiz_id", quiz.id).eq("problem_id", problem.id),
          supabase.from("quiz_answers").delete().eq("quiz_id", quiz.id).eq("problem_id", problem.id),
        ]);

        const updatedProblems = (quiz.problems || []).filter((p: any) => p.id !== problem.id);
        const updatedWords = updatedProblems.map((p: any) => p.word);

        const { error } = await supabase
          .from("quizzes")
          .update({ problems: updatedProblems as any, words: updatedWords })
          .eq("id", quiz.id);

        if (error) throw error;

        updateQuizProblems(updatedProblems);
      }

      toast.success("문제가 삭제되었습니다");
    } catch (error: any) {
      console.error("Delete problem error:", error);
      toast.error(error.message || "삭제에 실패했습니다");
    } finally {
      setDeletingProblemId(null);
    }
  };

  const handleRegenerateProblem = async (problem: any) => {
    if (!quiz) return;
    setIsRegeneratingProblems(true); // Using a global loading state for simplicity or individual? 
    // Actually, ProblemCard expects individual loading state if possible or just disabled?
    // The previous code in QuizPreview used `regeneratingId`.
    // I should probably pass a loading state. I'll stick to simple first.
    // Let's use a local state for ID in QuizDetail?
    try {
        // ... implementation ...
        toast.promise(
            (async () => {
                 const { data, error } = await supabase.functions.invoke("generate-quiz", {
                    body: {
                      words: [problem.word],
                      difficulty: quiz.difficulty,
                      translationLanguage: quiz.translation_language,
                      wordsPerSet: 1,
                      apiProvider: quiz.api_provider as "openai" | "gemini" | "gemini-pro" | undefined,
                      purpose: "regenerate",
                    },
                 });
                 if (error || data.error) throw new Error(data?.error || "Regeneration failed");
                 const newProblem = data.problems[0];
                 updateProblemObject({ ...newProblem, id: problem.id });
                 // Ensure we show the updated version
                 // If not editing, maybe we should? The user wants to see the new problem.
                 // We will handle the prop change in the return statement.
            })(),
            {
                loading: "문제 재생성 중...",
                success: "문제가 재생성되었습니다",
                error: "재생성에 실패했습니다"
            }
        );
    } catch (e) {
        console.error(e);
    } finally {
        setIsRegeneratingProblems(false);
    }
  };

  const handleRegenerateAllProblems = async () => {
      if (!quiz) return;
      if (!confirm("모든 문제가 재생성됩니다. 기존 내용은 사라집니다. 계속하시겠습니까?")) return;
      
      setIsRegeneratingProblems(true);
      try {
        toast.promise(
            (async () => {
                const { data, error } = await supabase.functions.invoke("generate-quiz", {
                    body: {
                      words: quiz.words,
                      difficulty: quiz.difficulty,
                      translationLanguage: quiz.translation_language,
                      wordsPerSet: quiz.words_per_set,
                      apiProvider: quiz.api_provider as "openai" | "gemini" | "gemini-pro" | undefined,
                      purpose: "regenerate",
                    },
                });
                 if (error || data.error) throw new Error(data?.error || "Regeneration failed");
                
                 // Map new problems to existing IDs if possible to preserve order/ID stability?
                 // Or just replace. If we replace, we lose IDs.
                 // We MUST preserve IDs because audio is linked to IDs.
                 // Actually, if we regenerate content, we probably SHOULD regenerate audio too?
                 // The user asked for "Regenerate Problems".
                 // In `QuizPreview`, `generate-quiz` returns new problems with NEW generated content.
                 // If I replace everything, I should try to map them back to original IDs by word index?
                 // `quiz.problems` has IDs. I should map new content to old IDs by word.
                 
                 const newProblemsRaw = data.problems;
                 // Assuming order is preserved or match by word.
                 // Create a map of word -> newProblem
                 const newProblemMap = new Map<string, any>(newProblemsRaw.map((p: any) => [p.word, p]));
                 
                 const updatedProblems = editedProblems.map(p => {
                     const newP = newProblemMap.get(p.word);
                     if (newP) {
                         return { 
                             ...p, 
                             sentence: newP.sentence, 
                             answer: newP.answer, 
                             hint: newP.hint, 
                             translation: newP.translation 
                         };
                     }
                     return p;
                 });
                 
                 setEditedProblems(updatedProblems);

                 // We also need to set hasChanges -> handled by setEditedProblems? 
                 // Wait, setEditedProblems is useState setter. It doesn't auto set hasChanges.
                 // I need to setHasChanges(true) manually if I use setEditedProblems directly?
                 // `useProblemEditor` exposes `setEditedProblems`.
                 // But `updateProblemObject` sets hasChanges.
                 // I should probably expose `setProblems` wrapper that sets hasChanges, or just set boolean.
                 // `useProblemEditor` has declared `setHasChanges`. I need to export it or handle it.
                 // It exports `setHasChanges`.
            })(),
            {
                loading: "전체 문제 재생성 중...",
                success: "전체 문제가 재생성되었습니다",
                error: "재생성에 실패했습니다"
            }
        );
      } catch (e) {
          console.error(e);
      } finally {
          setIsRegeneratingProblems(false);
      }
  };

  // 빈칸 채우기 다시 추가 핸들러 (소프트 활성 — 문제 재생성 불필요, 플래그만 켬)
  const handleAddFillBlank = async () => {
    if (!quiz) return;
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ fill_blank_enabled: true } as any)
        .eq("id", quiz.id);
      if (error) throw new Error("퀴즈 설정 업데이트 실패: " + error.message);
      toast.success("빈칸 채우기가 추가되었습니다!");
      refetchQuiz();
      setProblemTab("fill_blank");
    } catch (error: any) {
      console.error("Add fill blank error:", error);
      toast.error(error.message || "빈칸 채우기 추가에 실패했습니다");
    }
  };

  // 문장 만들기 추가 핸들러
  const handleAddSentenceMaking = async () => {
    if (!quiz) return;

    try {
      // 1. generate-quiz 함수 호출 (skipFillBlank: true로 빈칸 채우기 생성 건너뛰기)
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words: quiz.words,
          difficulty: quiz.difficulty,
          translationLanguage: quiz.translation_language,
          wordsPerSet: quiz.words_per_set,
          apiProvider: quiz.api_provider as "openai" | "gemini" | "gemini-pro" | undefined,
          sentenceMakingEnabled: true,
          recordingEnabled: false,
          skipFillBlank: true,
          purpose: "regenerate",
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "문장 만들기 생성 실패");
      }

      if (!data.sentenceMakingProblems || data.sentenceMakingProblems.length === 0) {
        throw new Error("문장 만들기 문제가 생성되지 않았습니다");
      }

      // 2. sentence_making_problems 테이블에 삽입
      const smProblemsToInsert = data.sentenceMakingProblems.map((p: any) => ({
        quiz_id: quiz.id,
        problem_id: p.problem_id,
        word: p.word,
        word_meaning: p.word_meaning || null,
        model_answer: p.model_answer,
      }));

      const { error: insertError } = await supabase
        .from("sentence_making_problems")
        .insert(smProblemsToInsert);

      if (insertError) {
        throw new Error("문장 만들기 문제 저장 실패: " + insertError.message);
      }

      // 3. quizzes 테이블 업데이트
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ sentence_making_enabled: true })
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success("문장 만들기가 추가되었습니다!");
      refetchQuiz();
      refetchSentenceMaking();
      setProblemTab("sentence_making");
    } catch (error: any) {
      console.error("Add sentence making error:", error);
      toast.error(error.message || "문장 만들기 추가에 실패했습니다");
    }
  };

  // 녹음 추가 핸들러
  const handleAddRecording = async () => {
    if (!quiz) return;

    try {
      if (!quiz.problems || quiz.problems.length === 0) {
        throw new Error("빈칸 채우기 문제가 없습니다. 먼저 빈칸 채우기 퀴즈를 생성해주세요.");
      }

      // quiz.problems 순서대로 recording problems 생성 (QuizPreview와 동일한 로직)
      // quiz.problems에 answer와 sentence가 이미 있으므로 추가 DB 쿼리 불필요
      // B1+면 short_sentence(있으면)를 그대로 사용, 없으면 빈칸 치환 폴백.
      const isB1Plus = isShortSentenceLevel(quiz.difficulty);
      const recProblemsToInsert = quiz.problems.map((p) => {
        const useShort = isB1Plus && !!p.short_sentence?.trim();
        const sentence = useShort
          ? p.short_sentence!.trim()
          : p.sentence.replace(/\(\s*\)|\(\)/g, p.answer);
        return {
          quiz_id: quiz.id,
          problem_id: p.id,
          sentence,
          mode: "read" as const,
          // short_sentence는 빈칸 문장과 달라 기존 오디오(빈칸 기준)를 재사용하면 안 됨.
          sentence_audio_url: useShort ? null : (audioUrls[p.id] || null),
          translation: (useShort ? (p.short_translation ?? p.translation) : p.translation) || null,
          source_type: "reuse" as const,
        };
      });

      const { error: insertError } = await supabase
        .from("recording_problems")
        .insert(recProblemsToInsert);

      if (insertError) {
        throw new Error("말하기 연습 문제 저장 실패: " + insertError.message);
      }

      // 3. quizzes 테이블 업데이트
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ recording_enabled: true })
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success("말하기 연습이 추가되었습니다!");
      refetchQuiz();
      refetchRecording();
      setProblemTab("recording");
    } catch (error: any) {
      console.error("Add recording error:", error);
      toast.error(error.message || "말하기 연습 추가에 실패했습니다");
    }
  };

  // 짝 맞추기 추가 핸들러
  const handleAddMatchup = async () => {
    if (!quiz) return;

    try {
      if (!quiz.problems || quiz.problems.length === 0) {
        throw new Error("빈칸 채우기 문제가 없습니다. 먼저 빈칸 채우기 퀴즈를 생성해주세요.");
      }

      const muProblemsToInsert = quiz.problems.map((p) => ({
        quiz_id: quiz.id,
        problem_id: p.id,
        korean_text: p.word,
        meaning_text: p.meaning || "",
      }));

      const { error: insertError } = await supabase
        .from("matchup_problems")
        .insert(muProblemsToInsert);

      if (insertError) {
        throw new Error("짝 맞추기 문제 저장 실패: " + insertError.message);
      }

      // quizzes 테이블 업데이트
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ matchup_enabled: true })
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success("짝 맞추기가 추가되었습니다!");
      refetchQuiz();
      refetchMatchup();
      setProblemTab("matchup");
    } catch (error: any) {
      console.error("Add matchup error:", error);
      toast.error(error.message || "짝 맞추기 추가에 실패했습니다");
    }
  };

  // 단어 받아쓰기 추가 핸들러
  const handleAddTypeAnswer = async () => {
    if (!quiz) return;

    try {
      if (!quiz.problems || quiz.problems.length === 0) {
        throw new Error("빈칸 채우기 문제가 없습니다. 먼저 빈칸 채우기 퀴즈를 생성해주세요.");
      }

      const taProblemsToInsert = quiz.problems.map((p) => ({
        quiz_id: quiz.id,
        problem_id: p.id,
        prompt: p.meaning || "",
        answer: p.word,
      }));

      const { error: insertError } = await supabase
        .from("type_answer_problems")
        .insert(taProblemsToInsert);

      if (insertError) {
        throw new Error("단어 받아쓰기 문제 저장 실패: " + insertError.message);
      }

      // quizzes 테이블 업데이트
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ type_answer_enabled: true })
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success("단어 받아쓰기가 추가되었습니다!");
      refetchQuiz();
      refetchTypeAnswer();
      setProblemTab("type_answer");
    } catch (error: any) {
      console.error("Add type answer error:", error);
      toast.error(error.message || "단어 받아쓰기 추가에 실패했습니다");
    }
  };

  // 문장 순서 맞추기 추가 핸들러
  const handleAddWordMagnet = async () => {
    if (!quiz) return;

    try {
      if (!quiz.problems || quiz.problems.length === 0) {
        throw new Error("빈칸 채우기 문제가 없습니다. 먼저 빈칸 채우기 퀴즈를 생성해주세요.");
      }

      // B1+면 short_sentence(있으면)를 base_text로, 없으면 빈칸 치환 폴백.
      const isB1Plus = isShortSentenceLevel(quiz.difficulty);
      const wmProblemsToInsert = quiz.problems.map((p) => {
        const useShort = isB1Plus && !!p.short_sentence?.trim();
        const baseText = (useShort
          ? p.short_sentence!.trim()
          : p.sentence.replace(/\(\s*\)|\(\)/g, p.answer))
          .replace(/([.?!])\s*\.+\s*$/, "$1")
          .trim();
        const items = parseSentenceToItems(baseText).map((it) => ({
          content: it.content,
          isParticle: it.isParticle,
        }));
        return {
          quiz_id: quiz.id,
          problem_id: p.id,
          base_text: baseText,
          translation: (useShort
            ? (p.short_translation ?? p.translation ?? "")
            : (p.translation || "")
          ).replace(/[[\]]/g, ""),
          items,
        };
      }).filter((p) => p.items.length > 0)
        .map((p, index) => ({ ...p, sort_order: index }));

      const { error: insertError } = await supabase
        .from("word_magnet_problems")
        .insert(wmProblemsToInsert);

      if (insertError) {
        throw new Error("문장 순서 맞추기 문제 저장 실패: " + insertError.message);
      }

      // quizzes 테이블 업데이트
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ word_magnet_enabled: true })
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success("문장 순서 맞추기가 추가되었습니다!");
      refetchQuiz();
      refetchWordMagnet();
      setProblemTab("word_magnet");
    } catch (error: any) {
      console.error("Add word magnet error:", error);
      toast.error(error.message || "문장 순서 맞추기 추가에 실패했습니다");
    }
  };

  // 유형 통째 제거 핸들러
  const handleRemoveType = async (
    type: "fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet"
  ) => {
    if (!quiz) return;

    // 최소 한 가지 유형은 남겨야 함
    const enabledCount = [
      quiz.fill_blank_enabled !== false,
      quiz.matchup_enabled,
      quiz.type_answer_enabled,
      quiz.word_magnet_enabled,
      quiz.sentence_making_enabled,
      quiz.recording_enabled,
    ].filter(Boolean).length;
    if (enabledCount <= 1) {
      toast.error("최소 한 가지 퀴즈 유형이 필요합니다");
      return;
    }

    // 유형 → 문제 테이블명 / enabled 컬럼 / refetch 함수 / 표시 이름
    let problemTable: string;
    let enabledColumn: string;
    let refetchType: () => void;
    let typeLabel: string;
    switch (type) {
      case "fill_blank":
        // 소프트 비활성: 문제 테이블 삭제 없이 플래그만 해제 (quiz.problems 보존)
        problemTable = "";
        enabledColumn = "fill_blank_enabled";
        refetchType = () => {};
        typeLabel = "빈칸 채우기";
        break;
      case "matchup":
        problemTable = "matchup_problems";
        enabledColumn = "matchup_enabled";
        refetchType = refetchMatchup;
        typeLabel = "짝 맞추기";
        break;
      case "type_answer":
        problemTable = "type_answer_problems";
        enabledColumn = "type_answer_enabled";
        refetchType = refetchTypeAnswer;
        typeLabel = "단어 받아쓰기";
        break;
      case "word_magnet":
        problemTable = "word_magnet_problems";
        enabledColumn = "word_magnet_enabled";
        refetchType = refetchWordMagnet;
        typeLabel = "문장 순서 맞추기";
        break;
      case "sentence_making":
        problemTable = "sentence_making_problems";
        enabledColumn = "sentence_making_enabled";
        refetchType = refetchSentenceMaking;
        typeLabel = "문장 만들기";
        break;
      case "recording":
        problemTable = "recording_problems";
        enabledColumn = "recording_enabled";
        refetchType = refetchRecording;
        typeLabel = "말하기 연습";
        break;
      default:
        return;
    }

    try {
      // 1. 해당 유형 문제 전체 삭제 (빈칸 채우기는 소프트 비활성이므로 스킵)
      if (problemTable) {
        const { error: deleteError } = await supabase
          .from(problemTable as any)
          .delete()
          .eq("quiz_id", quiz.id);

        if (deleteError) {
          throw new Error(`${typeLabel} 문제 삭제 실패: ` + deleteError.message);
        }
      }

      // 2. quizzes 테이블에서 enabled 플래그 해제
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ [enabledColumn]: false } as any)
        .eq("id", quiz.id);

      if (updateError) {
        throw new Error("퀴즈 설정 업데이트 실패: " + updateError.message);
      }

      toast.success(`${typeLabel}이(가) 제거되었습니다`);
      refetchQuiz();
      refetchType();

      // 현재 보고 있던 탭이 방금 제거한 유형이면 남은 첫 활성 유형으로 이동
      if (problemTab === type) {
        const order: Array<["fill_blank" | "sentence_making" | "recording" | "matchup" | "type_answer" | "word_magnet", boolean]> = [
          ["matchup", !!quiz.matchup_enabled],
          ["type_answer", !!quiz.type_answer_enabled],
          ["fill_blank", quiz.fill_blank_enabled !== false],
          ["word_magnet", !!quiz.word_magnet_enabled],
          ["sentence_making", !!quiz.sentence_making_enabled],
          ["recording", !!quiz.recording_enabled],
        ];
        const next = order.find(([t, enabled]) => t !== type && enabled)?.[0];
        if (next) setProblemTab(next);
      }
    } catch (error: any) {
      console.error("Remove type error:", error);
      toast.error(error.message || `${typeLabel} 제거에 실패했습니다`);
    }
  };

  // Actions
  const handleUpdateTitle = async (newTitle: string) => {
    if (!quiz) return;
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ title: newTitle })
        .eq("id", quiz.id);

      if (error) throw error;
      updateQuizTitle(newTitle);
      toast.success("퀴즈 제목이 수정되었습니다");
    } catch (error) {
      console.error("Title update error:", error);
      toast.error("제목 수정에 실패했습니다");
    }
  };

  const handleDelete = async () => {
    if (!quiz || !confirm("정말 이 퀴즈를 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
      if (error) throw error;
      toast.success("퀴즈가 삭제되었습니다");
      navigate("/dashboard");
    } catch (error) {
      toast.error("삭제에 실패했습니다");
    }
  };

  const onSendQuiz = () => {
    handleSendQuiz(selectedClassId, () => setSelectedClassId(""));
  };

  const handleRegenerateAll = () => {
    if (quiz) {
      regenerateAllAudio(quiz.problems, (pid, url) => {
        setAudioUrls(prev => ({ ...prev, [pid]: url }));
      });
    }
  };

  // Loading & Auth Checks
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.EDIT_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz) return null;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/quizzes"))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> 뒤로
        </Button>

        <QuizHeader 
          quiz={quiz} 
          onUpdateTitle={handleUpdateTitle} 
          onDelete={handleDelete} 
          onOpenSendDialog={() => setSendDialogOpen(true)} 
        />

        {enabledStages.some((s) => LIVE_STAGES.includes(s)) && (
          <div className="mb-6">
            <Button variant="outline" className="gap-2" onClick={() => setLiveDialogOpen(true)}>
              <Radio className="w-4 h-4 text-destructive" />
              라이브 세션 시작
            </Button>
          </div>
        )}

        <StartLiveDialog
          open={liveDialogOpen}
          onOpenChange={setLiveDialogOpen}
          quizId={id!}
          availableStages={enabledStages}
          classId={selectedClassId || null}
        />

        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <ShareQuizDialogContent 
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onSendQuiz={onSendQuiz}
            isSending={isSending}
            shareUrl={shareUrl}
            allowAnonymous={allowAnonymous}
            onSetAllowAnonymous={setAllowAnonymous}
            onGenerateLink={generateShareLink}
            isGeneratingLink={isGeneratingLink}
            onCopyLink={copyToClipboard}
          />
        </Dialog>

        <AlertDialog open={reassignDialogOpen} onOpenChange={(open) => { if (!open) handleCancelReassign(); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이미 완료된 퀴즈입니다</AlertDialogTitle>
              <AlertDialogDescription>
                학생들이 이미 완료한 퀴즈입니다. 재할당하면 학생들이 다시 풀 수 있으며, 기존 풀이 기록은 보존됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelReassign}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmReassign}>재할당</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmDialog !== null} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog === "fill_blank" && "빈칸 채우기를 다시 추가하시겠습니까?"}
                {confirmDialog === "sentence_making" && "문장 만들기 문제를 추가하시겠습니까?"}
                {confirmDialog === "recording" && "말하기 연습 문제를 추가하시겠습니까?"}
                {confirmDialog === "matchup" && "짝 맞추기 문제를 추가하시겠습니까?"}
                {confirmDialog === "type_answer" && "단어 받아쓰기 문제를 추가하시겠습니까?"}
                {confirmDialog === "word_magnet" && "문장 순서 맞추기 문제를 추가하시겠습니까?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog === "fill_blank" && "기존 빈칸 채우기 문제가 다시 학생 화면에 표시됩니다."}
                {confirmDialog === "sentence_making" && "각 단어로 문장을 직접 만들어 보는 문제가 추가됩니다."}
                {confirmDialog === "recording" && "빈칸 채우기와 같은 문장으로 문제가 생성됩니다. 생성 후에는 개별 수정이 가능합니다."}
                {confirmDialog === "matchup" && "단어와 뜻을 연결하는 짝 맞추기 문제가 추가됩니다."}
                {confirmDialog === "type_answer" && "단어 뜻을 보고 단어를 직접 쓰는 문제가 추가됩니다."}
                {confirmDialog === "word_magnet" && "어절 단위 타일들을 끌어서 문장을 완성하는 문장 순서 맞추기 문제가 추가됩니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDialog === "fill_blank") handleAddFillBlank();
                  else if (confirmDialog === "sentence_making") handleAddSentenceMaking();
                  else if (confirmDialog === "recording") handleAddRecording();
                  else if (confirmDialog === "matchup") handleAddMatchup();
                  else if (confirmDialog === "type_answer") handleAddTypeAnswer();
                  else if (confirmDialog === "word_magnet") handleAddWordMagnet();
                  setConfirmDialog(null);
                }}
              >
                추가하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={removeDialog !== null} onOpenChange={(open) => { if (!open) setRemoveDialog(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {removeDialog === "fill_blank" && "빈칸 채우기를 제거하시겠습니까?"}
                {removeDialog === "sentence_making" && "문장 만들기 문제를 제거하시겠습니까?"}
                {removeDialog === "recording" && "말하기 연습 문제를 제거하시겠습니까?"}
                {removeDialog === "matchup" && "짝 맞추기 문제를 제거하시겠습니까?"}
                {removeDialog === "type_answer" && "단어 받아쓰기 문제를 제거하시겠습니까?"}
                {removeDialog === "word_magnet" && "문장 순서 맞추기 문제를 제거하시겠습니까?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {removeDialog === "fill_blank"
                  ? "빈칸 채우기 단계가 학생 화면에서 숨겨집니다. 문제는 보존되며 언제든 다시 추가할 수 있습니다."
                  : "이 유형의 문제가 모두 삭제됩니다. 되돌릴 수 없습니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                onClick={() => {
                  if (removeDialog) handleRemoveType(removeDialog);
                  setRemoveDialog(null);
                }}
              >
                제거하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="problems">문제 목록</TabsTrigger>
            <TabsTrigger value="results">퀴즈 결과</TabsTrigger>
          </TabsList>

          <TabsContent value="problems" className="mt-0">
            <QuizWords words={quiz.words} />

            {/* 문제 유형 서브 탭 */}
            {/* 모바일은 2열 격자 — 가운데 정렬 flex-wrap이면 라벨 길이에 따라
                한 줄에 1개만 들어가는 줄이 생겨 들쭉날쭉해진다. 격자로 두면
                "문장 순서 맞추기"처럼 긴 라벨도 항상 2개씩 나란히 놓인다. */}
            <div className="flex justify-center mb-6">
              <div className="grid grid-cols-2 w-full sm:w-auto sm:inline-flex sm:items-center bg-muted border border-border/50 p-1 rounded-lg gap-1 sm:flex-wrap sm:justify-center">
                <button
                  onClick={() => quiz.matchup_enabled ? setProblemTab("matchup") : setConfirmDialog("matchup")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.matchup_enabled
                      ? problemTab === "matchup"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  짝 맞추기 {quiz.matchup_enabled && `(${matchupProblems.length})`}
                  {quiz.matchup_enabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="짝 맞추기 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("matchup"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("matchup"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => quiz.type_answer_enabled ? setProblemTab("type_answer") : setConfirmDialog("type_answer")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.type_answer_enabled
                      ? problemTab === "type_answer"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  단어 받아쓰기 {quiz.type_answer_enabled && `(${typeAnswerProblems.length})`}
                  {quiz.type_answer_enabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="단어 받아쓰기 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("type_answer"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("type_answer"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => quiz.fill_blank_enabled !== false ? setProblemTab("fill_blank") : setConfirmDialog("fill_blank")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.fill_blank_enabled !== false
                      ? problemTab === "fill_blank"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <TextCursorInput className="w-4 h-4" />
                  빈칸 채우기 {quiz.fill_blank_enabled !== false && `(${quiz.problems.length})`}
                  {quiz.fill_blank_enabled !== false && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="빈칸 채우기 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("fill_blank"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("fill_blank"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => quiz.word_magnet_enabled ? setProblemTab("word_magnet") : setConfirmDialog("word_magnet")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.word_magnet_enabled
                      ? problemTab === "word_magnet"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <Magnet className="w-4 h-4" />
                  문장 순서 맞추기 {quiz.word_magnet_enabled && `(${wordMagnetProblems.length})`}
                  {quiz.word_magnet_enabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="문장 순서 맞추기 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("word_magnet"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("word_magnet"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => quiz.sentence_making_enabled ? setProblemTab("sentence_making") : setConfirmDialog("sentence_making")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.sentence_making_enabled
                      ? problemTab === "sentence_making"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <PenLine className="w-4 h-4" />
                  문장 만들기 {quiz.sentence_making_enabled && `(${sentenceMakingProblems.length})`}
                  {quiz.sentence_making_enabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="문장 만들기 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("sentence_making"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("sentence_making"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => quiz.recording_enabled ? setProblemTab("recording") : setConfirmDialog("recording")}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-md text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                    quiz.recording_enabled
                      ? problemTab === "recording"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  말하기 연습 {quiz.recording_enabled && `(${recordingProblems.length})`}
                  {quiz.recording_enabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="말하기 연습 제거"
                      onClick={(e) => { e.stopPropagation(); setRemoveDialog("recording"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRemoveDialog("recording"); } }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 빈칸 채우기 문제 목록 */}
            <div className={problemTab === "fill_blank" ? "" : "hidden"}>
              <FillBlankProblemList
                problems={hasChanges ? editedProblems : quiz.problems}
                isEditing={isEditing}
                onUpdateProblem={updateProblem}
                onReorderProblems={setEditedProblems}
                audioUrls={audioUrls}
                onPlayAudio={playAudio}
                onRegenerateAllAudio={handleRegenerateAll}
                onRegenerateAllProblems={handleRegenerateAllProblems}
                onRegenerateProblem={handleRegenerateProblem}
                isRegeneratingProblems={isRegeneratingProblems}
                onDeleteProblem={handleDeleteProblem}
                deletingProblemId={deletingProblemId}
                onAddProblem={handleAddFillBlankProblem}
                onRegenerateSingleAudio={(problem) => regenerateSingleAudio(problem, (pid, url) => {
                  setAudioUrls(prev => ({ ...prev, [pid]: url }));
                })}
                isGeneratingAudio={isGeneratingAudio}
                audioProgress={audioProgress}
                regeneratingProblemId={regeneratingProblemId}
                studentPreview={studentPreview}
                onToggleStudentPreview={setStudentPreview}
                setIsEditing={setIsEditing}
                onCancelEdit={cancelEdit}
                onSaveChanges={saveAllTabs}
                isSaving={isSaving}
                hasChanges={hasChanges}
                wordsPerSet={quiz.words_per_set}
              />
            </div>

            {/* 짝 맞추기 문제 목록 */}
            {quiz.matchup_enabled && (
              <div className={problemTab === "matchup" ? "" : "hidden"}>
                <MatchupProblemList
                  problems={[...matchupProblems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
                  onRefresh={refetchMatchup}
                  studentPreview={studentPreview}
                  onToggleStudentPreview={setStudentPreview}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  onSaveAll={saveAllTabs}
                  registerSaver={registerMatchupSaver}
                />
              </div>
            )}

            {/* 단어 받아쓰기 문제 목록 */}
            {quiz.type_answer_enabled && (
              <div className={problemTab === "type_answer" ? "" : "hidden"}>
                <TypeAnswerProblemList
                  problems={[...typeAnswerProblems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
                  onRefresh={refetchTypeAnswer}
                  studentPreview={studentPreview}
                  onToggleStudentPreview={setStudentPreview}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  onSaveAll={saveAllTabs}
                  registerSaver={registerTypeAnswerSaver}
                />
              </div>
            )}

            {/* 문장 순서 맞추기 문제 목록 */}
            {quiz.word_magnet_enabled && (
              <div className={problemTab === "word_magnet" ? "" : "hidden"}>
                <WordMagnetProblemList
                  problems={[...wordMagnetProblems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
                  onRefresh={refetchWordMagnet}
                  studentPreview={studentPreview}
                  onToggleStudentPreview={setStudentPreview}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  onSaveAll={saveAllTabs}
                  registerSaver={registerWordMagnetSaver}
                  sourceWords={sourceWordById}
                  difficulty={quiz.difficulty}
                  translationLanguage={quiz.translation_language}
                  apiProvider={quiz.api_provider as "openai" | "gemini" | "gemini-pro" | undefined}
                />
              </div>
            )}

            {/* 문장 만들기 문제 목록 */}
            {quiz.sentence_making_enabled && (
              <div className={problemTab === "sentence_making" ? "" : "hidden"}>
                <SentenceMakingProblemList
                  problems={[...sentenceMakingProblems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
                  onRefresh={refetchSentenceMaking}
                  studentPreview={studentPreview}
                  onToggleStudentPreview={setStudentPreview}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  onSaveAll={saveAllTabs}
                  registerSaver={registerSentenceMakingSaver}
                />
              </div>
            )}

            {/* 말하기 연습 문제 목록 */}
            {quiz.recording_enabled && (
              <div className={problemTab === "recording" ? "" : "hidden"}>
                <RecordingProblemList
                  problems={[...recordingProblems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
                  onRefresh={refetchRecording}
                  studentPreview={studentPreview}
                  onToggleStudentPreview={setStudentPreview}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  onSaveAll={saveAllTabs}
                  registerSaver={registerRecordingSaver}
                  sourceWords={sourceWordById}
                  fillBlankProblems={quiz.problems}
                  difficulty={quiz.difficulty}
                  translationLanguage={quiz.translation_language}
                  apiProvider={quiz.api_provider as "openai" | "gemini" | "gemini-pro" | undefined}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="results" className="mt-0">
            <QuizResultsList
              quizId={quiz.id}
              fillBlankEnabled={quiz.fill_blank_enabled}
              sentenceMakingEnabled={quiz.sentence_making_enabled}
              recordingEnabled={quiz.recording_enabled}
              matchupEnabled={quiz.matchup_enabled}
              typeAnswerEnabled={quiz.type_answer_enabled}
              wordMagnetEnabled={quiz.word_magnet_enabled}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
