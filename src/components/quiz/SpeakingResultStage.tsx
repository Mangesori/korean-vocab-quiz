import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Volume2, Lightbulb } from "lucide-react";
import { useRef, useState } from "react";

interface SpeakingAttempt {
  attemptNumber: number;
  recordingUrl: string;
  overallScore: number;
  fluencyScore: number;
  prosodyScore: number;
  completenessScore: number;
  isPassed: boolean;
  wordLevelFeedback?: { word: string; accuracyScore: number; errorType?: string }[];
}

interface SpeakingProblem {
  id: string;
  sentence: string;
  mode?: "read" | "listen";
  sentenceAudioUrl?: string | null;
  translation: string | null;
}

interface SpeakingResultStageProps {
  problems: SpeakingProblem[];
  attempts: Record<string, SpeakingAttempt[]>;
  onComplete: () => void;
}

export function SpeakingResultStage({
  problems,
  attempts,
  onComplete,
}: SpeakingResultStageProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showRecordingTrans, setShowRecordingTrans] = useState<Record<string, boolean>>({});

  // 각 문제의 최고 점수 시도 가져오기
  const getBestAttempt = (problemId: string): SpeakingAttempt | null => {
    const problemAttempts = attempts[problemId] || [];
    if (problemAttempts.length === 0) return null;
    return problemAttempts.reduce((best, curr) =>
      curr.overallScore > best.overallScore ? curr : best
    );
  };

  const totalScore = problems.reduce((sum, p) => {
    const best = getBestAttempt(p.id);
    return sum + (best?.overallScore || 0);
  }, 0);
  const avgScore = problems.length > 0 ? Math.round(totalScore / problems.length) : 0;
  const passedCount = problems.filter((p) => getBestAttempt(p.id)?.isPassed).length;

  const playAudio = (url: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play();
  };

  const playOriginalAudio = (url: string | null | undefined, id: string) => {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setPlayingId(`original-${id}`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play();
  };

  // 문장에서 60점 미만 단어를 빨간색으로, 나머지를 녹색으로 표시
  const renderSentenceWithFeedback = (
    sentence: string,
    wordFeedback?: { word: string; accuracyScore: number }[],
    isPassed?: boolean
  ) => {
    if (!wordFeedback || wordFeedback.length === 0) {
      return <span className={isPassed ? "text-success font-bold" : ""}>{sentence}</span>;
    }

    const lowScoreWords = new Set(
      wordFeedback.filter((w) => w.accuracyScore < 60).map((w) => w.word.replace(/[.,!?。，！？]/g, ""))
    );

    if (lowScoreWords.size === 0) {
      return <span className="text-success font-bold">{sentence}</span>;
    }

    const words = sentence.split(/(\s+)/);
    return (
      <span className="font-bold">
        {words.map((word, idx) => {
          const cleanWord = word.replace(/[.,!?。，！？]/g, "");
          if (lowScoreWords.has(cleanWord)) {
            return (
              <span key={idx} className="text-destructive">
                {word}
              </span>
            );
          }
          return <span key={idx} className="text-success">{word}</span>;
        })}
      </span>
    );
  };

  const generateFeedback = (attempt: SpeakingAttempt) => {
    const lowScoreWords = attempt.wordLevelFeedback
      ?.filter((w) => w.accuracyScore < 60)
      .map((w) => w.word.replace(/[.,!?。，！？]/g, ""));

    if (lowScoreWords && lowScoreWords.length > 0) {
      const displayWords = lowScoreWords.slice(0, 3).join("', '");
      const suffix = lowScoreWords.length > 3 ? "' and others" : "'";
      return `Pay closer attention to the pronunciation of '${displayWords}${suffix}. Listen to the native speaker and try again!`;
    }

    if (attempt.isPassed) {
      if (attempt.overallScore >= 90) {
        return "Excellent pronunciation! You sound very natural and clear.";
      }
      
      let feedback = "Good job! ";
      if (attempt.fluencyScore < 80) {
        feedback += "Try to speak a bit more smoothly without pausing.";
      } else if (attempt.prosodyScore < 80) {
        feedback += "Pay a little more attention to the natural rhythm and intonation.";
      } else if (attempt.completenessScore < 80) {
        feedback += "Make sure to pronounce every word in the sentence clearly.";
      } else {
        feedback += "Keep practicing to make it even more natural.";
      }
      return feedback;
    }
    
    return "Please listen carefully to the native speaker and try again.";
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* 상단 요약 추가 */}
      <div className="flex flex-col items-center justify-center py-6 mb-8 mt-2">
        <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm">{avgScore}점</p>
        <p className="text-lg font-medium text-slate-600 mt-3">
          {problems.length}문장 중 <span className="text-primary font-bold">{passedCount}</span>문장을 통과했어요!
        </p>
      </div>

      <div className="grid gap-4">
        {problems.map((problem, idx) => {
          const best = getBestAttempt(problem.id);
          if (!best) return null;

          return (
            <Card key={problem.id} className="overflow-hidden border bg-white rounded-xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                        best.isPassed ? "bg-success" : "bg-destructive"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      problem.mode === "listen" 
                        ? "text-orange-700 bg-orange-100" 
                        : "text-primary/80 bg-primary/10"
                    }`}>
                      {problem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
                    </div>
                  </div>
                  
                  {problem.translation && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowRecordingTrans(prev => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                    >
                      <Lightbulb className={`w-4 h-4 sm:mr-2 ${showRecordingTrans[problem.id] ? "text-warning" : ""}`} />
                      <span className="hidden sm:inline">번역 보기</span>
                    </Button>
                  )}
                </div>
                
                <h3 className="text-lg font-bold mb-4 text-slate-800 leading-relaxed pl-3">
                  {problem.sentence}
                </h3>
                
                {showRecordingTrans[problem.id] && problem.translation && (
                  <p className="text-sm text-muted-foreground mb-6 bg-slate-50 p-3 rounded-lg">
                    {problem.translation}
                  </p>
                )}
                
                <div className={`flex flex-col gap-3 mb-4 ${problem.mode === "listen" ? "mt-6" : "mt-4"}`}>
                  {problem.mode === "listen" && problem.sentenceAudioUrl && (
                    <div className="flex items-center gap-0 sm:gap-4">
                      <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">원어민 음성</p>
                      <button 
                        onClick={() => playOriginalAudio(problem.sentenceAudioUrl, problem.id)}
                        className="flex-1 flex items-center justify-center bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-2xl py-3 px-4 transition-colors"
                      >
                        <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingId === `original-${problem.id}` ? "text-cyan-600 animate-pulse" : "text-cyan-500"}`} />
                        <div className="flex gap-[3px] items-center h-5">
                          {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                            <div 
                              key={`orig-${i}`} 
                              className={`w-[3px] rounded-full transition-all duration-300 ${
                                playingId === `original-${problem.id}` ? "bg-cyan-500 animate-pulse" : "bg-cyan-200"
                              }`} 
                              style={{ height: `${h * 3}px`, opacity: playingId === `original-${problem.id}` ? (h / 8) + 0.2 : 1 }} 
                            />
                          ))}
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-0 sm:gap-4">
                    <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">내 발음</p>
                    <button 
                      onClick={() => playAudio(best.recordingUrl, problem.id)}
                      className="flex-1 flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-2xl py-3 px-4 transition-colors"
                    >
                      <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingId === problem.id ? "text-amber-600 animate-pulse" : "text-amber-500"}`} />
                      <div className="flex gap-[3px] items-center h-5">
                        {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                          <div 
                            key={`read-${i}`} 
                            className={`w-[3px] rounded-full transition-all duration-300 ${
                              playingId === problem.id ? "bg-amber-500 animate-pulse" : "bg-amber-200"
                            }`} 
                            style={{ height: `${h * 3}px`, opacity: playingId === problem.id ? (h / 8) + 0.2 : 1 }} 
                          />
                        ))}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5 space-y-4 px-1 sm:px-3">
                  <div className="text-lg">
                    {renderSentenceWithFeedback(problem.sentence, best.wordLevelFeedback, best.isPassed)}
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed break-keep">{generateFeedback(best)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center space-y-4 mt-8">
        <Button 
          onClick={onComplete}
          className="w-full sm:w-auto min-w-[200px] h-12 text-base font-semibold shadow-md bg-[#6366F1] hover:bg-[#4F46E5] transition-colors rounded-xl"
        >
          최종 결과 보기
        </Button>
      </div>
    </div>
  );
}
