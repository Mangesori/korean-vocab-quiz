import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Save, X, Loader2, Trash2, Volume2, Eye, EyeOff } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<RecordingProblem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (problem: RecordingProblem) => {
    setEditingId(problem.id);
    setEditData({
      sentence: problem.sentence,
      mode: problem.mode,
      translation: problem.translation || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (problemId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("recording_problems")
        .update({
          sentence: editData.sentence,
          mode: editData.mode,
          translation: editData.translation || null,
        })
        .eq("id", problemId);

      if (error) throw error;

      toast.success("문제가 저장되었습니다");
      setEditingId(null);
      setEditData({});
      onRefresh();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "저장에 실패했습니다");
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

  if (problems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        녹음 문제가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">녹음 문제</h2>
        <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium">
          {problems.length}개
        </span>
      </div>

      {problems.map((problem, index) => {
        const isEditing = editingId === problem.id;

        return (
          <Card key={problem.id} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium flex items-center gap-1">
                    {problem.mode === "read" ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        보고 읽기
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        듣고 말하기
                      </>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 mr-1" />
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(problem.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        저장
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(problem)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        수정
                      </Button>
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
                    value={editData.sentence || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, sentence: e.target.value })
                    }
                    placeholder="녹음할 문장을 입력하세요"
                    className="bg-muted/30 min-h-[80px]"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-lg">
                    {problem.sentence}
                  </p>
                )}
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    모드
                  </Label>
                  <Select
                    value={editData.mode}
                    onValueChange={(value: "read" | "listen") =>
                      setEditData({ ...editData, mode: value })
                    }
                  >
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">보고 읽기</SelectItem>
                      <SelectItem value="listen">듣고 말하기</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  번역
                </Label>
                {isEditing ? (
                  <Textarea
                    value={editData.translation || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, translation: e.target.value })
                    }
                    placeholder="번역을 입력하세요"
                    className="bg-muted/30 min-h-[60px]"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm text-muted-foreground">
                    {problem.translation || "(없음)"}
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
    </div>
  );
}
