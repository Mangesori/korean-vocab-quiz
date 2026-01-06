import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Users,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  Clock,
  FileText,
  CheckCircle,
  Eye,
  EyeOff,
  Lightbulb,
  Save,
  Volume2,
  RefreshCw,
  Copy,
  Link2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nanoid } from "nanoid";
import { maskTranslation } from "@/utils/maskTranslation";

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

interface Quiz {
  id: string;
  title: string;
  words: string[];
  difficulty: string;
  translation_language: string;
  words_per_set: number;
  timer_enabled: boolean;
  timer_seconds: number | null;
  problems: Problem[];
  created_at: string;
  teacher_id: string;
}

interface Class {
  id: string;
  name: string;
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

// 학생 화면용: 문장에서 빈칸과 힌트를 분리하여 렌더링
const renderStudentSentence = (sentence: string, hint: string) => {
  const parts = sentence.split(/\(\s*\)|\(\)/);

  if (parts.length < 2) {
    return <span>{sentence}</span>;
  }

  return (
    <span className="flex items-center flex-wrap gap-1">
      <span>{parts[0]}</span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block min-w-[100px] h-8 rounded border bg-background"></span>
        <span className="text-primary text-sm">{hint}</span>
      </span>
      <span>{parts[1]}</span>
    </span>
  );
};



export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [editedProblems, setEditedProblems] = useState<Problem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [regeneratingProblemId, setRegeneratingProblemId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  
  // Link sharing states
  const [shareUrl, setShareUrl] = useState<string>("");
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  
  // Title editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user && id) {
      fetchQuiz();
      fetchClasses();
      checkAudioStatus();

      // Realtime subscription for audio updates
      const channel = supabase
        .channel('quiz-detail-audio-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quiz_problems',
            filter: `quiz_id=eq.${id}`,
          },
          (payload) => {
            const newProblem = payload.new as any;
            if (newProblem.sentence_audio_url) {
              setAudioUrls((prev) => ({
                ...prev,
                [newProblem.problem_id]: newProblem.sentence_audio_url,
              }));
              setHasAudio(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, id]);

  // Reset share URL when dialog closes
  useEffect(() => {
    if (!sendDialogOpen) {
      setShareUrl("");
    }
  }, [sendDialogOpen]);

  const checkAudioStatus = async () => {
    const { data } = await supabase
      .from("quiz_problems")
      .select("problem_id, sentence_audio_url")
      .eq("quiz_id", id);
    
    if (data && data.length > 0) {
      const hasAnyAudio = data.some(p => !!p.sentence_audio_url);
      setHasAudio(hasAnyAudio);
      
      // 오디오 URL들을 상태에 저장
      const urls: Record<string, string> = {};
      data.forEach(p => {
        if (p.sentence_audio_url) {
          urls[p.problem_id] = p.sentence_audio_url;
        }
      });
      setAudioUrls(urls);
    } else {
      setHasAudio(false);
    }
  };

  const fetchQuiz = async () => {
    const { data, error } = await supabase.from("quizzes").select("*").eq("id", id).single();

    if (error) {
      toast.error("퀴즈를 불러올 수 없습니다");
      navigate("/dashboard");
      return;
    }

    const quizData = data as any;
    
    // Sort problems to match the original word list order
    if (quizData.problems && quizData.words) {
      const sortedProblems = quizData.problems.sort((a: Problem, b: Problem) => {
        const indexA = quizData.words.indexOf(a.word);
        const indexB = quizData.words.indexOf(b.word);
        return indexA - indexB;
      });
      quizData.problems = sortedProblems;
    }
    
    setQuiz(quizData);
    setEditedProblems(quizData.problems);
    setIsLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name").eq("teacher_id", user?.id);

    if (data) setClasses(data);
  };

  const updateProblem = (problemId: string, field: keyof Problem, value: string) => {
    const updated = editedProblems.map((p) => (p.id === problemId ? { ...p, [field]: value } : p));
    setEditedProblems(updated);
    setHasChanges(true);
  };

  const saveChanges = async () => {
    if (!quiz) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ problems: JSON.parse(JSON.stringify(editedProblems)) })
        .eq("id", quiz.id);

      if (error) throw error;

      setQuiz({ ...quiz, problems: editedProblems });
      setHasChanges(false);
      setIsEditing(false);
      toast.success("변경사항이 저장되었습니다");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleSave = async () => {
    if (!quiz || !editedTitle.trim()) return;

    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ title: editedTitle.trim() })
        .eq("id", quiz.id);

