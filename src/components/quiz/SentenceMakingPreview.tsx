import type { SentenceMakingProblem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SentenceMakingStudentView } from "@/components/quiz/shared/SentenceMakingStudentView";
import { WordMeaningEditCard } from "@/components/quiz/shared/WordMeaningEditCard";

interface SentenceMakingPreviewProps {
  problems: SentenceMakingProblem[];
  studentPreview: boolean;
  updateSentenceMakingProblem: (id: string, field: keyof SentenceMakingProblem, value: string) => void;
  deleteSentenceMakingProblem: (id: string) => void;
  addSentenceMakingProblem: () => void;
}

export function SentenceMakingPreview({
  problems,
  studentPreview,
  updateSentenceMakingProblem,
  deleteSentenceMakingProblem,
  addSentenceMakingProblem,
}: SentenceMakingPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          학생이 제시된 단어를 사용하여 문장을 만듭니다. 저장 후 재편집이 가능합니다.
        </p>
      </div>

      {studentPreview ? (
        <SentenceMakingStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {problems.map((problem, index) => (
              <WordMeaningEditCard
                key={problem.problem_id}
                index={index}
                word={problem.word}
                meaning={problem.word_meaning || ""}
                onChangeWord={(v) => updateSentenceMakingProblem(problem.problem_id, "word", v)}
                onChangeMeaning={(v) => updateSentenceMakingProblem(problem.problem_id, "word_meaning", v)}
                onDelete={() => deleteSentenceMakingProblem(problem.problem_id)}
              />
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addSentenceMakingProblem}
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
