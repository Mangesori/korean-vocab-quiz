import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronLeft, ChevronRight, Mic } from "lucide-react";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { HintButton } from "@/components/quiz/shared/HintButton";

export interface RecordingStudentItem {
  sentence: string;
  mode: "read" | "listen";
  translation?: string | null;
}

/**
 * 말하기 연습 학생 미리보기(한 문장씩 캐러셀, 읽기/듣기 모드 분기, 비활성 마이크).
 * QuizPreview·QuizDetail이 동일하게 사용한다(QuizDetail에는 새로 추가됨).
 * 미리보기 단계에서는 음성을 생성하지 않으므로 듣기/마이크는 항상 비활성.
 */
export function RecordingStudentView({ problems }: { problems: RecordingStudentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

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
          badge={
            <span className="text-xs sm:text-sm font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-3 py-1.5 rounded-full inline-flex items-center">
              {problem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
            </span>
          }
          instruction={
            problem.mode === "read"
              ? "문장을 보고 따라 말해보세요"
              : "음성을 듣고 따라 녹음하세요"
          }
          action={<HintButton active={showHint} onToggle={() => setShowHint(!showHint)} />}
        />

        {/* 문장 표시 — 회색 박스는 "읽을/들을 재료"만 */}
        <div className="p-5 sm:p-10 bg-slate-50 border-none rounded-2xl flex flex-col min-h-[180px] sm:min-h-[210px]">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {problem.mode === "read" ? (
              <>
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-4 text-foreground leading-relaxed text-center drop-shadow-sm">
                  {problem.sentence}
                </h3>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6">
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
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <Button size="lg" disabled className="rounded-full w-20 h-20 opacity-40">
              <Mic className="w-8 h-8" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">학생 퀴즈 화면에서 녹음 가능</p>
        </div>
        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            onClick={() => { setPreviewIndex((prev) => Math.max(0, prev - 1)); setShowHint(false); }}
            disabled={previewIndex === 0}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> 이전
          </Button>
          <span className="text-sm text-muted-foreground">{previewIndex + 1} / {total}</span>
          <Button
            onClick={() => { setPreviewIndex((prev) => Math.min(total - 1, prev + 1)); setShowHint(false); }}
            disabled={previewIndex === total - 1}
            className="h-9 sm:h-12 px-4 sm:px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-md transition-colors"
          >
            다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
