import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { HintButton } from "@/components/quiz/shared/HintButton";

export interface SentenceMakingStudentItem {
  word: string;
  word_meaning?: string | null;
}

/**
 * 문장 만들기 학생 미리보기(한 단어씩 캐러셀).
 * QuizPreview·QuizDetail이 동일하게 사용한다.
 */
export function SentenceMakingStudentView({ problems }: { problems: SentenceMakingStudentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // 문제 수가 줄어드는 경우 인덱스 보정
  useEffect(() => {
    if (previewIndex > problems.length - 1) {
      setPreviewIndex(Math.max(0, problems.length - 1));
    }
  }, [problems.length, previewIndex]);

  const problem = problems[previewIndex];
  const total = problems.length;
  if (!problem) return null;

  return (
    <Card className="w-full max-w-5xl mx-auto border-0 sm:border shadow-none sm:shadow-sm rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-white mb-4 sm:mb-8 mt-4">
      <CardContent className="p-0 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
        <QuizStageHeader
          instruction="이 단어를 사용하여 문장을 만드세요"
          action={<HintButton active={showHint} onToggle={() => setShowHint(!showHint)} />}
        />

        {/* 제시 단어 — 회색 박스는 "이 문제의 재료"만 */}
        <div className="p-5 sm:p-10 bg-slate-50 border-none rounded-2xl flex flex-col items-center justify-center min-h-[180px] sm:min-h-[200px]">
          <Badge variant="outline" className="text-lg sm:text-xl lg:text-2xl px-6 py-2 sm:py-3 font-bold bg-white shadow-sm border-slate-200 rounded-2xl text-slate-800">
            {problem.word}
          </Badge>
          <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && problem.word_meaning ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {problem.word_meaning || ""}
          </p>
        </div>
        <div className="px-1">
          <Textarea
            disabled
            placeholder={`"${problem.word}"을(를) 사용하여 문장을 만드세요.`}
            className="min-h-[100px] text-md rounded-xl bg-slate-50 opacity-60"
          />
        </div>
        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            onClick={() => { setPreviewIndex((prev) => Math.max(0, prev - 1)); setShowHint(false); }}
            disabled={previewIndex === 0}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> 이전
          </Button>
          <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
          <Button
            onClick={() => { setPreviewIndex((prev) => Math.min(total - 1, prev + 1)); setShowHint(false); }}
            disabled={previewIndex === total - 1}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
