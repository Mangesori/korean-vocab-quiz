import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Volume2,
  Lightbulb,
} from 'lucide-react';
import { maskTranslation } from '@/utils/maskTranslation';

interface PracticeProblem {
  id: string;
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  audio_url: string | null;
}

interface PracticeResult {
  problem: PracticeProblem;
  userAnswer: string;
  isCorrect: boolean;
}

const WORDS_PER_SET = 5;

export default function WrongAnswerPractice() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('practice_problems');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Shuffle problems
        const shuffled = [...parsed].sort(() => Math.random() - 0.5);
        setProblems(shuffled);
      } catch (e) {
        console.error('Failed to parse practice problems:', e);
        navigate('/wrong-answers');
      }
    } else {
      navigate('/wrong-answers');
    }
  }, [navigate]);

  // Split problems into sets
  const problemSets = useMemo(() => {
    const sets: PracticeProblem[][] = [];
    for (let i = 0; i < problems.length; i += WORDS_PER_SET) {
      sets.push(problems.slice(i, i + WORDS_PER_SET));
    }
    return sets;
  }, [problems]);

  const currentSet = problemSets[currentSetIndex] || [];
  const totalSets = problemSets.length;

  // Shuffle word bank for current set
  const shuffledWordBank = useMemo(() => {
    return [...currentSet].sort(() => Math.random() - 0.5).map((p) => p.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSetIndex, problems.length]);

  const progress = useMemo(() => {
    if (problems.length === 0) return 0;
    const answeredCount = Object.keys(userAnswers).filter((id) => userAnswers[id]?.trim()).length;
    return (answeredCount / problems.length) * 100;
  }, [problems.length, userAnswers]);

  const handleAnswerChange = (problemId: string, value: string) => {
    setUserAnswers((prev) => ({ ...prev, [problemId]: value }));
  };

  const toggleTranslation = (problemId: string) => {
    setShowTranslations((prev) => ({
      ...prev,
      [problemId]: !prev[problemId],
    }));
  };

  const playAudio = useCallback((audioUrl: string, problemId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingAudio(problemId);
    audio.play().catch((err) => {
      console.error('Audio playback error:', err);
      setPlayingAudio(null);
    });
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
  }, []);

  const currentSetAnswered = () => {
    return currentSet.every((p) => userAnswers[p.id]?.trim());
  };

  const allAnswered = () => {
    return problems.every((p) => userAnswers[p.id]?.trim());
  };

  const handleNextSet = () => {
    if (currentSetIndex < totalSets - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
      setShowTranslations({});
    }
  };

  const handlePrevSet = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1);
      setShowTranslations({});
    }
  };

  const handleSubmit = () => {
    const practiceResults: PracticeResult[] = problems.map((problem) => {
      const userAnswer = (userAnswers[problem.id] || '').trim();
      const isCorrect = userAnswer.toLowerCase() === problem.correct_answer.toLowerCase();
      return { problem, userAnswer, isCorrect };
    });
    setResults(practiceResults);
    setIsCompleted(true);
  };

  const handleRetry = () => {
    setCurrentSetIndex(0);
    setUserAnswers({});
    setShowTranslations({});
    setIsCompleted(false);
    setResults([]);
    // Reshuffle
    setProblems((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  const score = useMemo(() => {
    return results.filter((r) => r.isCorrect).length;
  }, [results]);

  if (problems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Results screen
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-6">
            <Link to="/wrong-answers">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                오답 노트로 돌아가기
              </Button>
            </Link>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">연습 퀴즈 완료!</h1>
                <p className="text-4xl font-bold text-primary mb-4">
                  {score} / {problems.length}
                </p>
                <p className="text-muted-foreground mb-6">
                  정답률 {Math.round((score / problems.length) * 100)}%
                </p>
                <div className="flex justify-center gap-3">
                  <Button onClick={handleRetry} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    다시 풀기
                  </Button>
                  <Link to="/wrong-answers">
                    <Button>오답 노트로 돌아가기</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-lg font-semibold mb-4">문제별 결과</h2>
          <div className="space-y-4">
            {results.map((result, index) => {
              const parts = result.problem.sentence.split(/\(\s*\)|\(\)/);
              return (
                <Card
                  key={result.problem.id}
                  className={`border-l-4 ${
                    result.isCorrect ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-primary">{index + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {result.isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">{result.problem.word}</span>
                        </div>
                        <p className="text-sm">
                          {parts[0]}
                          <span className="font-bold text-green-600 mx-1">
                            {result.problem.correct_answer}
                          </span>
                          {parts[1]}
                        </p>
                        {!result.isCorrect && (
                          <p className="text-sm text-red-500">
                            내 답: {result.userAnswer || '(입력 없음)'}
                          </p>
                        )}
                        {result.problem.translation && (
                          <p className="text-xs text-muted-foreground">
                            {result.problem.translation}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress display
  const startNum = currentSetIndex * WORDS_PER_SET + 1;
  const endNum = Math.min((currentSetIndex + 1) * WORDS_PER_SET, problems.length);

  // Quiz screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/wrong-answers">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="font-bold text-lg">오답 연습</h1>
            </div>
            <span className="text-sm text-muted-foreground">
              {startNum}-{endNum} / {problems.length}
            </span>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Set Label */}
        <div className="mb-4 text-center">
          <span className="inline-block px-4 py-2 bg-muted rounded-md text-lg font-semibold">
            세트 {currentSetIndex + 1}
          </span>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardContent className="p-4 sm:p-6">
            {/* Word Bank */}
            <div className="mb-4 sm:mb-6">
              <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
              <div className="flex flex-wrap justify-center gap-2">
                {shuffledWordBank.map((word, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>

            {/* Problems List */}
            <div className="space-y-0 divide-y">
              {currentSet.map((problem, idx) => {
                const problemNumber = currentSetIndex * WORDS_PER_SET + idx + 1;
                // Clean up sentence
                let sentence = problem.sentence;
                sentence = sentence.replace(/([.?!])\s*\.+\s*$/, '$1');
                sentence = sentence.replace(/\.\s*\.$/, '.');
                const parts = sentence.split(/\(\s*\)|\(\)/);

                return (
                  <div key={problem.id} className="py-4">
                    {/* Mobile Layout: Stacked */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex items-start gap-2">
                        <span className="text-primary font-bold">{problemNumber}.</span>
                        <div className="flex-1">
                          <p className="text-base leading-relaxed">
                            {parts[0]}
                            <span className="text-muted-foreground">( _____ )</span>
                            {parts[1]}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => problem.audio_url && playAudio(problem.audio_url, problem.id)}
                            disabled={!problem.audio_url}
                            className={`h-8 w-8 p-0 ${!problem.audio_url ? 'opacity-40' : ''}`}
                          >
                            <Volume2
                              className={`w-4 h-4 ${
                                playingAudio === problem.id ? 'text-primary animate-pulse' : ''
                              }`}
                            />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleTranslation(problem.id)}
                            disabled={!problem.translation}
                          >
                            <Lightbulb
                              className={`w-4 h-4 ${showTranslations[problem.id] ? 'text-warning' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={userAnswers[problem.id] || ''}
                        onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                        className="h-10 text-center"
                        placeholder="정답 입력"
                        autoComplete="off"
                      />
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                          {maskTranslation(problem.translation)}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout: Inline */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-bold min-w-[24px]">{problemNumber}.</span>
                        <div className="flex-1 flex items-center flex-wrap gap-1">
                          {parts.map((part, partIdx, arr) => (
                            <span key={partIdx} className="inline-flex items-center">
                              <span className="text-lg whitespace-nowrap">{part}</span>
                              {partIdx < arr.length - 1 && (
                                <Input
                                  value={userAnswers[problem.id] || ''}
                                  onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                  className="w-48 h-9 mx-1 text-center text-base inline-block"
                                  autoComplete="off"
                                />
                              )}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => problem.audio_url && playAudio(problem.audio_url, problem.id)}
                            disabled={!problem.audio_url}
                            className={!problem.audio_url ? 'opacity-40' : ''}
                          >
                            <Volume2
                              className={`w-4 h-4 mr-1 ${
                                playingAudio === problem.id ? 'text-primary animate-pulse' : ''
                              }`}
                            />
                            듣기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleTranslation(problem.id)}
                            disabled={!problem.translation}
                          >
                            <Lightbulb
                              className={`w-4 h-4 mr-1 ${showTranslations[problem.id] ? 'text-warning' : ''}`}
                            />
                            힌트
                          </Button>
                        </div>
                      </div>
                      {showTranslations[problem.id] && problem.translation && (
                        <div className="mt-2 ml-8 px-4 py-2 bg-info/10 rounded-lg text-sm border border-info/30">
                          {maskTranslation(problem.translation)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handlePrevSet} disabled={currentSetIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전
          </Button>

          {currentSetIndex === totalSets - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered()}
              className="bg-success hover:bg-success/90"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              제출하기
            </Button>
          ) : (
            <Button onClick={handleNextSet} disabled={!currentSetAnswered()}>
              다음 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
