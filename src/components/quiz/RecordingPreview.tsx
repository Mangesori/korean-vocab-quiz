import type { RecordingProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, RefreshCw, Trash2, Plus } from "lucide-react";
import { RecordingStudentView } from "@/components/quiz/shared/RecordingStudentView";

interface RecordingPreviewProps {
  problems: RecordingProblem[];
  studentPreview: boolean;
  updateRecordingProblem: (id: string, field: keyof RecordingProblem, value: string) => void;
  deleteRecordingProblem: (id: string) => void;
  regenerateRecordingProblem: (id: string, index: number) => void;
  addRecordingProblem: () => void;
  /** problem_id → 출처 단어(빈칸 문제). 헤더 읽기전용 라벨용. */
  sourceWords?: Record<string, string>;
}

export function RecordingPreview({
  problems,
  studentPreview,
  updateRecordingProblem,
  deleteRecordingProblem,
  regenerateRecordingProblem,
  addRecordingProblem,
  sourceWords,
}: RecordingPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">말하기 연습 문제 목록</h2>
        <p className="text-muted-foreground">
          학생들은 각 문장을 보고 듣고 말해야 합니다. (저장 후 상세 편집 가능)
        </p>
      </div>

      {studentPreview ? (
        <RecordingStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          {problems.map((problem, index) => (
            <Card key={problem.problem_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="py-3 px-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    {sourceWords?.[problem.problem_id] && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold truncate hidden sm:inline-block">
                        {sourceWords[problem.problem_id]}
                      </span>
                    )}
                    <Select
                      value={problem.mode}
                      onValueChange={(value: "read" | "listen") =>
                        updateRecordingProblem(problem.problem_id, "mode", value)
                      }
                    >
                      <SelectTrigger className="w-[160px]">
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
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => regenerateRecordingProblem(problem.problem_id, index)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">문제 재생성</span>
                      <span className="sm:hidden">재생성</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRecordingProblem(problem.problem_id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 pb-5 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">문장</Label>
                  <Textarea
                    value={problem.sentence}
                    onChange={(e) => updateRecordingProblem(problem.problem_id, "sentence", e.target.value)}
                    placeholder="말하기 연습할 문장 입력"
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">번역</Label>
                  <Textarea
                    value={problem.translation || ""}
                    onChange={(e) => updateRecordingProblem(problem.problem_id, "translation", e.target.value)}
                    placeholder="번역 입력 (선택)"
                    className="mt-1 min-h-[60px]"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addRecordingProblem}
            >
              <Plus className="w-4 h-4 mr-2" />
              문장 추가하기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
