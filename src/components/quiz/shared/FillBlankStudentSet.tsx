import { Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volume2, Lightbulb, Info } from "lucide-react";
import { maskTranslation } from "@/utils/maskTranslation";
import { GrammarHintButton } from "@/components/quiz/shared/GrammarHintButton";
import { QuizStageHeader } from "@/components/quiz/shared/QuizStageHeader";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
        {/* 안내 + 예시 — 세트당 한 번만, 문항마다 반복 금지.
            흰 면 = 읽는 것(안내), 회색 박스 = 푸는 재료(보기).
            예시는 안내문구 끝("입력하세요") 바로 옆 정보 아이콘의 Popover로 옮겼다
            (FillBlankStage.tsx와 동일한 구조) — 항상 클릭으로만 열리고 바깥 클릭 시 닫힌다.
            트리거(아이콘)와 앵커(위치 기준)를 분리한다 — 트리거만 앵커로 쓰면 팝오버가
            아이콘 위치 기준으로 떠서 카드 중앙이 아니라 오른쪽으로 치우쳐 보인다.
            PopoverAnchor로 안내문구 wrapper 전체를 감싸 카드 콘텐츠 폭을 앵커로 삼는다. */}
        <Popover>
          <PopoverAnchor asChild>
            <div className="px-4 sm:px-8 pt-6 sm:pt-7 md:pt-8 pb-2 text-center">
              {/* md:pt-8(32px)로 다른 3개 유형의 데스크톱 상단 패딩과 맞춘다 */}
              <QuizStageHeader
                instruction={
                  <span className="inline-flex items-center gap-1">
                    빈칸에 알맞은 단어를 문법 형태와 함께 입력하세요
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="예제 보기"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                  </span>
                }
              />
            </div>
          </PopoverAnchor>
          <PopoverContent side="bottom" className="w-auto max-w-[90vw] sm:max-w-lg flex flex-wrap items-center justify-center gap-2 p-3">
            {/* 예시는 칩 2개로 감싼다 — 결합되는 문법 요소만 text-primary로 칠해
                "무엇이 결합되는지"를 색으로 말한다. 기본은 한 줄, 폭이 부족하면 줄바꿈 */}
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
              미술관
              <span className="text-slate-400">+</span>
              <span className="font-bold text-primary">에</span>
              <span className="mx-0.5 text-slate-400">→</span>
              <span className="font-bold text-foreground">미술관<span className="text-primary">에</span></span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
              가다
              <span className="text-slate-400">+</span>
              <span className="font-bold text-primary">-고 있다</span>
              <span className="text-slate-400">+</span>
              <span className="font-bold text-primary">아/어요</span>
              <span className="mx-0.5 text-slate-400">→</span>
              <span className="font-bold text-foreground">가<span className="text-primary">고 있어요</span></span>
            </span>
          </PopoverContent>
        </Popover>

        {/* 보기(단어 은행) — 회색 박스는 "이 문제의 재료"만. 칩은 흰색이라 배경 위에서 떠 보인다 */}
        <div className="mx-4 sm:mx-8 mb-2 rounded-2xl bg-slate-50 px-5 py-4 sm:py-5 flex flex-col items-center">
          <p className="mb-3 text-xs font-bold tracking-wide text-muted-foreground">보기</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full max-w-3xl">
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

        <div className="px-6 sm:px-8 pt-4 pb-6 sm:pb-8">
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
                <div key={problem.id} className="py-6 sm:py-5 first:pt-2 last:pb-2">
                  {/* 모바일 — 실제 학생 화면(FillBlankStage)과 동일한 순서:
                      번호+문장 → 입력칸+문법버튼 → 듣기/번역 → 번역 박스 */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <div className="flex gap-2">
                      <span className="text-primary font-bold text-base min-w-[20px]">{problemNumber}.</span>
                      <span className="text-base font-medium leading-relaxed text-foreground">
                        {parts[0]}
                        <span className="text-muted-foreground mx-1">( _____ )</span>
                        {parts[1]}
                      </span>
                    </div>
                    <div className="w-full space-y-2">
                      {/* 문법 버튼은 입력칸 "오른쪽" — 포커스 링은 이 래퍼가 focus-within으로
                          그린다(입력칸에 포커스가 가면 문법 버튼까지 하나의 링으로 감싸이게,
                          입력칸 자체 링은 꺼둠) */}
                      <div className="flex items-center rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <Input
                          readOnly
                          className={`h-11 flex-1 min-w-0 text-center text-sm border-border bg-slate-50 focus-visible:ring-0 focus-visible:ring-offset-0 ${problem.hint ? "rounded-l-xl rounded-r-none border-r-0" : "rounded-xl"}`}
                          placeholder="정답 입력"
                        />
                        {problem.hint && <GrammarHintButton hint={problem.hint} heightClass="h-11" />}
                      </div>
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canPlay}
                          onClick={() => canPlay && onPlayAudio!(audioUrl!)}
                          className="flex-1 h-10 rounded-xl text-muted-foreground font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                        >
                          <Volume2 className="w-4 h-4 mr-2" /> 듣기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleTranslation(problem.id)}
                          className={`flex-1 h-10 rounded-xl font-medium transition-all ${showTranslations[problem.id] ? "bg-warning/10 text-warning border-warning/30" : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"}`}
                        >
                          <Lightbulb className={`w-4 h-4 mr-2 ${showTranslations[problem.id] ? "text-warning" : ""}`} /> 번역
                        </Button>
                      </div>
                    </div>
                    {showTranslations[problem.id] && problem.translation && (
                      <div className="mt-3 px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
                        {maskTranslation(problem.translation)}
                      </div>
                    )}
                  </div>

                  {/* 데스크톱 */}
                  <div className="hidden sm:block">
                    {/* 문법 버튼이 입력칸 오른쪽 인라인이라 행이 1단 — 단순 수직 중앙 정렬로 충분하다.
                        문장을 flex가 아니라 일반 인라인 흐름(p)으로 둔다 — flex-wrap은 각 span을
                        "덩어리" 단위로 통째로 다음 줄에 내려버려서, 입력칸 뒤에 붙는 짧은 구절도
                        자리가 남아도 무조건 줄바꿈됐다. 일반 텍스트 흐름이어야 단어 단위로 줄바꿈된다. */}
                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-lg leading-relaxed">
                        <span className="text-primary font-bold">{problemNumber}.</span>{" "}
                        {parts.map((part, partIdx, arr) => (
                          <Fragment key={partIdx}>
                            <span className="font-medium text-foreground">{part?.trim()}</span>
                            {/* 입력칸+문법 버튼은 한 덩어리 — 줄바꿈 시 둘이 갈라지지 않게 묶는다.
                                포커스 링은 이 래퍼가 focus-within으로 그린다(입력칸 자체 링은 꺼둠) */}
                            {partIdx < arr.length - 1 && (
                              <>
                                {" "}
                                <span className="inline-flex items-center align-middle mx-1 rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                                  <Input
                                    readOnly
                                    className={`w-48 h-10 text-center text-base border-border bg-slate-50 focus-visible:ring-0 focus-visible:ring-offset-0 ${problem.hint ? "rounded-l-xl rounded-r-none border-r-0" : "rounded-xl"}`}
                                    placeholder="정답 입력"
                                  />
                                  {problem.hint && <GrammarHintButton hint={problem.hint} />}
                                </span>{" "}
                              </>
                            )}
                          </Fragment>
                        ))}
                      </p>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 rounded-xl text-sm text-muted-foreground font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                          disabled={!canPlay}
                          onClick={() => canPlay && onPlayAudio!(audioUrl!)}
                        >
                          <Volume2 className="w-4 h-4 mr-1.5" />
                          듣기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleTranslation(problem.id)}
                          className={`h-9 px-3 rounded-xl text-sm font-medium transition-all ${showTranslations[problem.id] ? "bg-warning/10 text-warning border-warning/30" : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"}`}
                        >
                          <Lightbulb className={`w-4 h-4 mr-1.5 ${showTranslations[problem.id] ? "text-warning" : ""}`} />
                          번역
                        </Button>
                      </div>
                    </div>
                    {showTranslations[problem.id] && problem.translation && (
                      <div className="mt-4 ml-8 px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
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
