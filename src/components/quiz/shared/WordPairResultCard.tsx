import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";

/**
 * 단어↔뜻 쌍 결과 카드. 짝 맞추기·단어 받아쓰기가 구조가 동일하므로 공유한다.
 * 빈칸 채우기·문장 순서 맞추기·문장 만들기 결과와 동일한 카드 패턴으로 통일:
 * 번호 배지(정답=success/오답=destructive) + 제시어 배지 + 우측 상태 아이콘,
 * 아래 정답(/오답 시 내 답변) 라벨 행.
 * - prompt: 학생에게 제시된 것(헤더 알약). MatchUp=한국어 단어, TypeAnswer=뜻.
 * - correctAnswer: 정답(본문). MatchUp=뜻, TypeAnswer=한국어 단어.
 * - userAnswer: 학생 답(오답일 때만 본문 표시).
 */
interface WordPairResultCardProps {
  number: number;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  isSkipped?: boolean;
}

export function WordPairResultCard({
  number,
  prompt,
  correctAnswer,
  userAnswer,
  isCorrect,
  isSkipped,
}: WordPairResultCardProps) {
  return (
    <Card className="overflow-hidden border bg-white rounded-2xl shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                isSkipped ? "bg-muted-foreground" : isCorrect ? "bg-success" : "bg-destructive"
              }`}
            >
              {number}
            </span>
            <Badge
              variant="outline"
              className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700 break-keep"
            >
              {prompt}
            </Badge>
          </div>
          {isSkipped ? (
            <HelpCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          ) : isCorrect ? (
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
        </div>

        {isSkipped ? (
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
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">
                {correctAnswer}
              </p>
            </div>
          </div>
        ) : isCorrect ? (
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
              정답
            </span>
            <p className="text-lg font-bold leading-relaxed text-foreground break-keep">
              {correctAnswer}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-destructive/10 text-destructive">
                내 답변
              </span>
              <p className="text-lg font-bold leading-relaxed text-destructive line-through break-keep">
                {userAnswer || "—"}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-accent text-primary">
                정답
              </span>
              <p className="text-lg font-bold leading-relaxed text-primary break-keep">
                {correctAnswer}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
