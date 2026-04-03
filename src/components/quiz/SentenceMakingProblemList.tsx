import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Save, Loader2, Trash2, Plus } from "lucide-react";
import { useParams } from "react-router-dom";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedProblems, setEditedProblems] = useState<SentenceMakingProblem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { id: quizId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!isEditing) {
      setEditedProblems(problems);
    }
  }, [problems, isEditing]);

  const handleUpdateProblem = (id: string, field: keyof SentenceMakingProblem, value: string) => {
    setEditedProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleAddProblem = () => {
    const newId = `temp-${crypto.randomUUID()}`;
    const newProblem: SentenceMakingProblem = {
      id: newId,
      quiz_id: quizId || '',
      problem_id: `sm-${crypto.randomUUID().slice(0, 8)}`,
      word: '',
      word_meaning: '',
      model_answer: '',
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
            return supabase.from("sentence_making_problems").insert({
              quiz_id: problem.quiz_id,
              problem_id: problem.problem_id,
              word: problem.word,
              word_meaning: problem.word_meaning || null,
              model_answer: problem.model_answer,
            });
          } else {
            return supabase
              .from("sentence_making_problems")
              .update({
                word: problem.word,
                word_meaning: problem.word_meaning || null,
                model_answer: problem.model_answer,
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

  if (problems.length === 0 && editedProblems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        문장 만들기 문제가 없습니다.
        <div className="mt-4">
          <Button variant="outline" onClick={handleAddProblem}>
            <Plus className="w-4 h-4 mr-2" />
            단어 추가하기
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
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                    {problem.word}
                  </span>
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
                  단어 뜻
                </Label>
                {isEditing ? (
                  <Input
                    value={editedData.word_meaning || ""}
                    onChange={(e) =>
                      handleUpdateProblem(problem.id, "word_meaning", e.target.value)
                    }
                    placeholder="단어의 뜻을 입력하세요"
                    className="bg-muted/30"
                  />
                ) : (
                  <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">
                    {editedData.word_meaning || "(없음)"}
                  </p>
                )}
              </div>

            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          className="h-10 px-6 border-dashed text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
          onClick={handleAddProblem}
        >
          <Plus className="w-4 h-4 mr-2" />
          단어 추가하기
        </Button>
      </div>
    </div>
  );
}
