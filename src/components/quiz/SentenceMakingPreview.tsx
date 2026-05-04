import { useState } from "react";
import type { SentenceMakingProblem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">문장 만들기 단어 목록</h2>
        <p className="text-muted-foreground">
          학생들은 각 단어를 사용하여 문장을 만들어야 합니다. (저장 후 QuizDetail에서 상세 편집 가능)
        </p>
      </div>

      {studentPreview ? (
        (() => {
          const problem = problems[previewIndex];
          const total = problems.length;
          if (!problem) return null;
          return (
            <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white mb-4 sm:mb-8">
              <CardContent className="p-0 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
                <div className="p-5 sm:p-10 bg-transparent sm:bg-slate-50 border-none rounded-2xl flex flex-col min-h-[220px] sm:min-h-[250px]">
                  <div className="flex w-full items-center justify-end mb-2 sm:mb-3">
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
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium mb-3 sm:mb-5 text-center">
                      이 단어를 사용하여 문장을 만드세요
                    </p>
                    <Badge variant="outline" className="text-lg sm:text-xl lg:text-2xl px-6 py-2 sm:py-3 font-bold bg-white shadow-sm border-slate-200 rounded-2xl text-slate-800">
                      {problem.word}
                    </Badge>
                    <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && problem.word_meaning ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                      {problem.word_meaning || ""}
                    </p>
                  </div>
                </div>
                <div className="px-1">
                  <Textarea
                    disabled
                    placeholder={`"${problem.word}"을(를) 사용하여 문장을 작성하세요...`}
                    className="min-h-[100px] text-md rounded-xl border-slate-200 opacity-60"
                  />
                </div>
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => { setPreviewIndex(prev => Math.max(0, prev - 1)); setShowHint(false); }}
                    disabled={previewIndex === 0}
                    className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" /> 이전
                  </Button>
                  <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
                  <Button
                    onClick={() => { setPreviewIndex(prev => Math.min(total - 1, prev + 1)); setShowHint(false); }}
                    disabled={previewIndex === total - 1}
                    className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
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
