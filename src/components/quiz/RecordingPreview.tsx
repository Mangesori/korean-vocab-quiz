import type { RecordingProblem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import { RecordingStudentView } from "@/components/quiz/shared/RecordingStudentView";
import { RecordingEditCard } from "@/components/quiz/shared/RecordingEditCard";

interface RecordingPreviewProps {
  problems: RecordingProblem[];
  studentPreview: boolean;
  updateRecordingProblem: (id: string, field: keyof RecordingProblem, value: string) => void;
  deleteRecordingProblem: (id: string) => void;
  regenerateRecordingProblem: (id: string, index: number) => void;
  addRecordingProblem: () => void;
  /** problem_id → 출처 단어(빈칸 문제). 헤더 읽기전용 라벨용. */
  sourceWords?: Record<string, string>;
  /** 현재 AI 재생성 중인 문제의 problem_id (로딩 스피너 표시용). */
  regeneratingProblemId?: string | null;
}

export function RecordingPreview({
  problems,
  studentPreview,
  updateRecordingProblem,
  deleteRecordingProblem,
  regenerateRecordingProblem,
  addRecordingProblem,
  sourceWords,
  regeneratingProblemId,
}: RecordingPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          학생이 문장을 보거나 듣고 따라 말합니다. 저장 후 재편집이 가능합니다.
        </p>
      </div>

      {studentPreview ? (
        <RecordingStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>'보고 말하기'는 문장을 보면서 소리 내어 읽고, '듣고 말하기'는 문장 없이 음성만 듣고 따라 말합니다.</span>
          </div>
          {problems.map((problem, index) => (
            <RecordingEditCard
              key={problem.problem_id}
              index={index}
              sentence={problem.sentence}
              translation={problem.translation || ""}
              mode={problem.mode}
              sourceWord={sourceWords?.[problem.problem_id]}
              label={problem.label || ""}
              onChangeLabel={(value) => updateRecordingProblem(problem.problem_id, "label", value)}
              onChangeSentence={(value) => updateRecordingProblem(problem.problem_id, "sentence", value)}
              onChangeTranslation={(value) => updateRecordingProblem(problem.problem_id, "translation", value)}
              onChangeMode={(mode) => updateRecordingProblem(problem.problem_id, "mode", mode)}
              onRegenerateProblem={() => regenerateRecordingProblem(problem.problem_id, index)}
              regeneratingProblem={regeneratingProblemId === problem.problem_id}
              onDelete={() => deleteRecordingProblem(problem.problem_id)}
            />
          ))}
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addRecordingProblem}
            >
              <Plus className="w-4 h-4 mr-2" />
              문장 추가하기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
