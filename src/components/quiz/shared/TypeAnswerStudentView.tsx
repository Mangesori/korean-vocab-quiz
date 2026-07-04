import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TypeAnswerStudentItem {
  prompt: string;
}

/**
 * 단어 받아쓰기 학생 미리보기 — 실제 퀴즈(TypeAnswerStage)와 동일한 한 문제씩 캐러셀.
 * 입력칸은 비활성(disabled).
 */
export function TypeAnswerStudentView({ problems }: { problems: TypeAnswerStudentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const total = problems.length;

  useEffect(() => {
    if (previewIndex > total - 1) setPreviewIndex(Math.max(0, total - 1));
  }, [total, previewIndex]);

  const problem = problems[previewIndex];
  if (!problem) return null;

  return (
    <Card className="w-full max-w-5xl mx-auto sm:rounded-2xl">
      <CardContent className="p-4 sm:p-8 space-y-6">
        <p className="text-center text-sm sm:text-base lg:text-lg text-foreground font-bold">
          뜻을 보고 알맞은 한국어 단어를 입력하세요
        </p>

        <div className="p-6 sm:p-8 bg-slate-50 rounded-2xl text-center min-h-[110px] flex items-center justify-center">
          <p className="text-xl sm:text-2xl font-bold text-foreground break-keep">{problem.prompt}</p>
        </div>

        <Input
          disabled
          placeholder="정답 입력"
          className="h-14 text-center text-xl font-semibold rounded-2xl border-2 border-border bg-white opacity-70 placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/60"
        />

        <div className="flex justify-between items-center pt-2">
          <Button
            variant="outline"
            onClick={() => setPreviewIndex((p) => Math.max(0, p - 1))}
            disabled={previewIndex === 0}
            className="h-12 px-6 rounded-xl bg-white/50 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> 이전
          </Button>
          <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
          <Button
            onClick={() => setPreviewIndex((p) => Math.min(total - 1, p + 1))}
            disabled={previewIndex === total - 1}
            className="h-12 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
