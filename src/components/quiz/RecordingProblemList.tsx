import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Save, Loader2, Trash2, Volume2, Eye, EyeOff, Plus } from "lucide-react";
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
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  const handleUpdateProblem = (id: string, field: keyof RecordingProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
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
              translation: problem.translation || null,
              source_type: (problem.source_type || 'teacher_input') as "reuse" | "ai_generated" | "teacher_input"
            });
          } else {
            return supabase
              .from("recording_problems")
              .update({
                sentence: problem.sentence,
                mode: problem.mode,
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

  const handleDelete = async (problemId: string) => {
    if (!confirm("이 문제를 삭제하시겠습니까?")) return;

    setDeletingId(problemId);
    try {
      const { error } = await supabase
        .from("recording_problems")
        .delete()
        .eq("id", problemId);

      if (error) throw error;

      toast.success("문제가 삭제되었습니다");
      onRefresh();
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
        <div className="mt-4">
          <Button variant="outline" onClick={handleAddProblem}>
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

      {problems.map((problem, index) => {
        const editedData = editedProblems.find((p) => p.id === problem.id) || problem;

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
                        handleUpdateProblem(problem.id, "mode", value)
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
                <div className="flex gap-2">
                  {!isEditing && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(problem.id)}
                        disabled={deletingId === problem.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingId === problem.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
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

              {problem.sentence_audio_url && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    음성
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const audio = new Audio(problem.sentence_audio_url!);
                      audio.play();
                    }}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    듣기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button
        variant="outline"
        className="w-full h-12 border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors mt-4"
        onClick={handleAddProblem}
      >
        <Plus className="w-5 h-5 mr-2" />
        문제 추가하기
      </Button>
    </div>
  );
}
