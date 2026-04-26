import type { SentenceMakingProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface SentenceMakingPreviewProps {
  problems: SentenceMakingProblem[];
  studentPreview: boolean;
  updateSentenceMakingProblem: (id: string, field: keyof SentenceMakingProblem, value: string) => void;
  deleteSentenceMakingProblem: (id: string) => void;
  addSentenceMakingProblem: () => void;
}

export function SentenceMakingPreview({
  problems,
  studentPreview,
  updateSentenceMakingProblem,
  deleteSentenceMakingProblem,
  addSentenceMakingProblem,
}: SentenceMakingPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">문장 만들기 단어 목록</h2>
        <p className="text-muted-foreground">
          학생들은 각 단어를 사용하여 문장을 만들어야 합니다. (저장 후 QuizDetail에서 상세 편집 가능)
        </p>
      </div>

      {studentPreview ? (
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {problems.map((problem, index) => (
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {problems.map((problem, index) => (
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
  );
}