      if (error) throw error;

      setQuiz({ ...quiz, title: editedTitle.trim() });
      setIsEditingTitle(false);
      toast.success("퀴즈 제목이 수정되었습니다");
    } catch (error) {
      console.error("Title update error:", error);
      toast.error("제목 수정에 실패했습니다");
    }
  };

  // TTS 생성 및 업로드 함수
  const generateAndUploadAudio = async (text: string, quizId: string, problemId: string, answer: string): Promise<string | null> => {
    try {
      // 빈칸을 정답으로 대체하여 완전한 문장 만들기
      let cleanText = text.replace(/\(\s*\)|\(\)/g, answer);
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
        console.error(`TTS generation failed: ${response.status}`);
        return null;
      }

      const audioBlob = await response.blob();
      const timestamp = Date.now();
      const fileName = `${quizId}/${problemId}_${timestamp}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from('quiz-audio')
        .upload(fileName, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Audio upload failed:`, uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('quiz-audio')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`TTS error:`, error);
      return null;
    }
  };

  const regenerateAllAudio = async () => {
    if (!quiz) return;

    setIsGeneratingAudio(true);
    const problems = quiz.problems;
    setAudioProgress({ current: 0, total: problems.length });

    try {
      const newUrls: Record<string, string> = {};
      
      // 순차적으로 TTS 생성 (429 에러 방지)
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        setAudioProgress({ current: i + 1, total: problems.length });
        
        const audioUrl = await generateAndUploadAudio(
          problem.sentence,
          quiz.id,
          problem.id,
          problem.answer
        );

        if (audioUrl) {
          // 즉시 상태 업데이트하여 버튼 활성화
          setAudioUrls(prev => ({ ...prev, [problem.id]: audioUrl }));
          setHasAudio(true);
          
          newUrls[problem.id] = audioUrl;
          // quiz_problems 테이블 업데이트
          await supabase
            .from("quiz_problems")
            .update({ sentence_audio_url: audioUrl })
            .eq("quiz_id", quiz.id)
            .eq("problem_id", problem.id);
        }
      }

      // 혹시 누락된 부분이 있을 수 있으므로 마지막에 한 번 더 병합
      setAudioUrls(prev => ({ ...prev, ...newUrls }));
      toast.success("음성 생성이 완료되었습니다!");
    } catch (error) {
      console.error("Audio generation error:", error);
      toast.error("음성 생성에 실패했습니다");
    } finally {
      setIsGeneratingAudio(false);
      setAudioProgress({ current: 0, total: 0 });
    }
  };

  const regenerateSingleAudio = async (problem: Problem) => {
    if (!quiz) return;

    setRegeneratingProblemId(problem.id);

    try {
      const audioUrl = await generateAndUploadAudio(
        problem.sentence,
        quiz.id,
        problem.id,
        problem.answer
      );

      if (audioUrl) {
        await supabase
          .from("quiz_problems")
          .update({ sentence_audio_url: audioUrl })
          .eq("quiz_id", quiz.id)
          .eq("problem_id", problem.id);
        
        setAudioUrls(prev => ({ ...prev, [problem.id]: audioUrl }));
        setHasAudio(true);
        toast.success(`"${problem.word}" 문제의 음성이 재생성되었습니다`);
      }
    } catch (error) {
      console.error("Single audio generation error:", error);
      toast.error("음성 재생성에 실패했습니다");
    } finally {
      setRegeneratingProblemId(null);
    }
  };

  const playAudio = (problemId: string) => {
    const url = audioUrls[problemId];
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  const handleSendQuiz = async () => {
    if (!selectedClassId || !quiz) return;

    setIsSending(true);

    try {
      // Get class members
      const { data: members, error: membersError } = await supabase
        .from("class_members")
        .select("student_id")
        .eq("class_id", selectedClassId);

      if (membersError) throw membersError;

      // Create assignment
      const { error: assignError } = await supabase.from("quiz_assignments").insert({
        quiz_id: quiz.id,
        class_id: selectedClassId,
      });

      if (assignError) throw assignError;

      // Get class name
      const selectedClass = classes.find((c) => c.id === selectedClassId);

      // Create notifications for all students
      if (members && members.length > 0) {
        const notifications = members.map((m) => ({
          user_id: m.student_id,
          type: "quiz_assigned" as const,
          title: "새 퀴즈가 도착했습니다!",
          message: `${quiz.title} 퀴즈가 할당되었습니다.`,
          quiz_id: quiz.id,
          from_user_id: user?.id,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast.success(`${selectedClass?.name} 클래스에 퀴즈를 보냈습니다!`);
      setSendDialogOpen(false);
      setSelectedClassId("");
    } catch (error) {
      console.error("Send error:", error);
      toast.error("퀴즈 전송에 실패했습니다");
    } finally {
      setIsSending(false);
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

  const generateShareLink = async () => {
    if (!quiz) return;

    setIsGeneratingLink(true);

    try {
      const shareToken = nanoid(12);
      
      const { error } = await supabase.from("quiz_shares").insert({
        quiz_id: quiz.id,
        share_token: shareToken,
        created_by: user?.id,
        allow_anonymous: allowAnonymous,
      });

      if (error) throw error;

      const url = `${window.location.origin}/quiz/share/${shareToken}`;
      setShareUrl(url);
      toast.success("공유 링크가 생성되었습니다!");
    } catch (error) {
      console.error("Share link error:", error);
      toast.error("링크 생성에 실패했습니다");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("링크가 복사되었습니다");
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || role !== "teacher") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz) return null;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> 대시보드
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-2xl sm:text-3xl font-bold h-auto py-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleSave();
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleTitleSave}
                  disabled={!editedTitle.trim()}
                >
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingTitle(false)}
                >
                  취소
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{quiz.title}</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditedTitle(quiz.title);
                    setIsEditingTitle(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
              <LevelBadge level={quiz.difficulty} />
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <FileText className="w-4 h-4" />
                {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
              </span>
              {quiz.timer_enabled && quiz.timer_seconds && (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4" />
                  {quiz.timer_seconds}초
                </span>
              )}
              <span className="text-muted-foreground text-sm">
                {format(new Date(quiz.created_at), "yyyy년 M월 d일", { locale: ko })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none">
                  <Send className="w-4 h-4 mr-2" /> <span className="whitespace-nowrap">퀴즈 보내기</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>퀴즈 보내기</DialogTitle>
                  <DialogDescription>클래스에 할당하거나 링크로 공유하세요</DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="class" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="class">클래스에 할당</TabsTrigger>
                    <TabsTrigger value="share">링크 공유</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="class" className="space-y-4">
                    {classes.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-4">아직 생성된 클래스가 없습니다</p>
                        <Link to="/classes">
                          <Button variant="outline">클래스 만들기</Button>
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>클래스 선택</Label>
                          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger>
                              <SelectValue placeholder="클래스를 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={handleSendQuiz} disabled={!selectedClassId || isSending}>
                          {isSending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          보내기
                        </Button>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="share" className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="anonymous">익명 응시 허용</Label>
                        <Switch
                          id="anonymous"
                          checked={allowAnonymous}
                          onCheckedChange={setAllowAnonymous}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        비회원도 퀴즈를 풀 수 있습니다
                      </p>
                    </div>
                    
                    {!shareUrl ? (
                      <Button 
                        className="w-full" 
                        onClick={generateShareLink}
                        disabled={isGeneratingLink}
                      >
                        {isGeneratingLink ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4 mr-2" />
                        )}
                        링크 생성
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Label>공유 링크</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={shareUrl} 
                            readOnly 
                            className="font-mono text-xs"
                          />
                          <Button 
                            size="icon" 
                            variant="outline"
                            onClick={copyToClipboard}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          이 링크를 공유하면 누구나 퀴즈를 풀 수 있습니다
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Words */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">단어 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quiz.words.map((word, idx) => (
                <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {word}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Problems */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">문제 미리보기</h2>
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
            </div>
            <div className="flex items-center gap-2">
              {/* 전체 음성 재생성 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateAllAudio}
                disabled={isGeneratingAudio}
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                    <span className="whitespace-nowrap">
                      ({audioProgress.current}/{audioProgress.total})
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline whitespace-nowrap">전체 음성 재생성</span>
                    <span className="sm:hidden">전체 재생성</span>
                  </>
                )}
              </Button>
              <Button
                variant={isEditing ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit2 className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{isEditing ? "수정 취소" : "수정하기"}</span>
                <span className="sm:hidden">{isEditing ? "취소" : "수정"}</span>
              </Button>
              {hasChanges && (
                <Button onClick={saveChanges} disabled={isSaving} size="sm">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-1 sm:mr-2" />}
                  <span className="hidden sm:inline">저장하기</span>
                  <span className="sm:hidden">저장</span>
                </Button>
              )}
            </div>
          </div>

          {/* 세트별 표시 */}
          {(() => {
            const wordsPerSet = quiz.words_per_set || 5;
            const problemSets: Problem[][] = [];
            for (let i = 0; i < editedProblems.length; i += wordsPerSet) {
              problemSets.push(editedProblems.slice(i, i + wordsPerSet));
            }
            const langLabel = LANGUAGE_LABELS[quiz.translation_language] || quiz.translation_language;

            return problemSets.map((set, setIndex) => (
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
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => playAudio(problem.id)}
                                      disabled={!audioUrls[problem.id]}
                                    >
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
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => playAudio(problem.id)}
                                      disabled={!audioUrls[problem.id]}
                                    >
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
                  /* 교사 화면 (읽기/편집 모드) */
                  <div className="space-y-4">
                    {set.map((problem, problemIndex) => {
                      // 문장에서 정답 위치를 찾아서 하이라이트
                      const completeSentence = problem.sentence.replace(/\(\s*\)|\(\)/, problem.answer);

                      return (
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => playAudio(problem.id)}
                                  disabled={!audioUrls[problem.id]}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => regenerateSingleAudio(problem)}
                                  disabled={regeneratingProblemId === problem.id || isGeneratingAudio}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {regeneratingProblemId === problem.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                  )}
                                  <span className="hidden sm:inline">음성 재생성</span>
                                </Button>
                              </div>
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

                            {/* 출제 문장 - 편집 모드일 때만 표시 */}
                            {isEditing && (
                              <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                                  출제 문장
                                </Label>
                                <Input
                                  value={problem.sentence}
                                  onChange={(e) => updateProblem(problem.id, "sentence", e.target.value)}
                                  className="text-lg bg-muted/30"
                                />
                              </div>
                            )}

                            {/* 정답과 힌트 - 가로 배치 */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                                  정답
                                </Label>
                                {isEditing ? (
                                  <Input
                                    value={problem.answer}
                                    onChange={(e) => updateProblem(problem.id, "answer", e.target.value)}
                                    className="bg-muted/30"
                                  />
                                ) : (
                                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.answer}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                                  힌트
                                </Label>
                                {isEditing ? (
                                  <Input
                                    value={problem.hint}
                                    onChange={(e) => updateProblem(problem.id, "hint", e.target.value)}
                                    className="bg-muted/30"
                                  />
                                ) : (
                                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.hint}</p>
                                )}
                              </div>
                            </div>

                            {/* 번역 (회색 배경) */}
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                                번역({langLabel})
                              </Label>
                              {isEditing ? (
                                <Textarea
                                  value={problem.translation}
                                  onChange={(e) => updateProblem(problem.id, "translation", e.target.value)}
                                  className="bg-muted/30 min-h-[60px]"
                                  rows={2}
                                />
                              ) : (
                                <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.translation}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
    </AppLayout>
  );
}
