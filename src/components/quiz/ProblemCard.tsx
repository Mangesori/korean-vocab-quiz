
import { Volume2, RefreshCw, Loader2, Link2, Eye, EyeOff, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Problem } from "@/hooks/useQuizData";
import { maskTranslation } from "@/utils/maskTranslation";

interface ProblemCardProps {
  problem: Problem;
  index: number;
  isEditing: boolean;
  onUpdateProblem: (id: string, field: keyof Problem, value: string) => void;
  audioUrl?: string;
  onPlayAudio: (url: string) => void;
  onRegenerateAudio: (problem: Problem) => void;
  onRegenerateProblem: () => void;
  regeneratingId: string | null;
  showTranslation: boolean;
  onToggleTranslation: (id: string) => void;
  studentPreview: boolean;
  renderStudentSentence: (sentence: string, hint: string) => React.ReactNode;
}

export function ProblemCard({
  problem,
  index,
  isEditing,
  onUpdateProblem,
  audioUrl,
  onPlayAudio,
  onRegenerateAudio,
  onRegenerateProblem,
  regeneratingId,
  showTranslation,
  onToggleTranslation,
  studentPreview,
  renderStudentSentence
}: ProblemCardProps) {

  // Student Preview Mode
  if (studentPreview) {
    const parts = problem.sentence.split(/\(\s*\)|\(\)/);
    
    // Fallback if split fails/unexpected format
    if (parts.length < 2) {
       return (
        <Card className="shadow-none border-0">
          <CardContent className="p-4 sm:p-6">
            <p>{problem.sentence}</p>
          </CardContent>
        </Card>
       )
    }

    return (
      <div className="py-2">
         {/* Mobile Layout: Stacked */}
         <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">{index + 1}.</span>
              <div className="flex-1">
                <p className="text-base leading-relaxed">
                  {parts[0]}
                  <span className="text-muted-foreground ml-1">( _____ )</span>
                  {problem.hint && <span className="text-primary text-sm ml-1">{problem.hint}</span>}
                  {parts[1]}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-8 w-8 text-primary"
                   disabled={!audioUrl}
                   onClick={() => audioUrl && onPlayAudio(audioUrl)}
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 w-8"
                  onClick={() => onToggleTranslation(problem.id)}
                >
                  <Lightbulb className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {showTranslation && problem.translation && (
              <div className="mt-2 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                {maskTranslation(problem.translation)}
              </div>
            )}
            <Input
              readOnly
              className="h-10 text-center bg-muted/30"
              placeholder="정답 입력"
            />
          </div>

          {/* Desktop Layout: Inline */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold min-w-[24px]">{index + 1}.</span>
              <div className="flex-1 flex items-center flex-wrap gap-1">
                {parts.map((part, partIdx, arr) => (
                  <span key={partIdx} className="inline-flex items-center">
                    <span className="text-base whitespace-nowrap">{part}</span>
                    {partIdx < arr.length - 1 && (
                      <>
                        <Input
                          readOnly
                          className="w-48 h-8 mx-1 text-center text-sm inline-block bg-muted/30"
                          placeholder="정답 입력"
                        />
                        {problem.hint && <span className="text-primary text-sm">{problem.hint}</span>}
                      </>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-primary"
                  disabled={!audioUrl}
                  onClick={() => audioUrl && onPlayAudio(audioUrl)}
                >
                  <Volume2 className="w-4 h-4 mr-1" />
                  듣기
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onToggleTranslation(problem.id)}
                >
                  <Lightbulb className="w-4 h-4 mr-1" />
                  힌트
                </Button>
              </div>
            </div>
            {showTranslation && problem.translation && (
              <div className="mt-2 ml-8 px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                {maskTranslation(problem.translation)}
              </div>
            )}
          </div>
      </div>
    );
  }

  // Teacher / Edit Mode
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="py-3 px-4 bg-muted/30">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          
          {/* Mobile Line 1: Word + Play Button */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {index + 1}
              </span>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                {problem.word}
              </span>
            </div>
            
            {/* Play Button - Visible here only on Mobile */}
            <div className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => audioUrl && onPlayAudio(audioUrl)}
                disabled={!audioUrl}
                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Desktop Right Side / Mobile Line 2 */}
          <div className="flex items-center justify-end gap-1 w-full sm:w-auto mt-1 sm:mt-0">
            {/* Play Button - Desktop Only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => audioUrl && onPlayAudio(audioUrl)}
              disabled={!audioUrl}
              className="text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            >
              <Volume2 className="w-4 h-4" />
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => onRegenerateAudio(problem)}
              disabled={regeneratingId === problem.id}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {regeneratingId === problem.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              <span className="hidden sm:inline">음성 재생성</span>
              <span className="sm:hidden">음성</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onRegenerateProblem}
              disabled={regeneratingId === problem.id}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {regeneratingId === problem.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              <span className="hidden sm:inline">문제 재생성</span>
              <span className="sm:hidden">문제</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-5 space-y-4">
        {/* 문장 (정답 하이라이트) */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">문장</Label>
          <p className="text-lg px-3 py-2 rounded-md bg-muted/30">
            {problem.sentence.split(/\(\s*\)|\(\)/).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-primary font-bold">{problem.answer}</span>
                )}
              </span>
            ))}
          </p>
        </div>

        {/* 출제 문장 - 편집 모드일 때만 표시 */}
        {isEditing && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              출제 문장
            </Label>
            <Input
              value={problem.sentence}
              onChange={(e) => onUpdateProblem(problem.id, "sentence", e.target.value)}
              className="text-sm sm:text-lg bg-muted/30"
            />
          </div>
        )}

        {/* 정답과 힌트 - 가로 배치 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              정답
            </Label>
            {isEditing ? (
              <Input
                value={problem.answer}
                onChange={(e) => onUpdateProblem(problem.id, "answer", e.target.value)}
                className="text-sm bg-muted/30"
              />
            ) : (
              <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.answer}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              힌트
            </Label>
            {isEditing ? (
              <Input
                value={problem.hint}
                onChange={(e) => onUpdateProblem(problem.id, "hint", e.target.value)}
                className="text-sm bg-muted/30"
              />
            ) : (
              <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.hint}</p>
            )}
          </div>
        </div>

        {/* 번역 (회색 배경) */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            번역
          </Label>
          {isEditing ? (
            <Textarea
              value={problem.translation}
              onChange={(e) => onUpdateProblem(problem.id, "translation", e.target.value)}
              className="bg-muted/30 min-h-[60px]"
              rows={2}
            />
          ) : (
            <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">{problem.translation}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
