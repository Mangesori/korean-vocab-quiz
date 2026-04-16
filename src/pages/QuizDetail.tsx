import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, TextCursorInput, PenLine, Mic } from "lucide-react";
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
import { ProblemList } from "@/components/quiz/ProblemList";
import { ShareQuizDialogContent } from "@/components/quiz/ShareQuizDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizResultsList } from "@/components/quiz/QuizResultsList";
import { SentenceMakingProblemList, SentenceMakingProblem } from "@/components/quiz/SentenceMakingProblemList";
import { RecordingProblemList, RecordingProblem } from "@/components/quiz/RecordingProblemList";

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams(); // Added

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [studentPreview, setStudentPreview] = useState(false);
  
  // Tab State
  const [currentTab, setCurrentTab] = useState("problems");
  const [problemTab, setProblemTab] = useState<"fill_blank" | "sentence_making" | "recording">("fill_blank");
  const [confirmDialog, setConfirmDialog] = useState<"sentence_making" | "recording" | null>(null);
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
      const recProblemsToInsert = quiz.problems.map((p) => {
        const sentenceWithoutBlanks = p.sentence.replace(/\(\s*\)|\(\)/g, p.answer);
        return {
          quiz_id: quiz.id,
          problem_id: p.id,
          sentence: sentenceWithoutBlanks,
          mode: "read" as const,
          sentence_audio_url: audioUrls[p.id] || null,
          translation: p.translation || null,
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
        // Optimistic / Manual update if needed, though useQuizData subscription should handle it
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
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> 대시보드
        </Button>

        <QuizHeader 
          quiz={quiz} 
          onUpdateTitle={handleUpdateTitle} 
          onDelete={handleDelete} 
          onOpenSendDialog={() => setSendDialogOpen(true)} 
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
                {confirmDialog === "sentence_making" ? "문장 만들기 문제를 추가하시겠습니까?" : "말하기 연습 문제를 추가하시겠습니까?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog === "sentence_making"
                  ? "각 단어로 문장을 직접 만들어 보는 문제가 추가됩니다."
                  : "빈칸 채우기와 같은 문장으로 문제가 생성됩니다. 생성 후에는 개별 수정이 가능합니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDialog === "sentence_making") handleAddSentenceMaking();
                  else handleAddRecording();
                  setConfirmDialog(null);
                }}
              >
                추가하기
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
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center bg-muted p-1 rounded-lg gap-1">
                <button
                  onClick={() => setProblemTab("fill_blank")}
                  className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                    problemTab === "fill_blank"
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TextCursorInput className="w-4 h-4" />
                  빈칸 채우기 ({quiz.problems.length})
                </button>
                <button
                  onClick={() => quiz.sentence_making_enabled ? setProblemTab("sentence_making") : setConfirmDialog("sentence_making")}
                  className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                    quiz.sentence_making_enabled
                      ? problemTab === "sentence_making"
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <PenLine className="w-4 h-4" />
                  문장 만들기 {quiz.sentence_making_enabled && `(${sentenceMakingProblems.length})`}
                </button>
                <button
                  onClick={() => quiz.recording_enabled ? setProblemTab("recording") : setConfirmDialog("recording")}
                  className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                    quiz.recording_enabled
                      ? problemTab === "recording"
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 border border-dashed border-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  말하기 연습 {quiz.recording_enabled && `(${recordingProblems.length})`}
                </button>
              </div>
            </div>

            {/* 빈칸 채우기 문제 목록 */}
            {problemTab === "fill_blank" && (
              <ProblemList
                problems={hasChanges ? editedProblems : quiz.problems}
                isEditing={isEditing}
                onUpdateProblem={updateProblem}
                audioUrls={audioUrls}
                onPlayAudio={playAudio}
                onRegenerateAllAudio={handleRegenerateAll}
                onRegenerateAllProblems={handleRegenerateAllProblems}
                onRegenerateProblem={handleRegenerateProblem}
                isRegeneratingProblems={isRegeneratingProblems}
                onDeleteProblem={handleDeleteProblem}
                deletingProblemId={deletingProblemId}
                onAddProblem={handleAddFillBlankProblem}
                onRegenerateSingleAudio={(problem) => regenerateSingleAudio(problem, () => {})}
                isGeneratingAudio={isGeneratingAudio}
                audioProgress={audioProgress}
                regeneratingProblemId={regeneratingProblemId}
                studentPreview={studentPreview}
                onToggleStudentPreview={setStudentPreview}
                setIsEditing={setIsEditing}
                onCancelEdit={cancelEdit}
                onSaveChanges={saveChanges}
                isSaving={isSaving}
                hasChanges={hasChanges}
                wordsPerSet={quiz.words_per_set}
              />
            )}

            {/* 문장 만들기 문제 목록 */}
            {problemTab === "sentence_making" && quiz.sentence_making_enabled && (
              <SentenceMakingProblemList
                problems={sentenceMakingProblems}
                onRefresh={refetchSentenceMaking}
              />
            )}

            {/* 말하기 연습 문제 목록 */}
            {problemTab === "recording" && quiz.recording_enabled && (
              <RecordingProblemList
                problems={[...recordingProblems].sort((a, b) => {
                  const order = quiz.problems.map((p: any) => p.id);
                  return order.indexOf(a.problem_id) - order.indexOf(b.problem_id);
                })}
                onRefresh={refetchRecording}
              />
            )}
          </TabsContent>
          
          <TabsContent value="results" className="mt-0">
            <QuizResultsList quizId={quiz.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
