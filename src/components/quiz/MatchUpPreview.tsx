import { useState } from "react";
import type { MatchupProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface MatchUpPreviewProps {
  problems: MatchupProblem[];
  studentPreview: boolean;
  updateMatchupProblem: (id: string, field: keyof MatchupProblem, value: string) => void;
  deleteMatchupProblem: (id: string) => void;
  addMatchupProblem: () => void;
}

export function MatchUpPreview({
  problems,
  studentPreview,
  updateMatchupProblem,
  deleteMatchupProblem,
  addMatchupProblem,
}: MatchUpPreviewProps) {
  // 학생 미리보기에서 보여줄 셔플된 뜻 (한 번만 셔플)
  const [shuffledMeanings] = useState(() => {
    const arr = problems.map((p) => p.meaning_text);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">매치업 단어 ↔ 뜻</h2>
        <p className="text-muted-foreground">
          학생들은 단어와 뜻을 연결합니다. 뜻은 AI가 자동 생성했으며 수정할 수 있습니다.
        </p>
      </div>

      {studentPreview ? (
        <Card className="w-full max-w-3xl mx-auto sm:rounded-2xl">
          <CardContent className="p-4 sm:p-8">
            <p className="text-center text-sm text-muted-foreground font-medium mb-5">단어와 뜻을 연결하세요</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="space-y-2.5">
                {problems.map((p) => (
                  <div
                    key={p.problem_id}
                    className="rounded-2xl border-2 border-border bg-white px-3 py-3 sm:px-4 sm:py-4 font-bold text-sm sm:text-lg text-foreground break-keep"
                  >
                    {p.korean_text}
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {shuffledMeanings.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border-2 border-border bg-white px-3 py-3 sm:px-4 sm:py-4 text-sm sm:text-base text-foreground break-keep"
                  >
                    {m}
                  </div>
                ))}
              </div>
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
                      onClick={() => deleteMatchupProblem(problem.problem_id)}
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
                      value={problem.korean_text}
                      onChange={(e) => updateMatchupProblem(problem.problem_id, "korean_text", e.target.value)}
                      placeholder="단어 입력"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">뜻</Label>
                    <Input
                      value={problem.meaning_text}
                      onChange={(e) => updateMatchupProblem(problem.problem_id, "meaning_text", e.target.value)}
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
              onClick={addMatchupProblem}
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
