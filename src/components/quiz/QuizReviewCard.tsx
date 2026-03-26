import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      return;
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
    <Card className="overflow-hidden border bg-card rounded-xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isCorrect ? "bg-success" : "bg-destructive"}`}>
              {problemNumber}
            </span>
            <Badge variant="outline" className="font-semibold text-base px-3 py-1">
              {problem.word || problem.answer}
            </Badge>
          </div>
          <div className="flex gap-2">
            {problem.sentence_audio_url && (
              <Button variant="outline" size="sm" onClick={playAudio}>
                <Volume2
                  className={`w-4 h-4 sm:mr-2 ${
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
                className={`w-4 h-4 sm:mr-2 ${
                  showTranslation ? "text-warning" : ""
                }`}
              />
              <span className="hidden sm:inline">번역 보기</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Sentence with highlighted answer */}
          <h3 className="text-lg font-bold leading-relaxed text-foreground">
            {parts[0]}
            <span className={`font-bold mx-1 ${isCorrect ? "text-success" : "text-destructive"}`}>
              {problem.answer}
            </span>
            {parts[1]}
          </h3>

          {/* Incorrect Answer Feedback */}
          {!isCorrect && (
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md bg-muted text-muted-foreground">
                {isTeacherView ? "학생 답" : "내 답변"}
              </span>
              <span className="text-base font-bold text-muted-foreground leading-normal">
                {userAnswer || "(입력 없음)"}
              </span>
            </div>
          )}

          {/* Translation Display */}
          {showTranslation && (
            <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg animate-in slide-in-from-top-1 fade-in duration-200">
              {problem.translation}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
