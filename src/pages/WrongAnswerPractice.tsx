import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { pickRotatedSentence, type BankSentence } from '@/lib/korean/reviewSchedule';
import { maskTranslation } from '@/utils/maskTranslation';
import { QuizStageHeader } from '@/components/quiz/shared/QuizStageHeader';
import {
  assignReviewFormats,
  REVIEW_FORMAT_ORDER,
  type ReviewFormat,
  type ReviewFormatBuckets,
} from '@/lib/korean/reviewTypeAssignment';
import { STAGE_SHORT_LABELS } from '@/types/quiz';
import { MatchUpStage, type MatchUpProblemData, type MatchUpResult } from '@/components/quiz/MatchUpStage';
import { TypeAnswerStage, type TypeAnswerProblemData } from '@/components/quiz/TypeAnswerStage';
import { FillBlankStage, type FillBlankProblem } from '@/components/quiz/FillBlankStage';
import { WordMagnetStage, type WordMagnetProblemData } from '@/components/quiz/WordMagnetStage';
import { SentenceMakingStage } from '@/components/quiz/SentenceMakingStage';
import { SpeakingStage } from '@/components/quiz/SpeakingStage';
import { parseSentenceToItems, assembleForDisplay, stripSpaces } from '@/lib/korean/wordMagnet';

// localStorage 계약 — ReviewToday/WrongAnswerNotebook/StudentDashboard/QuizResult
// 4곳이 전부 이 모양으로 채운다. 이 계약은 이 파일 안에서만 흡수하고 바꾸지 않는다.
interface PracticeProblem {
  id: string;
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  audio_url: string | null;
  source: string;
  in_word_bank?: boolean;
}

// rotateSentences가 만드는, 6개 유형 배정과 채점에 필요한 단어별 정보.
interface ReviewItem {
  id: string;
  word: string;
  /** 완성형 문장(빈칸 없음). 문장을 못 구한 단어는 빈 문자열. */
  sentence: string;
  answer: string;
  hint: string;
  translation: string | null;
  meaning: string | null;
  stage: number;
  level: string;
  audioUrl: string | null;
}

interface RoundResult {
  item: ReviewItem;
  format: ReviewFormat;
  isCorrect: boolean;
  userAnswerDisplay?: string;
}

// SentenceMakingStage/SpeakingStage는 결과 타입을 export하지 않으므로 구조적으로 맞춘 로컬 타입.
interface SentenceAttemptLike {
  sentence?: string;
  isPassed: boolean;
}
interface SpeakingAttemptLike {
  recognizedText?: string;
  isPassed: boolean;
}

// 문장에 빈칸 ( ) 이 있는지 판정 (localStorage 원본 계약 흡수용)
const hasBlank = (sentence: string) => /\(\s*\)|\(\)/.test(sentence);

// 완성형 문장 + 정답에서 빈칸 채우기용 문장을 만든다. 정답이 문장 안에 없으면 null.
const toBlankSentence = (sentence: string, answer: string): string | null => {
  const at = sentence.indexOf(answer);
  if (at < 0) return null;
  return sentence.slice(0, at) + '( )' + sentence.slice(at + answer.length);
};

/**
 * 정답 비교/정규화 헬퍼. 이 파일에 원래 있던 채점 로직(공백 제거 + 대소문자 무시)을
 * type_answer/fill_blank 공용으로 뽑아냈다. 조사·불규칙 활용까지 흡수하는 별도의
 * 형태소 비교 로직은 이 파일에 원래 없었다(toJamo는 "보기 단어 취소선" 매칭에만 쓰였다).
 */
const isAnswerCorrect = (userAnswer: string, correctAnswer: string): boolean => {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(userAnswer) === norm(correctAnswer);
};

function buildBucketsFromFormatMap(
  items: ReviewItem[],
  formatOf: Record<string, ReviewFormat>
): ReviewFormatBuckets<ReviewItem> {
  const buckets: ReviewFormatBuckets<ReviewItem> = {
    matchup: [],
    type_answer: [],
    fill_blank: [],
    word_magnet: [],
    sentence_making: [],
    recording: [],
  };
  items.forEach((it) => {
    const fmt = formatOf[it.id] ?? 'word_magnet';
    buckets[fmt].push(it);
  });
  return buckets;
}

