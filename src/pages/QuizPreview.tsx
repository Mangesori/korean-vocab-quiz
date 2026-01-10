import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw, Loader2, ArrowLeft, Eye, EyeOff, Lightbulb, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { maskTranslation } from "@/utils/maskTranslation";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
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
    const updated = draft.problems.map((p) => (p.id === problemId ? { ...p, [field]: value } : p));
    setDraft({ ...draft, problems: updated });
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
        },
      });

      if (error || data.error) {
        throw new Error(data?.error || "Regeneration failed");
      }

      const newProblem = data.problems[0];
      const updated = draft.problems.map((p) => (p.id === problem.id ? { ...newProblem, id: problem.id } : p));

      setDraft({ ...draft, problems: updated });
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
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
        timer_enabled: draft.timerEnabled,
        timer_seconds: draft.timerSeconds,
        problems: JSON.parse(JSON.stringify(shuffledProblems)),
        teacher_id: user.id,
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
            console.log("Audio generation completed for quiz:", data.id);
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

            <Button onClick={saveQuiz} disabled={isSaving} size="lg">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              저장하기
            </Button>
          </div>
        </div>

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
                <CardContent className="py-6">
                  {/* 보기 (워드 뱅크) */}
                  <div className="mb-6">
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
                                <Button variant="outline" size="sm" disabled>
                                  <Volume2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
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
                          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                            {problem.word}
                          </span>
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

        <div className="mt-8 flex justify-center">
          <Button onClick={saveQuiz} disabled={isSaving} size="lg">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            퀴즈 저장하기
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
