import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import type { WordMagnetGradeResult } from "@/components/quiz/WordMagnetResultStage";
import { unmaskTranslation } from "@/utils/maskTranslation";

interface WordMagnetResultCardProps {
  result: WordMagnetGradeResult;
  index: number;
  /** 오답 시 학생 답변 행의 라벨. 기본 "내 답변"(학생 화면). 교사 모달에선 "학생 답변". */
  answerLabel?: string;
}

/**
 * 문장 순서 맞추기 결과 카드 — WordPairResultCard와 동일한 패턴으로 통일:
 * 번호 배지(정답=success/오답=destructive) + 영문 번역 배지 + 우측 상태 아이콘,
 * 아래 '내 답변 / 정답' 라벨 행. WordMagnetResultStage와 결과 페이지들이 공유한다.
 */
export function WordMagnetResultCard({ result: r, index, answerLabel = "내 답변" }: WordMagnetResultCardProps) {
  // 채점은 공백을 무시하므로 같은 기준으로 비교해야 띄어쓰기 차이를 다른 어순으로 오인하지 않는다.
  const strip = (s: string) => s.replace(/\s+/g, "");
  const isAlternateOrder =
    r.isCorrect && !!r.userSentence && strip(r.userSentence) !== strip(r.correctSentence);

  return (
    <Card className="overflow-hidden border bg-white rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0 ${
                r.skipped ? "bg-muted-foreground" : r.isCorrect ? "bg-success" : "bg-destructive"
              }`}
            >
              {index + 1}
            </span>
            <span className="text-base font-semibold text-[#6B6460] bg-[#FAF8F5] border border-[#EBE5DE] px-3 py-1 rounded-md break-keep">
              {unmaskTranslation(r.translation)}
            </span>
          </div>
          {r.skipped ? (
            <HelpCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          ) : r.isCorrect ? (
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
        </div>

        {r.skipped ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-muted text-muted-foreground">
                모름
              </span>
              <p className="text-lg font-bold leading-relaxed text-muted-foreground break-keep">
                문제를 건너뛰었어요
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">{r.correctSentence}</p>
            </div>
          </div>
        ) : r.isCorrect ? (
          /* 허용 어순으로 맞힌 경우 학생이 쓴 문장과 base_text가 다르다.
             그때 base_text를 "정답"이라고 내보이면 자기가 쓴 것과 달라 혼란스러우므로,
             맞힌 문장을 그대로 보여주고 기본 답안은 아래에 따로 안내한다. */
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-foreground break-keep">
                {r.userSentence || r.correctSentence}
              </p>
            </div>
            {isAlternateOrder && (
              <p className="text-xs text-muted-foreground pl-[76px] break-keep">
                이 순서도 맞아요 · 기본 답안: {r.correctSentence}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-destructive/10 text-destructive">
                {answerLabel}
              </span>
              <p className="text-lg font-bold leading-relaxed text-destructive break-keep">
                {r.userSentence || "—"}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">{r.correctSentence}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
