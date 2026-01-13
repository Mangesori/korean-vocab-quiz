import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Volume2, Lightbulb } from "lucide-react";

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
}

export function QuizReviewCard({
  problem,
  userAnswer,
  isCorrect,
  problemNumber,
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
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Problem Number */}
          <span className="text-primary font-bold text-lg mt-1 min-w-[32px]">
            {problemNumber}.
          </span>

          {/* Icon Indicator */}
          <div className="mt-1 shrink-0">
            {isCorrect ? (
              <div className="p-1 rounded-full bg-success/10 text-success">
                <CheckCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-1 rounded-full bg-destructive/10 text-destructive">
                <XCircle className="w-5 h-5" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            {/* Sentence Display with Buttons */}
            <div className="flex items-start justify-between gap-4">
              <div className="text-lg leading-relaxed text-foreground flex-1">
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

              {/* Action Buttons */}
              <div className="flex gap-2 shrink-0">
                {/* Audio Button */}
                {problem.sentence_audio_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={playAudio}
                  >
                    <Volume2
                      className={`w-4 h-4 mr-1 ${
                        isPlaying ? "text-primary animate-pulse" : ""
                      }`}
                    />
                    듣기
                  </Button>
                )}

                {/* Translation Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTranslation}
                >
                  <Lightbulb
                    className={`w-4 h-4 mr-1 ${
                      showTranslation ? "text-warning" : ""
                    }`}
                  />
                  번역 보기
                </Button>
              </div>
            </div>

            {/* Incorrect Answer Feedback */}
            {!isCorrect && (
              <div className="text-sm bg-destructive/5 text-destructive px-3 py-2 rounded-md inline-block">
                <span className="font-medium mr-2">내 답안:</span>
                <span className="line-through opacity-80">
                  {userAnswer || "(입력 없음)"}
                </span>
              </div>
            )}

            {/* Translation Display */}
            {showTranslation && (
              <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg animate-in slide-in-from-top-1 fade-in duration-200">
                {problem.translation}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
