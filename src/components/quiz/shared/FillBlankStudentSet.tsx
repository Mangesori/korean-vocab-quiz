import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volume2, Lightbulb } from "lucide-react";
import { maskTranslation } from "@/utils/maskTranslation";

export interface FillBlankStudentProblem {
  id: string;
  word: string;
  sentence: string;
  hint: string;
  translation: string;
}

interface FillBlankStudentSetProps {
  set: FillBlankStudentProblem[];
  /** 세트 첫 문제의 전역 번호(1-base) */
  startNumber: number;
  showTranslations: Record<string, boolean>;
  onToggleTranslation: (id: string) => void;
  /** 있으면 듣기 버튼 활성(QuizDetail), 없으면 비활성(QuizPreview 드래프트) */
  audioUrls?: Record<string, string>;
  onPlayAudio?: (url: string) => void;
}

/**
 * 빈칸 채우기 학생 미리보기 — 한 세트(보기 단어은행 + 문장들).
 * QuizPreview(FillBlankPreview)·QuizDetail(FillBlankProblemList)이 동일하게 사용한다.
 * 오디오는 옵션: QuizPreview는 전달하지 않아 듣기 버튼이 비활성, QuizDetail은 전달해 재생.
 */
export function FillBlankStudentSet({
  set,
  startNumber,
  showTranslations,
  onToggleTranslation,
  audioUrls,
  onPlayAudio,
}: FillBlankStudentSetProps) {
  return (
    <Card className="max-w-5xl mx-auto border shadow-sm rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-0">
        <p className="text-center text-sm sm:text-base lg:text-lg text-foreground font-bold bg-[#F1ECE4] px-6 pt-5 pb-3">
          빈칸에 알맞은 단어를 입력하세요
        </p>
        {/* 보기(단어 은행) */}
        <div className="bg-[#F1ECE4] border-b border-[#D3CCC4] px-6 pb-5 flex flex-col items-center">
          <p className="text-sm font-bold text-muted-foreground mb-4">보기</p>
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
            {set.map((problem) => (
              <span
                key={problem.id}
                className="px-4 py-1.5 rounded-full text-sm font-medium bg-white border border-border text-foreground shadow-sm"
              >
                {problem.word}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="space-y-0 divide-y">
            {set.map((problem, problemIndex) => {
              const problemNumber = startNumber + problemIndex;
              let sentence = problem.sentence;
              sentence = sentence.replace(/([.?!])\s*\.+\s*$/, "$1");
              sentence = sentence.replace(/\.\s*\.$/, ".");
              const parts = sentence.split(/\(\s*\)|\(\)/);
              const audioUrl = audioUrls?.[problem.id];
              const canPlay = !!audioUrl && !!onPlayAudio;

              return (
                <div key={problem.id} className="py-4">
                  {/* 모바일 */}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-primary"
                          disabled={!canPlay}
                          onClick={() => canPlay && onPlayAudio!(audioUrl!)}
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => onToggleTranslation(problem.id)}
                        >
                          <Lightbulb className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {showTranslations[problem.id] && problem.translation && (
                      <div className="mt-2 px-3 py-2 bg-accent rounded-lg text-sm border border-primary/15 text-foreground">
                        {maskTranslation(problem.translation)}
                      </div>
                    )}
                    <Input readOnly className="h-10 text-center bg-muted" placeholder="정답 입력" />
                  </div>

                  {/* 데스크톱 */}
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-bold text-lg min-w-[24px]">{problemNumber}.</span>
                      <div className="flex-1 flex items-center flex-wrap gap-1">
                        {parts.map((part, partIdx, arr) => (
                          <span key={partIdx} className="inline-flex items-center">
                            <span className="text-lg font-medium text-slate-800 whitespace-nowrap">{part}</span>
                            {partIdx < arr.length - 1 && (
                              <>
                                <Input
                                  readOnly
                                  className="w-48 h-10 mx-1 text-center text-base inline-block bg-muted"
                                  placeholder="정답 입력"
                                />
                                {problem.hint && <span className="text-primary text-sm">{problem.hint}</span>}
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary"
                          disabled={!canPlay}
                          onClick={() => canPlay && onPlayAudio!(audioUrl!)}
                        >
                          <Volume2 className="w-4 h-4 mr-1" />
                          듣기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleTranslation(problem.id)}
                        >
                          <Lightbulb className="w-4 h-4 mr-1" />
                          힌트
                        </Button>
                      </div>
                    </div>
                    {showTranslations[problem.id] && problem.translation && (
                      <div className="mt-2 ml-8 px-3 py-2 bg-accent rounded-lg text-sm border border-primary/15 text-foreground">
                        {maskTranslation(problem.translation)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
