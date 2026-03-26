import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit2, Save, X, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SentenceMakingProblem {
  id: string;
  quiz_id: string;
  problem_id: string;
  word: string;
  word_meaning: string | null;
  model_answer: string;
  created_at: string;
}

interface SentenceMakingProblemListProps {
  problems: SentenceMakingProblem[];
  onRefresh: () => void;
}

export function SentenceMakingProblemList({
  problems,
  onRefresh,
}: SentenceMakingProblemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SentenceMakingProblem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (problem: SentenceMakingProblem) => {
    setEditingId(problem.id);
    setEditData({
      word_meaning: problem.word_meaning || "",
      model_answer: problem.model_answer,
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
        .from("sentence_making_problems")
        .update({
          word_meaning: editData.word_meaning || null,
          model_answer: editData.model_answer,
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
        .from("sentence_making_problems")
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
        문장 만들기 문제가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">문장 만들기 문제</h2>
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
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                    {problem.word}
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
                  단어 뜻
                </Label>
                {isEditing ? (
                  <Input
                    value={editData.word_meaning || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, word_meaning: e.target.value })
                    }
                    placeholder="단어의 뜻을 입력하세요"
                    className="bg-muted/30"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">
                    {problem.word_meaning || "(없음)"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  모범 답안
                </Label>
                {isEditing ? (
                  <Textarea
                    value={editData.model_answer || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, model_answer: e.target.value })
                    }
                    placeholder="모범 답안을 입력하세요"
                    className="bg-muted/30 min-h-[80px]"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30">
                    {problem.model_answer}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
