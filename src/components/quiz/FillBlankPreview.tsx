import type { Problem } from "@/types/quiz";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2, Volume2, Lightbulb, Plus } from "lucide-react";
import { maskTranslation } from "@/utils/maskTranslation";

interface FillBlankPreviewProps {
  problemSets: Problem[][];
  wordsPerSet: number;
  studentPreview: boolean;
  showTranslations: Record<string, boolean>;
  setShowTranslations: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  regeneratingId: string | null;
  langLabel: string;
  updateProblem: (id: string, field: keyof Problem, value: string) => void;
  regenerateProblem: (problem: Problem) => void;
  addFillBlankProblem: () => void;
}

export function FillBlankPreview({
  problemSets,
  wordsPerSet,
  studentPreview,
  showTranslations,
  setShowTranslations,
  regeneratingId,
  langLabel,
  updateProblem,
  regenerateProblem,
  addFillBlankProblem,
}: FillBlankPreviewProps) {
  return (
    <>
      {problemSets.map((set, setIndex) => (
        <div key={setIndex} className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
              세트 {setIndex + 1}
            </span>
          </div>

          {studentPreview ? (
            <Card className="shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 sm:mb-6">
                  <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {set.map((problem) => (
                      <span
                        key={problem.id}
                        className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium"
                      >
                        {problem.word}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-0 divide-y">
                  {set.map((problem, problemIndex) => {
                    const problemNumber = setIndex * wordsPerSet + problemIndex + 1;
                    let sentence = problem.sentence;
                    sentence = sentence.replace(/([.?!])\s*\.+\s*$/, "$1");
                    sentence = sentence.replace(/\.\s*\.$/, ".");
                    const parts = sentence.split(/\(\s*\)|\(\)/);

                    return (
                      <div key={problem.id} className="py-4">
                        <div className="flex flex-col gap-2 sm:hidden">
                          <div className="flex items-start gap-2">
                            <span className="text-primary font-bold">{problemNumber}.</span>
                            <div className="flex-1">
                              <p className="text-base leading-relaxed">
                                {parts[0]}
                                <span className="text-muted-foreground">( _____ )</span>
                                {problem.hint && <span className="text-primary text-sm ml-1">{problem.hint}</span>}
                                {parts[1]}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>
                                <Volume2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setShowTranslations((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                              >
                                <Lightbulb className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {showTranslations[problem.id] && problem.translation && (
                            <div className="mt-2 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                              {maskTranslation(problem.translation)}
                            </div>
                          )}
                          <Input readOnly className="h-10 text-center bg-muted/30" placeholder="정답 입력" />
                        </div>

                        <div className="hidden sm:block">
                          <div className="flex items-center gap-3">
                            <span className="text-primary font-bold min-w-[24px]">{problemNumber}.</span>
                            <div className="flex-1 flex items-center flex-wrap gap-1">
                              {parts.map((part, partIdx, arr) => (
                                <span key={partIdx} className="inline-flex items-center">
                                  <span className="text-base whitespace-nowrap">{part}</span>
                                  {partIdx < arr.length - 1 && (
                                    <>
                                      <Input
                                        readOnly
                                        className="w-48 h-8 mx-1 text-center text-sm inline-block bg-muted/30"
                                        placeholder="정답 입력"
                                      />
                                      {problem.hint && <span className="text-primary text-sm">{problem.hint}</span>}
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button variant="outline" size="sm" disabled>
                                <Volume2 className="w-4 h-4 mr-1" />
                                듣기
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowTranslations((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                              >
                                <Lightbulb className="w-4 h-4 mr-1" />
                                힌트
                              </Button>
                            </div>
                          </div>
                          {showTranslations[problem.id] && problem.translation && (
                            <div className="mt-2 ml-8 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                              {maskTranslation(problem.translation)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {set.map((problem, problemIndex) => (
                <Card key={problem.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="py-3 px-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {setIndex * wordsPerSet + problemIndex + 1}
                        </span>
                        <Input
                          value={problem.word}
                          onChange={(e) => updateProblem(problem.id, "word", e.target.value)}
                          className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-center w-auto min-w-[80px] max-w-[200px] h-8 text-sm border-primary/30"
                        />
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => regenerateProblem(problem)}
                        disabled={regeneratingId === problem.id}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {regeneratingId === problem.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        <span className="hidden sm:inline">문제 재생성</span>
                        <span className="sm:hidden">재생성</span>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 pb-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">문장</Label>
                      <p className="text-lg px-3 py-2 rounded-md bg-muted/30">
                        {problem.sentence.split(/\(\s*\)|\(\)/).map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span className="text-primary font-bold">{problem.answer}</span>
                            )}
                          </span>
                        ))}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">출제 문장</Label>
                      <Input
                        value={problem.sentence}
                        onChange={(e) => updateProblem(problem.id, "sentence", e.target.value)}
                        className="text-sm sm:text-lg bg-muted/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">정답</Label>
                        <Input
                          value={problem.answer}
                          onChange={(e) => updateProblem(problem.id, "answer", e.target.value)}
                          className="bg-muted/30 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">힌트</Label>
                        <Input
                          value={problem.hint}
                          onChange={(e) => updateProblem(problem.id, "hint", e.target.value)}
                          className="bg-muted/30 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        번역({langLabel})
                      </Label>
                      <Textarea
                        value={problem.translation}
                        onChange={(e) => updateProblem(problem.id, "translation", e.target.value)}
                        className="bg-muted/30 min-h-[60px] text-sm"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
      {!studentPreview && (
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
            onClick={addFillBlankProblem}
          >
            <Plus className="w-4 h-4 mr-2" />
            문제 추가
          </Button>
        </div>
      )}
    </>
  );
}
