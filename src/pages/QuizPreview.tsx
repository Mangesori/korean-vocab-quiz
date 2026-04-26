import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Loader2, ArrowLeft, Eye, EyeOff, ArrowRight, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { FillBlankPreview } from "@/components/quiz/FillBlankPreview";
import { SentenceMakingPreview } from "@/components/quiz/SentenceMakingPreview";
import { RecordingPreview } from "@/components/quiz/RecordingPreview";
import type { Problem, SentenceMakingProblem, RecordingProblem, QuizDraft } from "@/types/quiz";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "영어",
  zh_CN: "중국어 간체",
  zh_TW: "중국어 번체",
  ja: "일본어",
  vi: "베트남어",
  th: "태국어",
  id: "인도네시아어",
  es: "스페인어",
  fr: "프랑스어",
  de: "독일어",
  ru: "러시아어",
};

export default function QuizPreview() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  type PreviewStage = "fill_blank" | "sentence_making" | "recording";
  const [previewStage, setPreviewStage] = useState<PreviewStage>("fill_blank");

  const enabledStages = useMemo(() => {
    const stages: PreviewStage[] = ["fill_blank"];
    if (draft?.sentenceMakingEnabled) stages.push("sentence_making");
    if (draft?.recordingEnabled) stages.push("recording");
    return stages;
  }, [draft?.sentenceMakingEnabled, draft?.recordingEnabled]);

  const currentStageIndex = enabledStages.indexOf(previewStage);
  const isLastStage = currentStageIndex === enabledStages.length - 1;
  const nextStage = enabledStages[currentStageIndex + 1];
  const prevStage = enabledStages[currentStageIndex - 1];

  const generateRecordingProblems = useCallback(() => {
    if (!draft?.recordingEnabled || !draft.problems) return;

    const recordingProblems: RecordingProblem[] = draft.problems.map((problem) => ({
      problem_id: problem.id,
      sentence: problem.sentence.replace(/\(\s*\)|\(\)/g, problem.answer),
      mode: "read" as const,
      translation: problem.translation,
    }));

    setDraft((prev) => {
      if (!prev) return null;
      return { ...prev, recordingProblems };
    });
  }, [draft?.recordingEnabled, draft?.problems]);

  const handleNextStage = () => {
    if (previewStage === "fill_blank" && draft?.recordingEnabled) {
      generateRecordingProblems();
    }
    setPreviewStage(nextStage);
  };

  useEffect(() => {
    if (draft) {
      sessionStorage.setItem("quizDraft", JSON.stringify(draft));
    }
  }, [draft]);

  useEffect(() => {
    const stored = sessionStorage.getItem("quizDraft");
    if (stored) {
      setDraft(JSON.parse(stored));
    } else {
      navigate("/quiz/create");
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.CREATE_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!draft) {
    return null;
  }

  const updateProblem = (problemId: string, field: keyof Problem, value: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      const updated = prev.problems.map((p) => (p.id === problemId ? { ...p, [field]: value } : p));
      const updatedWords = field === "word" ? updated.map((p) => p.word) : prev.words;
      return { ...prev, problems: updated, words: updatedWords };
    });
  };

  const addFillBlankProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: Problem = {
        id: `fill-${Date.now()}`,
        word: "",
        answer: "",
        sentence: "( )",
        hint: "",
        translation: "",
      };
      return { ...prev, problems: [...prev.problems, newProblem], words: [...prev.words, ""] };
    });
  };

  const updateSentenceMakingProblem = (problemId: string, field: keyof SentenceMakingProblem, value: string) => {
    setDraft((prev) => {
      if (!prev || !prev.sentenceMakingProblems) return prev;
      const updated = prev.sentenceMakingProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, sentenceMakingProblems: updated };
    });
  };

  const deleteSentenceMakingProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.sentenceMakingProblems) return prev;
      return {
        ...prev,
        sentenceMakingProblems: prev.sentenceMakingProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const addSentenceMakingProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: SentenceMakingProblem = {
        problem_id: `sm-${Date.now()}`,
        word: "",
        word_meaning: "",
        model_answer: "",
      };
      return { ...prev, sentenceMakingProblems: [...(prev.sentenceMakingProblems || []), newProblem] };
    });
  };

  const updateRecordingProblem = (problemId: string, field: keyof RecordingProblem, value: string) => {
    setDraft((prev) => {
      if (!prev || !prev.recordingProblems) return prev;
      const updated = prev.recordingProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, recordingProblems: updated };
    });
  };

  const deleteRecordingProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.recordingProblems) return prev;
      return {
        ...prev,
        recordingProblems: prev.recordingProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const regenerateRecordingProblem = (problemId: string, index: number) => {
    if (!draft?.problems || index >= draft.problems.length) return;
    const sourceProblem = draft.problems[index];
    const sentenceWithoutBlanks = sourceProblem.sentence.replace(/\(\s*\)|\(\)/g, sourceProblem.answer);

    setDraft((prev) => {
      if (!prev || !prev.recordingProblems) return prev;
      const updated = prev.recordingProblems.map((p) =>
        p.problem_id === problemId
          ? { ...p, sentence: sentenceWithoutBlanks, translation: sourceProblem.translation }
          : p
      );
      return { ...prev, recordingProblems: updated };
    });
    toast.success("빈칸 채우기 문장으로 재생성되었습니다");
  };

  const addRecordingProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: RecordingProblem = {
        problem_id: `rec-${Date.now()}`,
        sentence: "",
        mode: "read",
        translation: "",
      };
      return { ...prev, recordingProblems: [...(prev.recordingProblems || []), newProblem] };
    });
  };

  const regenerateProblem = async (problem: Problem) => {
    setRegeneratingId(problem.id);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words: [problem.word],
          difficulty: draft.difficulty,
          translationLanguage: draft.translationLanguage,
          wordsPerSet: 1,
          regenerateSingle: true,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || error?.toString() || "Regeneration failed");
      }

      const newProblem = data.problems[0];
      setDraft((prev) => {
        if (!prev) return null;
        const updated = prev.problems.map((p) => (p.id === problem.id ? { ...newProblem, id: problem.id } : p));
        return { ...prev, problems: updated };
      });
      toast.success("문제가 재생성되었습니다");
    } catch (error) {
      console.error("Regenerate error:", error);
      toast.error("재생성에 실패했습니다");
    } finally {
      setRegeneratingId(null);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateAndUploadAudio = async (
    text: string,
    quizId: string,
    problemId: string,
    type: "sentence" | "hint"
  ): Promise<string | null> => {
    try {
      const problem = draft.problems.find((p) => p.id === problemId);
      let cleanText = text;
      if (type === "sentence" && problem) {
        cleanText = text.replace(/\(\s*\)|\(\)/g, problem.answer);
      }
      cleanText = cleanText.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!response.ok) {
        console.error(`TTS generation failed for ${type}: ${response.status}`);
        return null;
      }

      const audioBlob = await response.blob();
      const fileName = `${quizId}/${problemId}_${type}.mp3`;

      const { error: uploadError } = await supabase.storage.from("quiz-audio").upload(fileName, audioBlob, {
        contentType: "audio/mpeg",
        upsert: true,
      });

      if (uploadError) {
        console.error(`Audio upload failed for ${type}:`, uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from("quiz-audio").getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      console.error(`TTS error for ${type}:`, error);
      return null;
    }
  };

  const saveQuiz = async () => {
    setIsSaving(true);

    try {
      const shuffledProblems = shuffleArray(draft.problems);

      const quizData = {
        title: draft.title,
        words: draft.words,
        difficulty: draft.difficulty as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        translation_language: draft.translationLanguage as
          | "en"
          | "zh_CN"
          | "zh_TW"
          | "ja"
          | "vi"
          | "th"
          | "id"
          | "es"
          | "fr"
          | "de"
          | "ru",
        words_per_set: draft.wordsPerSet,
        timer_seconds: draft.timerSeconds,
        problems: JSON.parse(JSON.stringify(shuffledProblems)),
        teacher_id: user.id,
        sentence_making_enabled: draft.sentenceMakingEnabled || false,
        recording_enabled: draft.recordingEnabled || false,
      };

      const { data, error } = await supabase.from("quizzes").insert(quizData).select().single();

      if (error) throw error;

      const answersToInsert = shuffledProblems.map((problem) => ({
        quiz_id: data.id,
        problem_id: problem.id,
        correct_answer: problem.answer,
        word: problem.word,
      }));

      const { error: answersError } = await supabase.from("quiz_answers").insert(answersToInsert);

      if (answersError) {
        console.error("Failed to save quiz answers:", answersError);
        await supabase.from("quizzes").delete().eq("id", data.id);
        throw new Error("Failed to save quiz answers");
      }

      if (draft.sentenceMakingEnabled && draft.sentenceMakingProblems && draft.sentenceMakingProblems.length > 0) {
        const smProblemsToInsert = draft.sentenceMakingProblems.map((p) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          word: p.word,
          word_meaning: p.word_meaning || null,
          model_answer: p.model_answer,
        }));

        const { error: smError } = await supabase.from("sentence_making_problems").insert(smProblemsToInsert);
        if (smError) {
          console.error("Failed to save sentence making problems:", smError);
        }
      }

      if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
        const recProblemsToInsert = draft.recordingProblems.map((p) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          sentence: p.sentence,
          mode: p.mode,
          translation: p.translation || null,
          source_type: "reuse" as const,
        }));

        const { error: recError } = await supabase.from("recording_problems").insert(recProblemsToInsert);
        if (recError) {
          console.error("Failed to save recording problems:", recError);
        }
      }

      toast.success("퀴즈가 저장되었습니다! 음성을 생성 중입니다...");

      (async () => {
        try {
          const problemsWithAudio = [];

          for (const problem of shuffledProblems) {
            const sentenceAudioUrl = await generateAndUploadAudio(problem.sentence, data.id, problem.id, "sentence");

            problemsWithAudio.push({
              quiz_id: data.id,
              problem_id: problem.id,
              word: problem.word,
              sentence: problem.sentence,
              hint: problem.hint,
              translation: problem.translation,
              sentence_audio_url: sentenceAudioUrl,
              hint_audio_url: null,
            });
          }

          const { error: problemsError } = await supabase.from("quiz_problems").insert(problemsWithAudio);

          if (problemsError) {
            console.error("Failed to save quiz problems with audio:", problemsError);
          } else {
            console.log("Audio generation completed for fill-blank problems:", data.id);
          }

          if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
            const fillBlankAudioMap = new Map(
              problemsWithAudio
                .filter((p) => p.sentence_audio_url)
                .map((p) => [p.problem_id, p.sentence_audio_url])
            );

            for (const recProblem of draft.recordingProblems) {
              const audioUrl = fillBlankAudioMap.get(recProblem.problem_id);
              if (audioUrl) {
                const { error: updateError } = await supabase
                  .from("recording_problems" as any)
                  .update({ sentence_audio_url: audioUrl })
                  .eq("quiz_id", data.id)
                  .eq("problem_id", recProblem.problem_id);

                if (updateError) {
                  console.error("Failed to update recording audio URL:", updateError);
                }
              }
            }
            console.log("Recording audio URLs set from fill-blank audio:", data.id);
          }
        } catch (audioError) {
          console.error("Audio generation error:", audioError);
        }
      })();

      sessionStorage.removeItem("quizDraft");
      navigate(`/quiz/${data.id}`);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const wordsPerSet = draft.wordsPerSet || 5;
  const problemSets: Problem[][] = [];
  for (let i = 0; i < draft.problems.length; i += wordsPerSet) {
    problemSets.push(draft.problems.slice(i, i + wordsPerSet));
  }

  const langLabel = LANGUAGE_LABELS[draft.translationLanguage] || draft.translationLanguage;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" onClick={() => navigate("/quiz/create")} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> 돌아가기
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{draft.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <LevelBadge level={draft.difficulty} />
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground whitespace-nowrap">{draft.problems.length}개 문제</span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              {studentPreview ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Label htmlFor="student-preview" className="text-sm cursor-pointer whitespace-nowrap">
                학생 화면
              </Label>
              <Switch id="student-preview" checked={studentPreview} onCheckedChange={setStudentPreview} />
            </div>

            <div className="flex items-center gap-4">
              {currentStageIndex > 0 && (
                <Button variant="outline" onClick={() => setPreviewStage(prevStage)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전
                </Button>
              )}

              {!isLastStage ? (
                <Button onClick={handleNextStage} size="lg">
                  다음: {nextStage === "sentence_making" ? "문장 만들기" : "말하기 연습"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={saveQuiz} disabled={isSaving} size="lg">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  저장하기
                </Button>
              )}
            </div>
          </div>
        </div>

        {enabledStages.length > 1 && (
          <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
            {enabledStages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    previewStage === stage
                      ? "bg-primary text-primary-foreground"
                      : index < currentStageIndex
                        ? "bg-success/20 text-success-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">
                    {stage === "fill_blank" && "빈칸 채우기"}
                    {stage === "sentence_making" && "문장 만들기"}
                    {stage === "recording" && "말하기 연습"}
                  </span>
                </div>
                {index < enabledStages.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}

        {previewStage === "fill_blank" && (
          <FillBlankPreview
            problemSets={problemSets}
            wordsPerSet={wordsPerSet}
            studentPreview={studentPreview}
            showTranslations={showTranslations}
            setShowTranslations={setShowTranslations}
            regeneratingId={regeneratingId}
            langLabel={langLabel}
            updateProblem={updateProblem}
            regenerateProblem={regenerateProblem}
            addFillBlankProblem={addFillBlankProblem}
          />
        )}

        {previewStage === "sentence_making" &&
          draft.sentenceMakingProblems &&
          draft.sentenceMakingProblems.length > 0 && (
            <SentenceMakingPreview
              problems={draft.sentenceMakingProblems}
              studentPreview={studentPreview}
              updateSentenceMakingProblem={updateSentenceMakingProblem}
              deleteSentenceMakingProblem={deleteSentenceMakingProblem}
              addSentenceMakingProblem={addSentenceMakingProblem}
            />
          )}

        {previewStage === "recording" && draft.recordingProblems && draft.recordingProblems.length > 0 && (
          <RecordingPreview
            problems={draft.recordingProblems}
            studentPreview={studentPreview}
            updateRecordingProblem={updateRecordingProblem}
            deleteRecordingProblem={deleteRecordingProblem}
            regenerateRecordingProblem={regenerateRecordingProblem}
            addRecordingProblem={addRecordingProblem}
          />
        )}

        <div className="mt-8 flex justify-center gap-4">
          {currentStageIndex > 0 && (
            <Button variant="outline" onClick={() => setPreviewStage(prevStage)} size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전
            </Button>
          )}

          {!isLastStage ? (
            <Button onClick={handleNextStage} size="lg">
              다음: {nextStage === "sentence_making" ? "문장 만들기" : "말하기 연습"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={saveQuiz} disabled={isSaving} size="lg">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              퀴즈 저장하기
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
