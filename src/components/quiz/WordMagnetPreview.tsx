import type { WordMagnetProblem } from "@/types/quiz";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import { WordMagnetStudentView } from "@/components/quiz/shared/WordMagnetStudentView";
import { WordMagnetEditCard } from "@/components/quiz/shared/WordMagnetEditCard";

interface WordMagnetPreviewProps {
  problems: WordMagnetProblem[];
  studentPreview: boolean;
  updateWordMagnetProblem: (id: string, field: "base_text" | "translation", value: string) => void;
  updateWordMagnetItems: (id: string, items: { content: string; isParticle: boolean }[]) => void;
  resegmentWordMagnetProblem: (id: string) => void;
  resegmentingId: string | null;
  regenerateWordMagnetProblem: (id: string) => void;
  regeneratingWordMagnetId: string | null;
  deleteWordMagnetProblem: (id: string) => void;
  addWordMagnetProblem: () => void;
  /** problem_id → 출처 단어(빈칸 문제). 헤더 읽기전용 라벨용. */
  sourceWords?: Record<string, string>;
}

export function WordMagnetPreview({
  problems,
  studentPreview,
  updateWordMagnetProblem,
  updateWordMagnetItems,
  resegmentWordMagnetProblem,
  resegmentingId,
  regenerateWordMagnetProblem,
  regeneratingWordMagnetId,
  deleteWordMagnetProblem,
  addWordMagnetProblem,
  sourceWords,
}: WordMagnetPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          학생이 무작위로 섞인 단어 타일을 순서대로 배열해 문장을 완성합니다. 저장 후 재편집이 가능합니다.
        </p>
      </div>

      {studentPreview ? (
        <WordMagnetStudentView problems={problems} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>단어 타일은 'AI 재분절'로 다시 나누거나 직접 편집할 수 있어요. 조사·어미는 노란색 타일입니다.</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {problems.map((problem, index) => (
              <WordMagnetEditCard
                key={problem.problem_id}
                index={index}
                baseText={problem.base_text}
                translation={problem.translation}
                items={problem.items || []}
                word={sourceWords?.[problem.problem_id]}
                onChangeBaseText={(v) => updateWordMagnetProblem(problem.problem_id, "base_text", v)}
                onChangeTranslation={(v) => updateWordMagnetProblem(problem.problem_id, "translation", v)}
                onChangeItems={(items) => updateWordMagnetItems(problem.problem_id, items)}
                onResegment={() => resegmentWordMagnetProblem(problem.problem_id)}
                resegmenting={resegmentingId === problem.problem_id}
                onRegenerateProblem={() => regenerateWordMagnetProblem(problem.problem_id)}
                regeneratingProblem={regeneratingWordMagnetId === problem.problem_id}
                onDelete={() => deleteWordMagnetProblem(problem.problem_id)}
              />
            ))}
          </div>

          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-muted-foreground transition-colors"
              onClick={addWordMagnetProblem}
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
