import { useState } from "react";
import type { RecordingProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, RefreshCw, Trash2, Plus, Volume2, Lightbulb, ChevronLeft, ChevronRight, Mic } from "lucide-react";

interface RecordingPreviewProps {
  problems: RecordingProblem[];
  studentPreview: boolean;
  updateRecordingProblem: (id: string, field: keyof RecordingProblem, value: string) => void;
  deleteRecordingProblem: (id: string) => void;
  regenerateRecordingProblem: (id: string, index: number) => void;
  addRecordingProblem: () => void;
}

export function RecordingPreview({
  problems,
  studentPreview,
  updateRecordingProblem,
  deleteRecordingProblem,
  regenerateRecordingProblem,
  addRecordingProblem,
}: RecordingPreviewProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">말하기 연습 문제 목록</h2>
        <p className="text-muted-foreground">
          학생들은 각 문장을 보고 듣고 말해야 합니다. (저장 후 QuizDetail에서 상세 편집 가능)
        </p>
      </div>

      {studentPreview ? (
        (() => {
          const problem = problems[previewIndex];
          const total = problems.length;
          if (!problem) return null;
          return (
            <Card className="w-full max-w-5xl mx-auto border shadow-sm rounded-2xl overflow-hidden bg-white mb-4 sm:mb-6">
              <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                <div className="p-5 sm:p-10 bg-slate-50 border-none rounded-2xl flex flex-col min-h-[220px] sm:min-h-[250px]">
                  <div className="flex w-full items-center justify-between mb-6 sm:mb-8">
                    <div className="text-xs sm:text-sm font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-3 py-1.5 rounded-full inline-flex items-center">
                      {problem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHint(!showHint)}
                      className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
                    >
                      <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${showHint ? "text-warning" : ""}`} />
                      힌트
                    </Button>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {problem.mode === "read" ? (
                      <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-foreground leading-relaxed text-center drop-shadow-sm">
                        {problem.sentence}
                      </h3>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6">
                        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium mb-2">음성을 듣고 따라 녹음하세요</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            disabled
                            className="flex items-center justify-center rounded-xl px-3 sm:px-5 h-9 sm:h-11 bg-white shadow-sm text-xs sm:text-sm opacity-50"
                          >
                            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                            <span className="font-semibold hidden sm:inline">보통 속도로 듣기</span>
                            <span className="font-semibold sm:hidden">보통</span>
                          </Button>
                          <Button
                            variant="outline"
                            disabled
                            className="flex items-center justify-center rounded-xl px-3 sm:px-5 h-9 sm:h-11 bg-white shadow-sm text-xs sm:text-sm opacity-50"
                          >
                            <span className="mr-2 text-xl relative -top-0.5">🐢</span>
                            <span className="font-semibold hidden sm:inline">천천히 듣기</span>
                            <span className="font-semibold sm:hidden">천천히</span>
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">(저장 후 음성이 생성됩니다)</p>
                      </div>
                    )}
                    <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && problem.translation ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                      {problem.translation || ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    disabled
                    className="rounded-full w-20 h-20 opacity-40"
                  >
                    <Mic className="w-8 h-8" />
                  </Button>
                  <p className="text-xs text-muted-foreground">학생 퀴즈 화면에서 녹음 가능</p>
                </div>
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => { setPreviewIndex(prev => Math.max(0, prev - 1)); setShowHint(false); }}
                    disabled={previewIndex === 0}
                    className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" /> 이전
                  </Button>
                  <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
                  <Button
                    onClick={() => { setPreviewIndex(prev => Math.min(total - 1, prev + 1)); setShowHint(false); }}
                    disabled={previewIndex === total - 1}
                    className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
                  >
                    다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()
      ) : (
        <div className="space-y-4">
          {problems.map((problem, index) => (
            <Card key={problem.problem_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="py-3 px-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {index + 1}
                    </span>
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
              문제 추가하기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
