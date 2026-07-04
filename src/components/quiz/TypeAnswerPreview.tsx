import type { TypeAnswerProblem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TypeAnswerStudentView } from "@/components/quiz/shared/TypeAnswerStudentView";
import { WordMeaningEditCard } from "@/components/quiz/shared/WordMeaningEditCard";

interface TypeAnswerPreviewProps {
  problems: TypeAnswerProblem[];
  studentPreview: boolean;
  updateTypeAnswerProblem: (id: string, field: keyof TypeAnswerProblem, value: string) => void;
  deleteTypeAnswerProblem: (id: string) => void;
  addTypeAnswerProblem: () => void;
}

export function TypeAnswerPreview({
  problems,
  studentPreview,
  updateTypeAnswerProblem,
  deleteTypeAnswerProblem,
  addTypeAnswerProblem,
}: TypeAnswerPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          학생이 뜻을 보고 알맞은 한국어 단어를 직접 입력합니다. 저장 후 재편집이 가능합니다.
        </p>
      </div>

      {studentPreview ? (
        <TypeAnswerStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {problems.map((problem, index) => (
              <WordMeaningEditCard
                key={problem.problem_id}
                index={index}
                word={problem.answer}
                meaning={problem.prompt}
                wordPlaceholder="정답 한국어 단어"
                meaningPlaceholder="단어 뜻"
                onChangeWord={(v) => updateTypeAnswerProblem(problem.problem_id, "answer", v)}
                onChangeMeaning={(v) => updateTypeAnswerProblem(problem.problem_id, "prompt", v)}
                onDelete={() => deleteTypeAnswerProblem(problem.problem_id)}
              />
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addTypeAnswerProblem}
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
