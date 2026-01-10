
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
        <span className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">( _____ )</span>
          {hint && <span className="text-primary text-sm">{hint}</span>}
        </span>
        <span>{parts[1]}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">단어 목록</h2>
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium">
              {problems.length}개
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="student-preview" className="text-sm cursor-pointer whitespace-nowrap">
              학생 화면
            </Label>
            <Switch id="student-preview" checked={studentPreview} onCheckedChange={onToggleStudentPreview} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onRegenerateAllAudio}
            disabled={isGeneratingAudio}
            className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
          >
            {isGeneratingAudio ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="whitespace-nowrap">음성 생성 중...</span>
                <span className="sm:hidden -ml-1">...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                <span className="whitespace-nowrap">전체 음성 재생성</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateAllProblems}
            disabled={isRegeneratingProblems}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
          >
             {isRegeneratingProblems ? (
               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
             ) : (
               <RefreshCw className="w-4 h-4 mr-2" />
             )}
             <span className="whitespace-nowrap">전체 문제 재생성</span>
          </Button>

          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => isEditing ? onCancelEdit() : setIsEditing(true)}
            className="w-full sm:w-auto"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            <span>{isEditing ? "수정 취소" : "수정하기"}</span>
          </Button>

          <Button 
            onClick={onSaveChanges} 
            disabled={isSaving || !hasChanges} 
            size="sm"
            className="w-full sm:w-auto"
            variant="default"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            <span>저장하기</span>
          </Button>
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

            {studentPreview ? (
              <div className="border rounded-xl bg-card text-card-foreground shadow-sm">
                 <div className="p-4 sm:p-6">
                    {/* Word Bank for the Set */}
                    <div className="mb-4 sm:mb-6">
                      <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {set.map((problem) => (
                          <span
                            key={problem.id}
                            className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium"
                          >
                            {problem.word}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-0 divide-y">
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
              </div>
            ) : (
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
            )}
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