export default function WrongAnswerPractice() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // 이번 세션(또는 재시도 세션)에서 풀고 있는 전체 문항.
  const [sessionItems, setSessionItems] = useState<ReviewItem[]>([]);
  // 문항 id → 배정된 유형. stage 기준 최초 배정 후 재시도에서도 그대로 재사용한다
  // (재시도는 즉시 재드릴이지 새 SRS 세션이 아니므로 assignReviewFormats를 다시 돌리지 않는다).
  const [formatOf, setFormatOf] = useState<Record<string, ReviewFormat>>({});
  const [buckets, setBuckets] = useState<ReviewFormatBuckets<ReviewItem> | null>(null);
  const [roundOrder, setRoundOrder] = useState<ReviewFormat[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);

  const [results, setResults] = useState<Record<string, RoundResult>>({});
  const [fillBlankAnswers, setFillBlankAnswers] = useState<Record<string, string>>({});
  const [stageProgress, setStageProgress] = useState({ current: 0, total: 0, label: '' });

  const [isCompleted, setIsCompleted] = useState(false);
  const [masteredWords, setMasteredWords] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('practice_problems');
    if (!stored) {
      navigate('/wrong-answers');
      return;
    }

    let parsed: PracticeProblem[];
    try {
      parsed = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse practice problems:', e);
      navigate('/wrong-answers');
      return;
    }

    if (parsed.length === 0) {
      navigate('/wrong-answers');
      return;
    }

    const shuffled = [...parsed].sort(() => Math.random() - 0.5);

    void (async () => {
      const items = await buildReviewItems(shuffled);
      const assigned = assignReviewFormats(items, { allowPaidTypes: true });
      const map: Record<string, ReviewFormat> = {};
      REVIEW_FORMAT_ORDER.forEach((fmt) => {
        assigned[fmt].forEach((it) => {
          map[it.id] = fmt;
        });
      });
      setFormatOf(map);
      startSession(items, map);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  /**
   * localStorage 문항을 채점·유형배정에 필요한 완전한 형태로 채운다.
   * wrong_answer_progress(stage)와 sentence_bank(문장·정답·힌트·번역·뜻)를 조인해서
   * 이 자리에서 바로 "이 단어를 어떤 문제 유형으로 낼지" 계산할 수 있는 데이터를 만든다.
   * 은행 조회가 실패하거나 그 단어가 은행에 없으면 localStorage 원본 데이터로 최대한 복원한다.
   */
  const buildReviewItems = async (loaded: PracticeProblem[]): Promise<ReviewItem[]> => {
    const fallback = (p: PracticeProblem): ReviewItem => {
      const blank = hasBlank(p.sentence);
      return {
        id: p.id,
        word: p.word,
        sentence: blank ? p.sentence.replace(/\(\s*\)|\(\)/, p.correct_answer) : '',
        answer: p.correct_answer,
        hint: '',
        translation: p.translation,
        meaning: blank ? null : p.sentence || null,
        stage: 0,
        level: 'A1',
        audioUrl: p.audio_url,
      };
    };

    const words = [...new Set(loaded.map((p) => p.word).filter(Boolean))];
    if (words.length === 0) return loaded.map(fallback);

    try {
      const [{ data: progress }, { data: bank }] = await Promise.all([
        supabase.from('wrong_answer_progress').select('word, stage, level').in('word', words),
        supabase
          .from('sentence_bank')
          .select('word, level, seq, sentence, answer, hint, translation, meaning, source')
          .in('word', words),
      ]);

      const progressOf = new Map(
        (progress ?? []).map((r) => [r.word, { stage: r.stage ?? 0, level: r.level ?? null }])
      );
      const bankByWord = new Map<string, BankSentence[]>();
      (bank ?? []).forEach((row) => {
        const list = bankByWord.get(row.word) ?? [];
        list.push(row as BankSentence);
        bankByWord.set(row.word, list);
      });

      return loaded.map((p) => {
        const base = fallback(p);
        const prog = progressOf.get(p.word);
        const stage = prog?.stage ?? 0;
        const candidates = bankByWord.get(p.word) ?? [];
        const picked = pickRotatedSentence(candidates, stage, prog?.level ?? null);
        const anyBankRow = candidates[0];

        if (picked) {
          return {
            ...base,
            sentence: picked.sentence,
            answer: picked.answer,
            hint: picked.hint ?? '',
            translation: picked.translation,
            meaning: picked.meaning ?? anyBankRow?.meaning ?? base.meaning,
            stage,
            level: prog?.level ?? picked.level ?? base.level,
            // 은행 문장은 이 퀴즈에서 만든 게 아니라 음성이 없다.
            audioUrl: null,
          };
        }

        return {
          ...base,
          meaning: base.meaning ?? anyBankRow?.meaning ?? null,
          stage,
          level: prog?.level ?? anyBankRow?.level ?? base.level,
        };
      });
    } catch (e) {
      // 교체는 부가 기능이다. 실패해도 원래 문항으로 연습은 계속된다.
      console.error('Failed to enrich review items:', e);
      return loaded.map(fallback);
    }
  };

  const startSession = (items: ReviewItem[], map: Record<string, ReviewFormat>) => {
    const shuffledItems = [...items].sort(() => Math.random() - 0.5);
    const b = buildBucketsFromFormatMap(shuffledItems, map);
    const order = REVIEW_FORMAT_ORDER.filter((fmt) => b[fmt].length > 0);
    setSessionItems(shuffledItems);
    setBuckets(b);
    setRoundOrder(order);
    setRoundIndex(0);
    setResults({});
    setFillBlankAnswers({});
    setIsCompleted(false);
    setMasteredWords([]);
  };

  const finalizeSession = async (merged: Record<string, RoundResult>) => {
    setIsCompleted(true);
    const finalResults = sessionItems
      .map((it) => merged[it.id])
      .filter((r): r is RoundResult => !!r);

    try {
      const { data: mastered } = await supabase.rpc('update_wa_progress', {
        _items: finalResults.map((r) => ({ word: r.item.word, correct: r.isCorrect })),
      });
      setMasteredWords(
        Array.isArray(mastered) ? mastered.filter((w): w is string => typeof w === 'string') : []
      );
    } catch (e) {
      console.error('Failed to update wrong answer progress:', e);
    }
  };

  const completeRound = (entries: Record<string, RoundResult>) => {
    const merged = { ...results, ...entries };
    setResults(merged);
    if (roundIndex + 1 >= roundOrder.length) {
      void finalizeSession(merged);
    } else {
      setRoundIndex((i) => i + 1);
    }
  };

  const handleProgressUpdate = (current: number, total: number, label: string) => {
    setStageProgress({ current, total, label });
  };

  const handleMatchupComplete = (resultsMap: Record<string, MatchUpResult>) => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.matchup ?? []).forEach((it) => {
      const r = resultsMap[it.id];
      entries[it.id] = {
        item: it,
        format: 'matchup',
        isCorrect: !!r?.isCorrect,
        userAnswerDisplay: r?.selectedMeaning,
      };
    });
    completeRound(entries);
  };

  const handleTypeAnswerComplete = (answers: Record<string, string>) => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.type_answer ?? []).forEach((it) => {
      const userAnswer = answers[it.id] || '';
      entries[it.id] = {
        item: it,
        format: 'type_answer',
        isCorrect: isAnswerCorrect(userAnswer, it.answer),
        userAnswerDisplay: userAnswer,
      };
    });
    completeRound(entries);
  };

  const handleFillBlankComplete = () => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.fill_blank ?? []).forEach((it) => {
      const userAnswer = fillBlankAnswers[it.id] || '';
      entries[it.id] = {
        item: it,
        format: 'fill_blank',
        isCorrect: isAnswerCorrect(userAnswer, it.answer),
        userAnswerDisplay: userAnswer,
      };
    });
    setFillBlankAnswers({});
    completeRound(entries);
  };

  const handleWordMagnetComplete = (answers: Record<string, string>) => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.word_magnet ?? []).forEach((it) => {
      const userAnswer = answers[it.id] || '';
      const correctAssembled = assembleForDisplay(parseSentenceToItems(it.sentence));
      entries[it.id] = {
        item: it,
        format: 'word_magnet',
        isCorrect: stripSpaces(userAnswer) === stripSpaces(correctAssembled),
        userAnswerDisplay: userAnswer,
      };
    });
    completeRound(entries);
  };

  const handleSentenceMakingComplete = (resultsMap: Record<string, SentenceAttemptLike[]>) => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.sentence_making ?? []).forEach((it) => {
      const attempts = resultsMap[it.id] ?? [];
      const last = attempts[attempts.length - 1];
      entries[it.id] = {
        item: it,
        format: 'sentence_making',
        isCorrect: !!last?.isPassed,
        userAnswerDisplay: last?.sentence,
      };
    });
    completeRound(entries);
  };

  const handleSpeakingComplete = (resultsMap: Record<string, SpeakingAttemptLike[]>) => {
    const entries: Record<string, RoundResult> = {};
    (buckets?.recording ?? []).forEach((it) => {
      const attempts = resultsMap[it.id] ?? [];
      const last = attempts[attempts.length - 1];
      entries[it.id] = {
        item: it,
        format: 'recording',
        isCorrect: !!last?.isPassed,
        userAnswerDisplay: last?.recognizedText,
      };
    });
    completeRound(entries);
  };

  // 방금 틀린 문제를 방금 풀었던 것과 같은 유형으로 다시 보여준다 — 새 SRS 세션이 아니라
  // 즉시 재드릴이므로 assignReviewFormats를 다시 돌리지 않는다.
  const handleRetry = () => {
    startSession(sessionItems, formatOf);
  };

  const handleRetryWrongOnly = () => {
    const wrong = sessionItems.filter((it) => results[it.id] && !results[it.id].isCorrect);
    if (wrong.length === 0) return;
    startSession(wrong, formatOf);
  };

  const score = useMemo(
    () => sessionItems.filter((it) => results[it.id]?.isCorrect).length,
    [sessionItems, results]
  );

  const currentFormat = roundOrder[roundIndex];

  const globalStages = useMemo(
    () => roundOrder.map((fmt) => ({ id: fmt, label: STAGE_SHORT_LABELS[fmt] })),
    [roundOrder]
  );

  if (loading || !buckets) {
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
                <h1 className="text-2xl font-bold mb-2">복습 완료!</h1>
                <p className="text-4xl font-bold text-primary mb-4">
                  {score} / {sessionItems.length}
                </p>
                <p className="text-muted-foreground mb-6">
                  정답률 {sessionItems.length > 0 ? Math.round((score / sessionItems.length) * 100) : 0}%
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={handleRetry} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    다시 풀기
                  </Button>
                  {score < sessionItems.length && (
                    <Button onClick={handleRetryWrongOnly} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      틀린 {sessionItems.length - score}개만 다시
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
            {sessionItems.map((item, index) => {
              const result = results[item.id];
              if (!result) return null;
              return (
                <Card
                  key={item.id}
                  className={`border-l-4 ${result.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-primary">{index + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {result.isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">{item.word}</span>
                          <Badge variant="outline" className="text-xs">
                            {STAGE_SHORT_LABELS[result.format]}
                          </Badge>
                        </div>
                        {item.sentence && (
                          <p className="text-sm text-muted-foreground">{item.sentence}</p>
                        )}
                        <p className="text-sm">
                          <span className="text-muted-foreground mr-1">정답:</span>
                          <span className="font-bold text-green-600">
                            {result.format === 'matchup' ? item.meaning ?? item.answer : item.answer}
                          </span>
                        </p>
                        {!result.isCorrect && (
                          <p className="text-sm text-red-500">
                            내 답: {result.userAnswerDisplay || '(입력 없음)'}
                          </p>
                        )}
                        {item.translation && (
                          <p className="text-xs text-muted-foreground">{item.translation}</p>
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

  const renderStage = () => {
    if (!currentFormat || !buckets) return null;
    const isFirstRound = roundIndex === 0;
    const stageOnBack = isFirstRound ? () => navigate('/wrong-answers') : undefined;
    const backLabel = '오답 노트로';

    switch (currentFormat) {
      case 'matchup': {
        const problems: MatchUpProblemData[] = buckets.matchup.map((it) => ({
          id: it.id,
          korean_text: it.word,
          meaning_text: it.meaning ?? '',
        }));
        return (
          <MatchUpStage
            problems={problems}
            wordsPerSet={5}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleMatchupComplete}
            onBack={stageOnBack}
            backLabel={backLabel}
          />
        );
      }
      case 'type_answer': {
        const problems: TypeAnswerProblemData[] = buckets.type_answer.map((it) => ({
          id: it.id,
          prompt: it.meaning ?? '',
        }));
        return (
          <TypeAnswerStage
            problems={problems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleTypeAnswerComplete}
            onBack={stageOnBack}
            backLabel={backLabel}
          />
        );
      }
      case 'fill_blank': {
        const problems: FillBlankProblem[] = buckets.fill_blank.map((it) => ({
          id: it.id,
          word: it.word,
          sentence: toBlankSentence(it.sentence, it.answer) ?? it.sentence,
          hint: it.hint,
          translation: it.translation ?? '',
          sentence_audio_url: it.audioUrl ?? undefined,
        }));
        return (
          <FillBlankStage
            problems={problems}
            wordsPerSet={5}
            isAnonymous={false}
            hasNextStage={roundIndex < roundOrder.length - 1}
            userAnswers={fillBlankAnswers}
            onAnswerChange={(id, value) => setFillBlankAnswers((prev) => ({ ...prev, [id]: value }))}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleFillBlankComplete}
          />
        );
      }
      case 'word_magnet': {
        const problems: WordMagnetProblemData[] = buckets.word_magnet.map((it) => ({
          id: it.id,
          translation: it.translation ?? it.meaning ?? '',
          items: parseSentenceToItems(it.sentence),
        }));
        return (
          <WordMagnetStage
            problems={problems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleWordMagnetComplete}
            onBack={stageOnBack}
            backLabel={backLabel}
          />
        );
      }
      case 'sentence_making': {
        const problems = buckets.sentence_making.map((it) => ({
          id: it.id,
          word: it.word,
          word_meaning: it.meaning,
        }));
        const difficulty = buckets.sentence_making[0]?.level ?? 'A1';
        return (
          <SentenceMakingStage
            quizId="srs-review"
            problems={problems}
            difficulty={difficulty}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleSentenceMakingComplete}
            onBack={stageOnBack}
            backLabel={backLabel}
          />
        );
      }
      case 'recording': {
        const problems = buckets.recording.map((it) => ({
          id: it.id,
          sentence: it.sentence,
          mode: 'read' as const,
          sentenceAudioUrl: it.audioUrl ?? undefined,
          translation: it.translation ?? undefined,
        }));
        return (
          <SpeakingStage
            quizId="srs-review"
            problems={problems}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleSpeakingComplete}
            onBack={stageOnBack}
            backLabel={backLabel}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <Link to="/wrong-answers">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h1 className="font-bold text-lg">오늘의 복습</h1>
              </div>

              {globalStages.length > 1 && (
                <div className="hidden sm:flex flex-1 justify-center items-center gap-1 lg:gap-2">
                  {globalStages.map((stage, idx) => (
                    <div key={stage.id} className="flex items-center gap-1 lg:gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                          idx === roundIndex
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : idx < roundIndex
                              ? 'bg-primary/20 text-primary'
                              : 'text-muted-foreground bg-card ring-1 ring-inset ring-border'
                        }`}
                      >
                        <span
                          className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs shadow-sm font-bold ${
                            idx === roundIndex
                              ? 'bg-white text-primary'
                              : idx < roundIndex
                                ? 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="hidden md:inline-block px-1">{stage.label}</span>
                      </div>
                      {idx < globalStages.length - 1 && <div className="w-2 sm:w-6 lg:w-8 h-px bg-border" />}
                    </div>
                  ))}
                </div>
              )}

              <span className="shrink-0 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm border border-slate-200">
                {roundIndex + 1}/{roundOrder.length}
              </span>
            </div>

            {stageProgress.total > 0 && (
              <div className="flex items-center justify-between gap-4 w-full px-1">
                <Progress value={(stageProgress.current / stageProgress.total) * 100} className="flex-1 h-2.5" />
                <span className="shrink-0 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm border border-slate-200">
                  {stageProgress.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">{renderStage()}</div>
    </div>
  );
}
