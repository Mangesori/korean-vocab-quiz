import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Lightbulb } from "lucide-react";

interface Problem {
  id: string;
  word: string;
  answer: string; // The correct answer
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
}

interface QuizReviewCardProps {
  problem: Problem;
  userAnswer?: string;
  isCorrect: boolean;
  problemNumber: number;
  isTeacherView?: boolean;
}

export function QuizReviewCard({
  problem,
  userAnswer,
  isCorrect,
  problemNumber,
  isTeacherView = false,
}: QuizReviewCardProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleTranslation = () => {
    setShowTranslation((prev) => !prev);
  };

  const playAudio = useCallback(() => {
    if (!problem.sentence_audio_url) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return; // Toggle behavior: if playing, stop it.
    }

    const audio = new Audio(problem.sentence_audio_url);
    audioRef.current = audio;
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
      audioRef.current = null;
    };

    audio.onerror = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
      audioRef.current = null;
    };

    audio.play().catch((err) => {
      console.error("Audio play error:", err);
      setIsPlaying(false);
    });
  }, [problem.sentence_audio_url]);

  // Split sentence to highlight answer
  const parts = problem.sentence.split(/\(\s*\)|\(\)/);

  return (
    <Card className={`overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border-l-4 ${
      isCorrect ? "border-l-success" : "border-l-destructive"
    }`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-1 sm:gap-3">
          {/* Problem Number */}
          <span className="text-primary font-bold text-lg min-w-[28px] leading-9">
            {problemNumber}.
          </span>

          <div className="flex-1 space-y-2">
            {/* Header: Word Badge + Buttons */}
            <div className="flex flex-row items-center justify-between gap-2">
              {(problem.word || problem.answer) && (
                <span className="px-3 py-1 bg-primary/10 text-primary font-semibold rounded-full text-md w-fit">
                  {problem.word || problem.answer}
                </span>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {problem.sentence_audio_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={playAudio}
                  >
                    <Volume2
                      className={`w-4 h-4 sm:mr-1 ${
                        isPlaying ? "text-primary animate-pulse" : ""
                      }`}
                    />
                    <span className="hidden sm:inline">듣기</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTranslation}
                >
                  <Lightbulb
                    className={`w-4 h-4 sm:mr-1 ${
                      showTranslation ? "text-warning" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">번역 보기</span>
                </Button>
              </div>
            </div>

            {/* Sentence */}
            <div className="text-base leading-relaxed text-foreground">
              {parts[0]}
              <span
                className={
                  isCorrect
                    ? "font-bold text-success mx-1 underline decoration-2 underline-offset-4"
                    : "font-bold text-success mx-1"
                }
              >
                {problem.answer}
              </span>
              {parts[1]}
            </div>

            {/* Incorrect Answer Feedback */}
            {!isCorrect && (
              <div className="text-sm bg-destructive/5 text-destructive px-3 py-2 rounded-md inline-block">
                <span className="font-medium mr-2">{isTeacherView ? "학생 답안:" : "내 답안:"}</span>
                <span className="opacity-80">
                  {userAnswer || "(입력 없음)"}
                </span>
              </div>
            )}

            {/* Translation Display */}
            {showTranslation && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg animate-in slide-in-from-top-1 fade-in duration-200">
                {problem.translation}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
