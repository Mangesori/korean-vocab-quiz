import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Save, Loader2, Trash2, Volume2, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RecordingProblem {
  id: string;
  quiz_id: string;
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  sentence_audio_url: string | null;
  translation: string | null;
  source_type: string;
  created_at: string;
}

interface RecordingProblemListProps {
  problems: RecordingProblem[];
  onRefresh: () => void;
}

export function RecordingProblemList({
  problems,
  onRefresh,
}: RecordingProblemListProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProblems, setEditedProblems] = useState<RecordingProblem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  useEffect(() => {
    const fetchAudioUrls = async () => {
      const problemIds = problems.map((p) => p.problem_id).filter(Boolean);
      if (problemIds.length === 0) return;
      const { data } = await supabase
        .from("quiz_problems")
        .select("problem_id, sentence_audio_url")
        .eq("quiz_id", quizId)
        .in("problem_id", problemIds);
      if (data) {
        const map: Record<string, string> = {};
        for (const qp of data) {
          if (qp.sentence_audio_url) map[qp.problem_id] = qp.sentence_audio_url;
        }
        setAudioUrlMap(map);
      }
    };
    fetchAudioUrls();
  }, [problems]);

  const handleUpdateProblem = (id: string, field: keyof RecordingProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleModeChange = (id: string, mode: "read" | "listen") => {
    setEditedProblems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, mode };
        if (mode === "listen" && !p.sentence_audio_url) {
          const url = audioUrlMap[p.problem_id];
          if (url) updated.sentence_audio_url = url;
        }
        return updated;
      })
    );
  };

  const handleAddProblem = () => {
    const newId = `temp-${crypto.randomUUID()}`;
    const newProblem: RecordingProblem = {
      id: newId,
      quiz_id: quizId || '',
      problem_id: `rec-${crypto.randomUUID().slice(0, 8)}`,
      sentence: '',
      mode: 'read',
      sentence_audio_url: null,
      translation: '',
      source_type: 'teacher_input',
      created_at: new Date().toISOString()
    };
    setEditedProblems(prev => [...prev, newProblem]);
    if (!isEditing) setIsEditing(true);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        editedProblems.map((problem) => {
          if (problem.id.startsWith('temp-')) {
            return supabase.from("recording_problems").insert({
              quiz_id: problem.quiz_id,
              problem_id: problem.problem_id,
              sentence: problem.sentence,
              mode: problem.mode,
              sentence_audio_url: problem.sentence_audio_url || null,
              translation: problem.translation || null,
              source_type: (problem.source_type || 'teacher_input') as "reuse" | "ai_generated" | "teacher_input"
            });
          } else {
            return supabase
              .from("recording_problems")
              .update({
                sentence: problem.sentence,
                mode: problem.mode,
                sentence_audio_url: problem.sentence_audio_url || null,
                translation: problem.translation || null,
              })
              .eq("id", problem.id);
          }
        })
      );

      toast.success("전체 문제가 저장되었습니다");
      setIsEditing(false);
      onRefresh();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "전체 저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateAudio = async (problem: RecordingProblem) => {
    if (!quizId) return;
    setRegeneratingId(problem.id);
    try {
      const cleanText = problem.sentence
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .replace(/\.\s*\.$/, ".");

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

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

      const audioBlob = await response.blob();
      const fileName = `${quizId}/recording_${problem.problem_id}_${Date.now()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('quiz-audio')
        .upload(fileName, audioBlob, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('quiz-audio')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("recording_problems")
        .update({ sentence_audio_url: urlData.publicUrl })
        .eq("id", problem.id);

      if (updateError) throw updateError;

      toast.success("음성이 생성되었습니다");
      onRefresh();
    } catch (error: any) {
      console.error("Audio regeneration error:", error);
      toast.error(error.message || "음성 생성에 실패했습니다");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async (problemId: string) => {
    if (!confirm("이 문제를 삭제하시겠습니까?")) return;

    setDeletingId(problemId);
    // editedProblems에서 즉시 제거
    setEditedProblems(prev => prev.filter(p => p.id !== problemId));

    try {
      // 미저장 항목(temp-)은 DB 삭제 불필요
      if (!problemId.startsWith("temp-")) {
        const { error } = await supabase
          .from("recording_problems")
          .delete()
          .eq("id", problemId);

        if (error) throw error;
        onRefresh();
      }

      toast.success("문제가 삭제되었습니다");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "삭제에 실패했습니다");
    } finally {
      setDeletingId(null);
    }
  };

  if (problems.length === 0 && editedProblems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        말하기 연습 문제가 없습니다.
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
            onClick={handleAddProblem}
          >
            <Plus className="w-4 h-4 mr-2" />
            문제 추가하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">문제 목록</h2>
          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium">
            {problems.length}개
          </span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="w-full sm:w-auto"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            <span>{isEditing ? "수정 취소" : "수정하기"}</span>
          </Button>
          
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || !isEditing || editedProblems.length === 0}
            size="sm"
            className="w-full sm:w-auto"
            variant="default"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            <span>저장하기</span>
          </Button>
        </div>
      </div>

      {editedProblems.map((problem, index) => {
        const editedData = problem;

        return (
          <Card key={problem.id} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  {isEditing ? (
                    <Select
                      value={editedData.mode}
                      onValueChange={(value: "read" | "listen") =>
                        handleModeChange(problem.id, value)
                      }
                    >
                      <SelectTrigger className="w-[140px] sm:w-[160px]">
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
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium flex items-center gap-1">
                      {editedData.mode === "read" ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          보고 말하기
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          듣고 말하기
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {!isEditing && (
                    <>
                      {(problem.sentence_audio_url || audioUrlMap[problem.problem_id]) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = problem.sentence_audio_url || audioUrlMap[problem.problem_id];
                            if (url) new Audio(url).play();
                          }}
                          className="text-muted-foreground hover:!bg-accent/30 hover:text-foreground"
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleRegenerateAudio(problem)}
                        disabled={regeneratingId === problem.id || deletingId === problem.id}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        {regeneratingId === problem.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        <span className="hidden sm:inline">음성 재생성</span>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(problem.id)}
                    disabled={deletingId === problem.id || regeneratingId === problem.id}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deletingId === problem.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 pb-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  문장
                </Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.sentence || ""}
                    onChange={(e) =>
                      handleUpdateProblem(problem.id, "sentence", e.target.value)
                    }
                    placeholder="말하기 연습할 문장을 입력하세요"
                    className="bg-muted/30 min-h-[80px]"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-lg">
                    {editedData.sentence}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  번역
                </Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.translation || ""}
                    onChange={(e) =>
                      handleUpdateProblem(problem.id, "translation", e.target.value)
                    }
                    placeholder="번역을 입력하세요"
                    className="bg-muted/30 min-h-[60px]"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm text-muted-foreground">
                    {editedData.translation || "(없음)"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-center mt-4">
        <Button
          variant="ghost"
          className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
          onClick={handleAddProblem}
        >
          <Plus className="w-4 h-4 mr-2" />
          문제 추가
        </Button>
      </div>

      {isEditing && (
        <div className="mt-4 flex justify-center">
          <Button onClick={handleSaveAll} disabled={isSaving || editedProblems.length === 0} size="lg">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            저장하기
          </Button>
        </div>
      )}
    </div>
  );
}
