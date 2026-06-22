import type { TypeAnswerProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface TypeAnswerPreviewProps {
  problems: TypeAnswerProblem[];
  studentPreview: boolean;
  updateTypeAnswerProblem: (id: string, field: keyof TypeAnswerProblem, value: string) => void;
  deleteTypeAnswerProblem: (id: string) => void;
  addTypeAnswerProblem: () => void;
}

export function TypeAnswerPreview({
  problems,
  studentPreview,
  updateTypeAnswerProblem,
  deleteTypeAnswerProblem,
  addTypeAnswerProblem,
}: TypeAnswerPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">답 입력 (뜻 → 한국어)</h2>
        <p className="text-muted-foreground">
          학생들은 뜻을 보고 한국어 단어를 직접 입력합니다. 정답은 학생에게 표시되지 않습니다.
        </p>
      </div>

      {studentPreview ? (
        <Card className="w-full max-w-3xl mx-auto sm:rounded-2xl">
          <CardContent className="p-4 sm:p-8 space-y-3">
            <p className="text-center text-sm text-muted-foreground font-medium mb-2">
              뜻을 보고 알맞은 한국어 단어를 입력하세요
            </p>
            {problems.map((p, idx) => (
              <div
                key={p.problem_id}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-white px-3 py-3 sm:px-4 sm:py-3.5"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm sm:text-base text-foreground break-keep">{p.prompt}</span>
                <Input disabled placeholder="한국어 단어" className="w-32 sm:w-44 rounded-xl opacity-60" />
              </div>
            ))}
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
                      onClick={() => deleteTypeAnswerProblem(problem.problem_id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">뜻 (문제)</Label>
                    <Input
                      value={problem.prompt}
                      onChange={(e) => updateTypeAnswerProblem(problem.problem_id, "prompt", e.target.value)}
                      placeholder="뜻 입력"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">정답 (한국어 단어)</Label>
                    <Input
                      value={problem.answer}
                      onChange={(e) => updateTypeAnswerProblem(problem.problem_id, "answer", e.target.value)}
                      placeholder="한국어 단어"
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
              onClick={addTypeAnswerProblem}
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
