import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { toJamo } from '@/utils/hangul';

interface PracticeProblem {
  id: string;
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  audio_url: string | null;
  source: string;
  // 짝맞추기·문장순서에서 받아쓰기로 변환된 문항 중 word가 문장 전체인 경우(문장순서)는
  // 보기 배지에 넣으면 정답이 그대로 노출되므로 false로 넘어온다. (기본값은 노출)
  in_word_bank?: boolean;
}

interface PracticeResult {
  problem: PracticeProblem;
  userAnswer: string;
  isCorrect: boolean;
}

const WORDS_PER_SET = 5;

// 문장에 빈칸 ( ) 이 있는지 판정 (받아쓰기 유형은 빈칸이 없다)
const hasBlank = (sentence: string) => /\(\s*\)|\(\)/.test(sentence);

// 보기(word bank)에 노출할 문항인지 판정
const inWordBank = (p: PracticeProblem) => p.in_word_bank !== false;

export default function WrongAnswerPractice() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [masteredWords, setMasteredWords] = useState<string[]>([]);
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

  const currentSet = useMemo(
    () => problemSets[currentSetIndex] || [],
    [problemSets, currentSetIndex]
  );
  const totalSets = problemSets.length;

  // Shuffle word bank for current set (보기 제외 문항은 빼고)
  const shuffledWordBank = useMemo(() => {
    return [...currentSet]
      .filter(inWordBank)
      .sort(() => Math.random() - 0.5)
      .map((p) => p.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSetIndex, problems.length]);

  // 답이 입력된 문제의 뱅크 단어 추적 (취소선용) — 자모 분해로 불규칙 활용 대응
  const usedBankWords = useMemo(() => {
    const used = new Set<string>();
    const bankWords = currentSet.filter(inWordBank).map((p) => p.word);

    currentSet.forEach((p) => {
      // 보기에 없는 문항(문장순서 변환)은 뱅크 매칭 대상이 아니다.
      // 답이 문장 전체라 엉뚱한 보기 단어에 취소선이 그어질 수 있다.
      if (!inWordBank(p)) return;
      const answer = userAnswers[p.id]?.trim();
      if (!answer) return;

      if (bankWords.includes(answer)) {
        used.add(answer);
        return;
      }

      const ansJamo = toJamo(answer);
      let bestWord = p.word;
      let bestScore = 0;

      for (const bw of bankWords) {
        const bwJamo = toJamo(bw);
        let score = 0;
        while (score < bwJamo.length && score < ansJamo.length && bwJamo[score] === ansJamo[score]) {
          score++;
        }
        if (score > bestScore || (score === bestScore && bw === p.word)) {
          bestScore = score;
          bestWord = bw;
        }
      }

      used.add(bestScore > 0 ? bestWord : p.word);
    });

    return used;
  }, [currentSet, userAnswers]);

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

  const handleSubmit = async () => {
    const practiceResults: PracticeResult[] = problems.map((problem) => {
      const userAnswer = (userAnswers[problem.id] || '').trim();
      const isCorrect = userAnswer.toLowerCase() === problem.correct_answer.toLowerCase();
      return { problem, userAnswer, isCorrect };
    });
    setResults(practiceResults);
    setIsCompleted(true);

    // 진행도 저장 + 이번에 마스터한 단어 확인
    try {
      const { data: mastered } = await supabase.rpc('update_wa_progress', {
        _items: practiceResults.map((r) => ({ word: r.problem.word, correct: r.isCorrect })),
      });
      setMasteredWords(Array.isArray(mastered) ? mastered : []);
    } catch (e) {
      console.error('Failed to update wrong answer progress:', e);
    }
  };

  const handleRetry = () => {
    setCurrentSetIndex(0);
    setUserAnswers({});
    setShowTranslations({});
    setIsCompleted(false);
    setResults([]);
    setMasteredWords([]);
    // Reshuffle
    setProblems((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  // 틀린 문제만 다시 풀기
  const handleRetryWrongOnly = () => {
    const wrong = results.filter((r) => !r.isCorrect).map((r) => r.problem);
    setProblems([...wrong].sort(() => Math.random() - 0.5));
    setCurrentSetIndex(0);
    setUserAnswers({});
    setShowTranslations({});
    setIsCompleted(false);
    setResults([]);
    setMasteredWords([]);
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

          {masteredWords.length > 0 && (
            <div className="text-center text-sm font-bold text-success mb-3">
              ⭐ {masteredWords.join(', ')} 단어를 마스터했어요!
            </div>
          )}

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
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={handleRetry} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    다시 풀기
                  </Button>
                  {score < problems.length && (
                    <Button onClick={handleRetryWrongOnly} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      틀린 {problems.length - score}개만 다시
                    </Button>
                  )}
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
              const blank = hasBlank(result.problem.sentence);
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
                        {blank ? (
                          // 빈칸 채우기: 문장 안에 정답을 초록으로 삽입
                          <p className="text-sm">
                            {parts[0]}
                            <span className="font-bold text-green-600 mx-1">
                              {result.problem.correct_answer}
                            </span>
                            {parts[1]}
                          </p>
                        ) : (
                          // 받아쓰기: 뜻(단서) + 정답을 따로 표시
                          <div className="text-sm space-y-1">
                            {result.problem.sentence && (
                              <p className="text-muted-foreground">뜻: {result.problem.sentence}</p>
                            )}
                            <p>
                              <span className="text-muted-foreground mr-1">정답:</span>
                              <span className="font-bold text-green-600">
                                {result.problem.correct_answer}
                              </span>
                            </p>
                          </div>
                        )}
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

  // 세트 구성에 따라 안내 문구/보기 노출 결정 (빈칸·받아쓰기가 섞일 수 있다)
  const setHasBlank = currentSet.some((p) => hasBlank(p.sentence));
  const setHasDictation = currentSet.some((p) => !hasBlank(p.sentence));
  const promptText =
    setHasBlank && setHasDictation
      ? '알맞은 단어를 입력하세요'
      : setHasBlank
        ? '빈칸에 알맞은 단어를 입력하세요'
        : '뜻을 보고 알맞은 단어를 입력하세요';
  const hasWordBank = shuffledWordBank.length > 0;

  // Quiz screen
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b shadow-sm">
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
            <span className="shrink-0 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm border border-slate-200">
              {startNum}-{endNum} / {problems.length}
            </span>
          </div>
          <Progress value={progress} className="mt-2 h-2.5" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Main Card */}
        <Card className="border shadow-sm rounded-2xl overflow-hidden mb-8 bg-white max-w-5xl mx-auto">
          <CardContent className="p-0">
            <p
              className={`text-center text-sm text-muted-foreground bg-[#F1ECE4] px-6 pt-5 ${
                hasWordBank ? 'pb-3' : 'pb-5 border-b border-[#D3CCC4]'
              }`}
            >
              {promptText}
            </p>
            {/* Word Bank (보기에 낼 문항이 있을 때만 표시 + 사용한 단어 취소선) */}
            {hasWordBank && (
              <div className="bg-[#F1ECE4] border-b border-[#D3CCC4] px-6 pb-5 flex flex-col items-center">
                <p className="text-sm font-bold text-muted-foreground mb-4">보기</p>
                <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
                  {shuffledWordBank.map((word, idx) => {
                    const isUsed = usedBankWords.has(word);
                    return (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`px-4 py-1.5 rounded-full text-sm font-medium bg-white shadow-sm transition-all ${
                          isUsed
                            ? 'line-through text-muted-foreground border-border opacity-60'
                            : 'text-foreground border-border'
                        }`}
                      >
                        {word}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Problems List */}
            <div className="p-6 sm:p-8">
              <div className="space-y-0 divide-y">
                {currentSet.map((problem, idx) => {
                  const problemNumber = currentSetIndex * WORDS_PER_SET + idx + 1;
                  // Clean up sentence
                  let sentence = problem.sentence;
                  sentence = sentence.replace(/([.?!])\s*\.+\s*$/, '$1');
                  sentence = sentence.replace(/\.\s*\.$/, '.');
                  const parts = sentence.split(/\(\s*\)|\(\)/);
                  const blank = hasBlank(problem.sentence);

                  return (
                    <div key={problem.id} className="py-6 sm:py-5 first:pt-2 last:pb-2">
                      {/* Mobile Layout: Stacked */}
                      <div className="flex flex-col gap-3 sm:hidden">
                        <div className="flex items-start gap-2">
                          <span className="text-primary font-bold">{problemNumber}.</span>
                          <div className="flex-1">
                            {blank ? (
                              <p className="text-base leading-relaxed">
                                {parts[0]}
                                <span className="text-muted-foreground mx-1">( _____ )</span>
                                {parts[1]}
                              </p>
                            ) : (
                              <p className="text-base leading-relaxed">
                                <span className="text-muted-foreground mr-1">뜻:</span>
                                {sentence}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => problem.audio_url && playAudio(problem.audio_url, problem.id)}
                              disabled={!problem.audio_url}
                              className={`h-8 w-8 p-0 rounded-xl ${!problem.audio_url ? 'opacity-40' : ''}`}
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
                              className="h-8 w-8 p-0 rounded-xl"
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
                          className="h-11 w-full text-center rounded-xl bg-slate-50 border-border"
                          placeholder="정답 입력"
                          autoComplete="off"
                        />
                        {showTranslations[problem.id] && problem.translation && (
                          <div className="px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
                            {maskTranslation(problem.translation)}
                          </div>
                        )}
                      </div>

                      {/* Desktop Layout: Inline */}
                      <div className="hidden sm:block">
                        <div className="flex items-center gap-3">
                          <span className="text-primary font-bold min-w-[24px]">{problemNumber}.</span>
                          {blank ? (
                            <div className="flex-1 flex items-center flex-wrap gap-1 leading-loose">
                              <span className="text-lg font-medium text-foreground whitespace-nowrap">
                                {parts[0]?.trim()}
                              </span>
                              <Input
                                value={userAnswers[problem.id] || ''}
                                onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                className="w-48 h-10 mx-1 text-center text-base inline-block rounded-xl bg-slate-50 border-border"
                                placeholder="정답 입력"
                                autoComplete="off"
                              />
                              <span className="text-lg font-medium text-foreground whitespace-nowrap">
                                {parts[1]?.trim()}
                              </span>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center flex-wrap gap-2 leading-loose">
                              <span className="text-lg font-medium text-foreground whitespace-nowrap">
                                <span className="text-muted-foreground mr-1">뜻:</span>
                                {sentence}
                              </span>
                              <Input
                                value={userAnswers[problem.id] || ''}
                                onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                className="w-48 h-10 mx-1 text-center text-base inline-block rounded-xl bg-slate-50 border-border"
                                placeholder="정답 입력"
                                autoComplete="off"
                              />
                            </div>
                          )}
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => problem.audio_url && playAudio(problem.audio_url, problem.id)}
                              disabled={!problem.audio_url}
                              className={`rounded-xl ${!problem.audio_url ? 'opacity-40' : ''}`}
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
                              className="rounded-xl"
                            >
                              <Lightbulb
                                className={`w-4 h-4 mr-1 ${showTranslations[problem.id] ? 'text-warning' : ''}`}
                              />
                              힌트
                            </Button>
                          </div>
                        </div>
                        {showTranslations[problem.id] && problem.translation && (
                          <div className="mt-4 ml-8 px-4 py-3 bg-accent rounded-xl text-sm border border-primary/15 text-foreground">
                            {maskTranslation(problem.translation)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 max-w-5xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrevSet}
            disabled={currentSetIndex === 0}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전 세트
          </Button>

          {currentSetIndex === totalSets - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered()}
              className="rounded-xl bg-primary hover:bg-primary/90"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              결과 확인
            </Button>
          ) : (
            <Button onClick={handleNextSet} disabled={!currentSetAnswered()} className="rounded-xl">
              다음 세트 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
