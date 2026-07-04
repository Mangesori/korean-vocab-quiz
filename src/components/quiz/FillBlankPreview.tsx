import type { Problem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import { FillBlankStudentSet } from "@/components/quiz/shared/FillBlankStudentSet";
import { FillBlankEditCard } from "@/components/quiz/shared/FillBlankEditCard";

interface FillBlankPreviewProps {
  problemSets: Problem[][];
  wordsPerSet: number;
  studentPreview: boolean;
  showTranslations: Record<string, boolean>;
  setShowTranslations: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  regeneratingId: string | null;
  langLabel: string;
  updateProblem: (id: string, field: keyof Problem, value: string) => void;
  regenerateProblem: (problem: Problem) => void;
  addFillBlankProblem: () => void;
  deleteFillBlankProblem: (id: string) => void;
}

export function FillBlankPreview({
  problemSets,
  wordsPerSet,
  studentPreview,
  showTranslations,
  setShowTranslations,
  regeneratingId,
  langLabel,
  updateProblem,
  regenerateProblem,
  addFillBlankProblem,
  deleteFillBlankProblem,
}: FillBlankPreviewProps) {
  return (
    <>
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          학생이 빈칸에 알맞은 단어를 입력합니다. 저장 후 재편집이 가능합니다.
        </p>
      </div>

      {!studentPreview && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80 mb-6">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>출제 문장에서 정답이 들어갈 자리에 괄호 ( )를 넣어주세요. 학생 화면에는 정답 칸에 입력한 단어가 그 자리에 채워져서 보입니다.</span>
        </div>
      )}

      {problemSets.map((set, setIndex) => (
        <div key={setIndex} className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
              세트 {setIndex + 1}
            </span>
          </div>

          {studentPreview ? (
            <FillBlankStudentSet
              set={set}
              startNumber={setIndex * wordsPerSet + 1}
              showTranslations={showTranslations}
              onToggleTranslation={(id) => setShowTranslations((prev) => ({ ...prev, [id]: !prev[id] }))}
            />
          ) : (
            <div className="space-y-4">
              {set.map((problem, problemIndex) => (
                <FillBlankEditCard
                  key={problem.id}
                  problem={problem}
                  index={setIndex * wordsPerSet + problemIndex}
                  onUpdateProblem={updateProblem}
                  langLabel={langLabel}
                  onRegenerateProblem={() => regenerateProblem(problem)}
                  regeneratingId={regeneratingId}
                  onDeleteProblem={() => deleteFillBlankProblem(problem.id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      {!studentPreview && (
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
            onClick={addFillBlankProblem}
          >
            <Plus className="w-4 h-4 mr-2" />
            문제 추가
          </Button>
        </div>
      )}
    </>
  );
}
