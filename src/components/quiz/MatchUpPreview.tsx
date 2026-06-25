import type { MatchupProblem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { MatchUpStudentView } from "@/components/quiz/shared/MatchUpStudentView";
import { WordMeaningEditCard } from "@/components/quiz/shared/WordMeaningEditCard";

interface MatchUpPreviewProps {
  problems: MatchupProblem[];
  studentPreview: boolean;
  updateMatchupProblem: (id: string, field: keyof MatchupProblem, value: string) => void;
  deleteMatchupProblem: (id: string) => void;
  addMatchupProblem: () => void;
}

export function MatchUpPreview({
  problems,
  studentPreview,
  updateMatchupProblem,
  deleteMatchupProblem,
  addMatchupProblem,
}: MatchUpPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">짝 맞추기</h2>
        <p className="text-muted-foreground">
          학생이 단어를 탭한 뒤 알맞은 뜻을 탭해 짝을 맞춥니다. 뜻은 AI가 자동 생성했으며 수정할 수 있습니다.
        </p>
      </div>

      {studentPreview ? (
        <MatchUpStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {problems.map((problem, index) => (
              <WordMeaningEditCard
                key={problem.problem_id}
                index={index}
                word={problem.korean_text}
                meaning={problem.meaning_text}
                onChangeWord={(v) => updateMatchupProblem(problem.problem_id, "korean_text", v)}
                onChangeMeaning={(v) => updateMatchupProblem(problem.problem_id, "meaning_text", v)}
                onDelete={() => deleteMatchupProblem(problem.problem_id)}
              />
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addMatchupProblem}
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
