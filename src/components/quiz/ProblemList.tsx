
import { useState } from "react";
import { Eye, EyeOff, RefreshCw, Loader2, Save, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProblemCard } from "./ProblemCard";
import { Problem } from "@/hooks/useQuizData";

interface ProblemListProps {
  problems: Problem[];
  isEditing: boolean;
  onUpdateProblem: (id: string, field: keyof Problem, value: string) => void;
  audioUrls: Record<string, string>;
  onPlayAudio: (url: string) => void;
  onRegenerateAllAudio: () => void;
  onRegenerateSingleAudio: (problem: Problem) => void;
  isGeneratingAudio: boolean;
  audioProgress: { current: number; total: number };
  regeneratingProblemId: string | null;
  studentPreview: boolean;
  onToggleStudentPreview: (enabled: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  onCancelEdit: () => void;
  onSaveChanges: () => void;
  onRegenerateAllProblems: () => void;
  onRegenerateProblem: (problem: Problem) => void;
  isRegeneratingProblems: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  wordsPerSet?: number;
}

export function ProblemList({
  problems,
  isEditing,
  onUpdateProblem,
  audioUrls,
  onPlayAudio,
  onRegenerateAllAudio,
  onRegenerateSingleAudio,
  isGeneratingAudio,
  audioProgress,
  regeneratingProblemId,
  studentPreview,
  onToggleStudentPreview,
  setIsEditing,
  onCancelEdit,
  onSaveChanges,
  onRegenerateAllProblems,
  onRegenerateProblem,
  isRegeneratingProblems,
  isSaving,
  hasChanges,
  wordsPerSet = 5
}: ProblemListProps) {
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Group problems into sets
  const problemSets: Problem[][] = [];
  for (let i = 0; i < problems.length; i += wordsPerSet) {
    problemSets.push(problems.slice(i, i + wordsPerSet));
  }

  const toggleTranslation = (id: string) => {
    setShowTranslations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 학생 화면용: 문장에서 빈칸과 힌트를 분리하여 렌더링
  const renderStudentSentence = (sentence: string, hint: string) => {
    const parts = sentence.split(/\(\s*\)|\(\)/);

    if (parts.length < 2) {
      return <span>{sentence}</span>;
    }

    return (
      <span className="flex items-center flex-wrap gap-1">
        <span>{parts[0]}</span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block min-w-[100px] h-8 rounded border bg-background"></span>
          <span className="text-primary text-sm">{hint}</span>
        </span>
        <span>{parts[1]}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">문제 미리보기</h2>
          <div className="flex items-center gap-2">
            {studentPreview ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            <Label htmlFor="student-preview" className="text-sm cursor-pointer whitespace-nowrap">
              학생 화면
            </Label>
            <Switch id="student-preview" checked={studentPreview} onCheckedChange={onToggleStudentPreview} />
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          {/* 전체 음성 재생성 버튼 */}
          <Button
            variant="default"
            size="sm"
            onClick={onRegenerateAllAudio}
            disabled={isGeneratingAudio}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isGeneratingAudio ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline whitespace-nowrap">음성 생성 중...</span>
                <span className="sm:hidden">생성 중...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline whitespace-nowrap">전체 음성 재생성</span>
                <span className="sm:hidden">전체 음성</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateAllProblems}
            disabled={isRegeneratingProblems}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
             {isRegeneratingProblems ? (
               <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
             ) : (
               <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" />
             )}
             <span className="hidden sm:inline whitespace-nowrap">전체 문제 재생성</span>
             <span className="sm:hidden">전체 문제</span>
          </Button>

          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => isEditing ? onCancelEdit() : setIsEditing(true)}
          >
            <Edit2 className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{isEditing ? "수정 취소" : "수정하기"}</span>
            <span className="sm:hidden">{isEditing ? "취소" : "수정"}</span>
          </Button>
          {hasChanges && (
            <Button onClick={onSaveChanges} disabled={isSaving} size="icon">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {problemSets.map((set, setIndex) => (
          <div key={setIndex}>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xl font-medium">
                세트 {setIndex + 1}
              </span>
            </div>
            <div className="space-y-4">
              {set.map((problem) => {
                const globalIndex = setIndex * wordsPerSet + set.indexOf(problem);
                return (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    index={globalIndex}
                    isEditing={isEditing}
                    onUpdateProblem={onUpdateProblem}
                    audioUrl={audioUrls[problem.id]}
                    onPlayAudio={onPlayAudio}
                    onRegenerateAudio={() => onRegenerateSingleAudio(problem)}
                  onRegenerateProblem={() => onRegenerateProblem(problem)}
                  regeneratingId={regeneratingProblemId}
                  showTranslation={!!showTranslations[problem.id]}
                    onToggleTranslation={toggleTranslation}
                    studentPreview={studentPreview}
                    renderStudentSentence={renderStudentSentence}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="mt-8 flex justify-center">
          <Button onClick={onSaveChanges} disabled={isSaving || !hasChanges} size="lg">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            저장하기
          </Button>
        </div>
      )}
    </div>
  );
}
