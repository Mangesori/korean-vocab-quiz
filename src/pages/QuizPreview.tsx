import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw, Loader2, ArrowLeft, Eye, EyeOff, Lightbulb, Volume2, ArrowRight, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { maskTranslation } from "@/utils/maskTranslation";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

interface SentenceMakingProblem {
  problem_id: string;
  word: string;
  word_meaning: string;
  model_answer: string;
}

interface RecordingProblem {
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  translation: string;
}

interface QuizDraft {
  title: string;
  words: string[];
  difficulty: string;
  translationLanguage: string;
  wordsPerSet: number;
  timerEnabled: boolean;
  timerSeconds: number | null;
  problems: Problem[];
  apiProvider?: "openai" | "gemini" | "gemini-pro";
  // 새로운 퀴즈 유형 옵션
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  sentenceMakingProblems?: SentenceMakingProblem[];
  recordingProblems?: RecordingProblem[];
}

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

// 문장에서 정답을 하이라이트하여 표시
const highlightAnswerInSentence = (sentence: string, answer: string) => {
  // ( ) 부분을 정답으로 대체
  const parts = sentence.split(/\(\s*\)|\(\)/);

  if (parts.length < 2) {
    // 빈칸이 없으면 그대로 반환
    return <span>{sentence}</span>;
  }

  return (
    <span>
      {parts.map((part, idx) => (
        <span key={idx}>
          {part}
          {idx < parts.length - 1 && <span className="text-primary font-bold">{answer}</span>}
        </span>
      ))}
    </span>
  );
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

  // 다단계 미리보기 상태 관리
  type PreviewStage = "fill_blank" | "sentence_making" | "recording";
  const [previewStage, setPreviewStage] = useState<PreviewStage>("fill_blank");

  // 활성화된 단계를 동적으로 계산
  const enabledStages = useMemo(() => {
    const stages: PreviewStage[] = ["fill_blank"];
    if (draft?.sentenceMakingEnabled) stages.push("sentence_making");
    if (draft?.recordingEnabled) stages.push("recording");
    return stages;
  }, [draft?.sentenceMakingEnabled, draft?.recordingEnabled]);

  // 내비게이션 헬퍼
  const currentStageIndex = enabledStages.indexOf(previewStage);
  const isLastStage = currentStageIndex === enabledStages.length - 1;
  const nextStage = enabledStages[currentStageIndex + 1];
  const prevStage = enabledStages[currentStageIndex - 1];

  // 빈칸 채우기 문장에서 녹음 문장 생성 (호출 시 항상 새로 생성)
  const generateRecordingProblems = useCallback(() => {
    if (!draft?.recordingEnabled || !draft.problems) return;

    const recordingProblems: RecordingProblem[] = draft.problems.map((problem, index) => {
      // 빈칸 패턴 `( )` 또는 `()`을 정답으로 대체
      const sentenceWithoutBlanks = problem.sentence.replace(/\(\s*\)|\(\)/g, problem.answer);

      return {
        problem_id: problem.id,
        sentence: sentenceWithoutBlanks,
        mode: "read" as const,
        translation: problem.translation,
      };
    });

    setDraft((prev) => {
      if (!prev) return null;
      return { ...prev, recordingProblems };
    });
  }, [draft?.recordingEnabled, draft?.problems]);

  // "다음" 버튼 클릭 시 녹음 문제 생성 + 단계 전환
  const handleNextStage = () => {
    if (previewStage === "fill_blank" && draft?.recordingEnabled) {
      generateRecordingProblems();
    }
    setPreviewStage(nextStage);
  };

  // draft 변경 시 sessionStorage 자동 업데이트
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
      // Sync words array when word field is changed
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
      const updated = [...prev.problems, newProblem];
      return { ...prev, problems: updated, words: [...prev.words, ""] };
    });
  };

  // 문장 만들기 문제 편집 함수들
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
      const updated = prev.sentenceMakingProblems.filter((p) => p.problem_id !== problemId);
      return { ...prev, sentenceMakingProblems: updated };
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
      const updated = [...(prev.sentenceMakingProblems || []), newProblem];
      return { ...prev, sentenceMakingProblems: updated };
    });
  };

  // 녹음 문제 편집 함수들
  const updateRecordingProblem = (problemId: string, field: keyof RecordingProblem, value: any) => {
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
      const updated = prev.recordingProblems.filter((p) => p.problem_id !== problemId);
      return { ...prev, recordingProblems: updated };
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
      const updated = [...(prev.recordingProblems || []), newProblem];
      return { ...prev, recordingProblems: updated };
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
          apiProvider: draft.apiProvider,
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

  // Fisher-Yates 셔플 알고리즘
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // TTS 생성 함수
  const generateAndUploadAudio = async (text: string, quizId: string, problemId: string, type: 'sentence' | 'hint'): Promise<string | null> => {
    try {
      // 빈칸을 정답으로 대체하여 완전한 문장 만들기
      const problem = draft.problems.find(p => p.id === problemId);
      let cleanText = text;
      if (type === 'sentence' && problem) {
        cleanText = text.replace(/\(\s*\)|\(\)/g, problem.answer);
      }
      
      // 문장 끝 정리
      cleanText = cleanText.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      if (!response.ok) {
        console.error(`TTS generation failed for ${type}: ${response.status}`);
        return null;
      }

      const audioBlob = await response.blob();
      const fileName = `${quizId}/${problemId}_${type}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from('quiz-audio')
        .upload(fileName, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Audio upload failed for ${type}:`, uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('quiz-audio')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`TTS error for ${type}:`, error);
      return null;
    }
  };



  const saveQuiz = async () => {
    setIsSaving(true);

    try {
      // 문제 순서를 셔플하여 단어 입력 순서와 다르게 함
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
        api_provider: draft.apiProvider || "openai",
        // 새로운 퀴즈 유형 옵션
        sentence_making_enabled: draft.sentenceMakingEnabled || false,
        recording_enabled: draft.recordingEnabled || false,
      };

      const { data, error } = await supabase.from("quizzes").insert(quizData).select().single();

      if (error) throw error;

      // 정답을 별도 테이블에 저장 (학생에게 노출되지 않음)
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

      // 문장 만들기 문제 저장
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
          // 실패해도 계속 진행 (기본 퀴즈는 저장됨)
        }
      }

      // 녹음 문제 저장
      if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
        const recProblemsToInsert = draft.recordingProblems.map((p) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          sentence: p.sentence,
          mode: p.mode,
          translation: p.translation || null,
          source_type: 'reuse' as const, // 빈칸 채우기 문장 재사용
        }));

        const { error: recError } = await supabase.from("recording_problems").insert(recProblemsToInsert);
        if (recError) {
          console.error("Failed to save recording problems:", recError);
          // 실패해도 계속 진행 (기본 퀴즈는 저장됨)
        }
      }

      // TTS 생성 (백그라운드에서 진행, 저장은 완료 처리)
      toast.success("퀴즈가 저장되었습니다! 음성을 생성 중입니다...");
      
      // 음성 생성을 비동기로 처리 (순차적으로 - 429 에러 방지)
      (async () => {
        try {
          const problemsWithAudio = [];
          
          // 순차적으로 TTS 생성 (동시 요청 제한 회피)
          for (const problem of shuffledProblems) {
            const sentenceAudioUrl = await generateAndUploadAudio(
              problem.sentence,
              data.id,
              problem.id,
              'sentence'
            );

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

          const { error: problemsError } = await supabase
            .from("quiz_problems")
            .insert(problemsWithAudio);

          if (problemsError) {
            console.error("Failed to save quiz problems with audio:", problemsError);
          } else {
            console.log("Audio generation completed for fill-blank problems:", data.id);
          }

          // 2. 녹음 문제 오디오 URL 설정 (빈칸 채우기 오디오 재사용)
          if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
            // problem_id가 동일하므로 fill-blank에서 생성된 URL 그대로 사용
            const fillBlankAudioMap = new Map(
              problemsWithAudio
                .filter(p => p.sentence_audio_url)
                .map(p => [p.problem_id, p.sentence_audio_url])
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

  // 세트별로 문제 그룹화
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
                <Button
                  variant="outline"
                  onClick={() => setPreviewStage(prevStage)}
                >
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

        {/* 단계 진행 표시 (두 개 이상의 단계가 있을 때만 표시) */}
        {enabledStages.length > 1 && (
          <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
            {enabledStages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                  previewStage === stage
                    ? "bg-primary text-primary-foreground"
                    : index < currentStageIndex
                      ? "bg-success/20 text-success-foreground"
                      : "bg-muted text-muted-foreground"
                }`}>
                  <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">
                    {stage === "fill_blank" && "빈칸 채우기"}
                    {stage === "sentence_making" && "문장 만들기"}
                    {stage === "recording" && "말하기 연습"}
                  </span>
                </div>
                {index < enabledStages.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 빈칸 채우기 미리보기 */}
        {previewStage === "fill_blank" && (
          <>
            {/* 세트별 표시 */}
            {problemSets.map((set, setIndex) => (
          <div key={setIndex} className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
                세트 {setIndex + 1}
              </span>
            </div>

            {studentPreview ? (
              /* 학생 화면 미리보기 - QuizTake와 동일한 레이아웃 */
              <Card className="shadow-lg">
                <CardContent className="p-4 sm:p-6">
                  {/* 보기 (워드 뱅크) */}
                  <div className="mb-4 sm:mb-6">
                    <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {set.map((problem) => (
                        <span
                          key={problem.id}
                          className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium"
                        >
                          {problem.word}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 문제 리스트 - QuizTake와 동일한 구조 */}
                  <div className="space-y-0 divide-y">
                    {set.map((problem, problemIndex) => {
                      const problemNumber = setIndex * wordsPerSet + problemIndex + 1;
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
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>
                                  <Volume2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setShowTranslations(prev => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                                >
                                  <Lightbulb className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {showTranslations[problem.id] && problem.translation && (
                              <div className="mt-2 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                                {maskTranslation(problem.translation)}
                              </div>
                            )}
                            <Input
                              readOnly
                              className="h-10 text-center bg-muted/30"
                              placeholder="정답 입력"
                            />
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
                                          readOnly
                                          className="w-48 h-8 mx-1 text-center text-sm inline-block bg-muted/30"
                                          placeholder="정답 입력"
                                        />
                                        {problem.hint && <span className="text-primary text-sm">{problem.hint}</span>}
                                      </>
                                    )}
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button variant="outline" size="sm" disabled>
                                  <Volume2 className="w-4 h-4 mr-1" />
                                  듣기
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setShowTranslations(prev => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                                >
                                  <Lightbulb className="w-4 h-4 mr-1" />
                                  힌트
                                </Button>
                              </div>
                            </div>
                            {showTranslations[problem.id] && problem.translation && (
                              <div className="mt-2 ml-8 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                                {maskTranslation(problem.translation)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* 교사 편집 화면 - QuizDetail과 동일한 스타일 */
              <div className="space-y-4">
                {set.map((problem, problemIndex) => (
                  <Card key={problem.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                            {setIndex * wordsPerSet + problemIndex + 1}
                          </span>
                          <Input
                            value={problem.word}
                            onChange={(e) => updateProblem(problem.id, "word", e.target.value)}
                            className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-center w-auto min-w-[80px] max-w-[200px] h-8 text-sm border-primary/30"
                          />
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => regenerateProblem(problem)}
                          disabled={regeneratingId === problem.id}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {regeneratingId === problem.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          <span className="hidden sm:inline">문제 재생성</span>
                          <span className="sm:hidden">재생성</span>
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 pb-5 space-y-4">
                      {/* 문장 (정답 하이라이트) */}
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">문장</Label>
                        <p className="text-lg px-3 py-2 rounded-md bg-muted/30">
                          {problem.sentence.split(/\(\s*\)|\(\)/).map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span className="text-primary font-bold">{problem.answer}</span>
                              )}
                            </span>
                          ))}
                        </p>
                      </div>

                      {/* 출제 문장 */}
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                          출제 문장
                        </Label>
                        <Input
                          value={problem.sentence}
                          onChange={(e) => updateProblem(problem.id, "sentence", e.target.value)}
                          className="text-sm sm:text-lg bg-muted/30"
                        />
                      </div>

                      {/* 정답과 힌트 - 가로 배치 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                            정답
                          </Label>
                          <Input
                            value={problem.answer}
                            onChange={(e) => updateProblem(problem.id, "answer", e.target.value)}
                            className="bg-muted/30 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                            힌트
                          </Label>
                          <Input
                            value={problem.hint}
                            onChange={(e) => updateProblem(problem.id, "hint", e.target.value)}
                            className="bg-muted/30 text-sm"
                          />
                        </div>
                      </div>

                      {/* 번역 */}
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                          번역({langLabel})
                        </Label>
                        <Textarea
                          value={problem.translation}
                          onChange={(e) => updateProblem(problem.id, "translation", e.target.value)}
                          className="bg-muted/30 min-h-[60px] text-sm"
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
            ))}
          {!studentPreview && (
            <div className="flex justify-center mt-4">
              <Button
                variant="ghost"
                className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
                onClick={addFillBlankProblem}
              >
                <Plus className="w-4 h-4 mr-2" />
                문제 추가
              </Button>
            </div>
          )}
          </>
        )}

        {/* 문장 만들기 미리보기 */}
        {previewStage === "sentence_making" && draft.sentenceMakingProblems && draft.sentenceMakingProblems.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">문장 만들기 단어 목록</h2>
              <p className="text-muted-foreground">
                학생들은 각 단어를 사용하여 문장을 만들어야 합니다. (저장 후 QuizDetail에서 상세 편집 가능)
              </p>
            </div>

            {studentPreview ? (
              /* 학생 미리보기: 학생이 보는 것처럼 그리드 레이아웃 */
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {draft.sentenceMakingProblems.map((problem, index) => (
                      <div
                        key={problem.problem_id}
                        className="p-4 rounded-lg border-2 border-primary/20 bg-muted/30 text-center"
                      >
                        <div className="text-sm text-muted-foreground mb-1">#{index + 1}</div>
                        <div className="text-lg font-bold">{problem.word}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* 교사 편집 화면: 편집 가능한 카드 그리드 */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {draft.sentenceMakingProblems.map((problem, index) => (
                    <Card key={problem.problem_id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="py-3 px-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">#{index + 1}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSentenceMakingProblem(problem.problem_id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">단어</Label>
                          <Input
                            value={problem.word}
                            onChange={(e) => updateSentenceMakingProblem(problem.problem_id, "word", e.target.value)}
                            placeholder="단어 입력"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">뜻 (선택)</Label>
                          <Input
                            value={problem.word_meaning || ""}
                            onChange={(e) => updateSentenceMakingProblem(problem.problem_id, "word_meaning", e.target.value)}
                            placeholder="단어 뜻"
                            className="mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-center mt-4">
                  <Button
                    variant="ghost"
                    className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
                    onClick={addSentenceMakingProblem}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    단어 추가하기
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 녹음 미리보기 */}
        {previewStage === "recording" && draft.recordingProblems && draft.recordingProblems.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">말하기 연습 문제 목록</h2>
              <p className="text-muted-foreground">
                학생들은 각 문장을 보고 듣고 말해야 합니다. (저장 후 QuizDetail에서 상세 편집 가능)
              </p>
            </div>

            {studentPreview ? (
              /* 학생 미리보기: 간소화된 뷰 */
              <Card className="shadow-lg">
                <CardContent className="p-6 space-y-4">
                  {draft.recordingProblems.map((problem, index) => (
                    <div key={problem.problem_id} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-lg leading-relaxed">{problem.sentence}</p>
                          {problem.translation && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {problem.translation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              /* 교사 편집 화면: 편집 가능한 카드 레이아웃 */
              <div className="space-y-4">
                {draft.recordingProblems.map((problem, index) => (
                  <Card key={problem.problem_id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                            {index + 1}
                          </span>

                          {/* 모드 선택 드롭다운 */}
                          <Select
                            value={problem.mode}
                            onValueChange={(value: "read" | "listen") =>
                              updateRecordingProblem(problem.problem_id, "mode", value)
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  보고 말하기
                                </div>
                              </SelectItem>
                              <SelectItem value="listen">
                                <div className="flex items-center gap-2">
                                  <EyeOff className="w-4 h-4" />
                                  듣고 말하기
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => regenerateRecordingProblem(problem.problem_id, index)}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">문제 재생성</span>
                            <span className="sm:hidden">재생성</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRecordingProblem(problem.problem_id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 pb-5 space-y-3">
                      {/* 문장 편집 */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">문장</Label>
                        <Textarea
                          value={problem.sentence}
                          onChange={(e) => updateRecordingProblem(problem.problem_id, "sentence", e.target.value)}
                          placeholder="말하기 연습할 문장 입력"
                          className="mt-1 min-h-[80px]"
                        />
                      </div>

                      {/* 번역 편집 */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">번역</Label>
                        <Textarea
                          value={problem.translation || ""}
                          onChange={(e) => updateRecordingProblem(problem.problem_id, "translation", e.target.value)}
                          placeholder="번역 입력 (선택)"
                          className="mt-1 min-h-[60px]"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-center mt-4">
                  <Button
                    variant="ghost"
                    className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
                    onClick={addRecordingProblem}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    문제 추가하기
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          {currentStageIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setPreviewStage(prevStage)}
              size="lg"
            >
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
