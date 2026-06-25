import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface TypeAnswerStudentItem {
  prompt: string;
}

/**
 * 뜻 보고 단어 쓰기 학생 미리보기 — 실제 학생 화면(TypeAnswerStage)과 동일한
 * 받아쓰기 라인 레이아웃(번호 · 뜻 · 밑줄 입력)으로 표시한다.
 */
export function TypeAnswerStudentView({ problems }: { problems: TypeAnswerStudentItem[] }) {
  return (
    <Card className="w-full max-w-3xl mx-auto sm:rounded-2xl">
      <CardContent className="p-4 sm:p-8 space-y-5">
        <p className="text-center text-sm text-muted-foreground font-medium">
          뜻을 보고 알맞은 한국어 단어를 입력하세요
        </p>
        <div className="divide-y divide-border">
          {problems.map((p, idx) => (
            <div key={idx} className="flex items-center gap-3 sm:gap-5 py-3.5">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="flex-shrink-0 w-28 sm:w-44 text-sm sm:text-base text-muted-foreground break-keep">
                {p.prompt}
              </span>
              <Input
                disabled
                placeholder="여기에 입력"
                className="flex-1 h-10 px-1 rounded-none border-0 border-b-2 border-border bg-transparent text-lg shadow-none opacity-70 placeholder:text-base placeholder:text-muted-foreground/60"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
