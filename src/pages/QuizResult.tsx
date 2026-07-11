import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Home, FileText, Pencil, Mic, Play, Pause, CheckCircle, XCircle, HelpCircle, Lightbulb, Volume2, Link2, Keyboard, Magnet, Ear } from 'lucide-react';
import { QuizReviewCard } from '@/components/quiz/QuizReviewCard';
import { WordPairResultCard } from '@/components/quiz/shared/WordPairResultCard';
import { WordMagnetResultCard } from '@/components/quiz/shared/WordMagnetResultCard';
import { FeedbackPromptCard } from '@/components/feedback/FeedbackPromptCard';
import { renderSentenceWithDiff, renderModelAnswerWithDiff, renderSentenceWithFeedback, renderRecognizedText, generateSpeakingFeedback, type SpeakingFeedbackInput } from '@/components/quiz/quizResultUtils';
import type { MatchUpProblemData } from '@/components/quiz/MatchUpStage';
import type { TypeAnswerGradeResult } from '@/components/quiz/TypeAnswerStage';
import type { WordMagnetGradeResult } from '@/components/quiz/WordMagnetResultStage';

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
}

interface UserAnswer {
  problemId: string;
  userAnswer: string;
  isCorrect: boolean;
}

interface SentenceMakingAnswer {
  id: string;
  problem_id: string;
  attempt_number: number;
  student_sentence: string;
  word_usage_score: number;
  grammar_score: number;
  naturalness_score: number;
  total_score: number;
  ai_feedback: string;
  model_answer: string;
  is_passed: boolean;
  is_skipped?: boolean;
}

interface SentenceMakingProblem {
  id: string;
  problem_id: string;
  word: string;
  word_meaning?: string;
  model_answer: string;
}

interface RecordingAnswer {
  id: string;
  problem_id: string;
  attempt_number: number;
  recording_url: string;
  pronunciation_score: number;
  accuracy_score: number;
  fluency_score: number;
  completeness_score: number;
  prosody_score: number;
  overall_score: number;
  word_level_feedback: any[];
  is_passed: boolean;
}

interface RecordingProblem {
  id: string;
  problem_id: string;
  sentence: string;
  mode: 'read' | 'listen';
  sentence_audio_url?: string;
  translation?: string;
}

interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  problems: Problem[];
  words_per_set: number;
  matchup_enabled?: boolean;
  type_answer_enabled?: boolean;
  word_magnet_enabled?: boolean;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
}

interface Result {
  id: string;
  score: number;
  total_questions: number;
  answers: UserAnswer[];
  completed_at: string;
  fill_blank_score?: number;
  fill_blank_total?: number;
  matchup_score?: number;
  matchup_total?: number;
  type_answer_score?: number;
  type_answer_total?: number;
  word_magnet_score?: number;
  word_magnet_total?: number;
  sentence_making_score?: number;
  sentence_making_total?: number;
  recording_score?: number;
  recording_total?: number;
}

interface MatchupAnswerRow {
  problem_id: string;
  selected_meaning: string;
  is_correct: boolean;
}


export default function QuizResult() {
  const { id, resultId } = useParams<{ id: string; resultId: string }>();
  const { user, role, loading } = useAuth();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 새 퀴즈 유형 데이터
  const [matchupProblems, setMatchupProblems] = useState<MatchUpProblemData[]>([]);
  const [matchupAnswers, setMatchupAnswers] = useState<MatchupAnswerRow[]>([]);
  const [typeAnswerDetail, setTypeAnswerDetail] = useState<TypeAnswerGradeResult[]>([]);
  const [wordMagnetDetail, setWordMagnetDetail] = useState<WordMagnetGradeResult[]>([]);
  const [sentenceMakingProblems, setSentenceMakingProblems] = useState<SentenceMakingProblem[]>([]);
  const [sentenceMakingAnswers, setSentenceMakingAnswers] = useState<SentenceMakingAnswer[]>([]);
  const [recordingProblems, setRecordingProblems] = useState<RecordingProblem[]>([]);
  const [recordingAnswers, setRecordingAnswers] = useState<RecordingAnswer[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showRecordingTrans, setShowRecordingTrans] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user && id && resultId) {
      fetchData();
    }
  }, [user, id, resultId]);

  const fetchData = async () => {
    // Fetch quiz
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();

    // Fetch result
    const { data: resultData } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (quizData && resultData) {
      // Fetch audio URLs from quiz_problems table
      const { data: problemsData } = await supabase
        .from('quiz_problems')
        .select('problem_id, sentence_audio_url')
        .eq('quiz_id', id);

      // Create audio URL map
      const audioMap = new Map(
        problemsData?.map(p => [p.problem_id, p.sentence_audio_url]) || []
      );

      // Add audio URLs to problems
      const problemsWithAudio = (quizData.problems as any[]).map(problem => ({
        ...problem,
        sentence_audio_url: audioMap.get(problem.id) || problem.sentence_audio_url,
      }));

      setQuiz({ ...quizData, problems: problemsWithAudio } as unknown as Quiz);
      setResult(resultData as unknown as Result);

      // 짝 맞추기 데이터 로드
      if (quizData.matchup_enabled) {
        const { data: muProblems } = await supabase
          .from('matchup_problems')
          .select('problem_id, korean_text, meaning_text')
          .eq('quiz_id', id);
        if (muProblems) {
          setMatchupProblems(muProblems.map((p: any) => ({
            id: p.problem_id,
            korean_text: p.korean_text,
            meaning_text: p.meaning_text,
          })));
        }

        const { data: muAnswers } = await supabase
          .from('matchup_answers')
          .select('problem_id, selected_meaning, is_correct')
          .eq('result_id', resultId);
        if (muAnswers) setMatchupAnswers(muAnswers as MatchupAnswerRow[]);
      }

      // 답 입력 데이터 로드 — 정답 포함 조회는 본인 결과에 한해 RPC로만 가능
      if (quizData.type_answer_enabled) {
        const { data: taDetail } = await supabase.rpc('get_type_answer_result_detail', {
          _result_id: resultId,
        });
        if (taDetail) setTypeAnswerDetail(taDetail as TypeAnswerGradeResult[]);
      }

      // 워드마그넷 데이터 로드 — 정답 포함 조회는 본인 결과에 한해 RPC로만 가능
      if (quizData.word_magnet_enabled) {
        const { data: wmDetail } = await supabase.rpc('get_word_magnet_result_detail', {
          _result_id: resultId,
        });
        if (wmDetail) setWordMagnetDetail(wmDetail as WordMagnetGradeResult[]);
      }

      // 문장 만들기 퀴즈 데이터 로드
      if (quizData.sentence_making_enabled) {
        const { data: smProblems } = await supabase
          .from('sentence_making_problems')
          .select('id, problem_id, word, word_meaning, model_answer')
          .eq('quiz_id', id);

        const { data: smAnswers } = await supabase
          .from('sentence_making_answers')
          .select('*')
          .eq('result_id', resultId)
          .order('problem_id')
          .order('attempt_number');

        if (smProblems) setSentenceMakingProblems(smProblems as any[]);
        if (smAnswers) setSentenceMakingAnswers(smAnswers as SentenceMakingAnswer[]);
      }

      // 녹음 퀴즈 데이터 로드
      if (quizData.recording_enabled) {
        const { data: recProblems } = await supabase
          .from('recording_problems')
          .select('id, problem_id, sentence, mode, sentence_audio_url, translation')
          .eq('quiz_id', id);

        const { data: recAnswers } = await supabase
          .from('recording_answers')
          .select('*')
          .eq('result_id', resultId)
          .order('problem_id')
          .order('attempt_number');

        if (recProblems) setRecordingProblems(recProblems as any[]);
        if (recAnswers) setRecordingAnswers(recAnswers as RecordingAnswer[]);
      }
    }
    setIsLoading(false);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz || !result) return null;

  // 유형별 점수 계산
  const hasFillBlankType = quiz.fill_blank_enabled !== false;
  const fillBlankScore = hasFillBlankType ? (result.fill_blank_score ?? result.score) : 0;
  const fillBlankTotal = hasFillBlankType ? (result.fill_blank_total ?? result.total_questions) : 0;
  const fillBlankPercentage = fillBlankTotal > 0 ? Math.round((fillBlankScore / fillBlankTotal) * 100) : 0;

  const smScore = result.sentence_making_score ?? 0;
  const smTotal = result.sentence_making_total ?? 0;
  const smPercentage = smTotal > 0 ? Math.round((smScore / smTotal) * 100) : 0;

  const recScore = result.recording_score ?? 0;
  const recTotal = result.recording_total ?? 0;
  const recPercentage = recTotal > 0 ? Math.round((recScore / recTotal) * 100) : 0;

  const muScore = result.matchup_score ?? 0;
  const muTotal = result.matchup_total ?? 0;
  const muPercentage = muTotal > 0 ? Math.round((muScore / muTotal) * 100) : 0;

  const taScore = result.type_answer_score ?? 0;
  const taTotal = result.type_answer_total ?? 0;
  const taPercentage = taTotal > 0 ? Math.round((taScore / taTotal) * 100) : 0;

  const wmScore = result.word_magnet_score ?? 0;
  const wmTotal = result.word_magnet_total ?? 0;
  const wmPercentage = wmTotal > 0 ? Math.round((wmScore / wmTotal) * 100) : 0;

  // 전체 점수 계산
  const totalScore = fillBlankScore + muScore + taScore + wmScore + smScore + recScore;
  const totalQuestions = fillBlankTotal + muTotal + taTotal + wmTotal + smTotal + recTotal;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
  const isGood = percentage >= 80;
  const isMedium = percentage >= 50 && percentage < 80;
  const wrongCount = totalQuestions - totalScore;

  // 활성화된 퀴즈 유형 확인
  const hasFillBlank = fillBlankTotal > 0;
  const hasMatchup = !!quiz.matchup_enabled && muTotal > 0;
  const hasTypeAnswer = !!quiz.type_answer_enabled && taTotal > 0;
  const hasWordMagnet = !!quiz.word_magnet_enabled && wmTotal > 0;
  const hasSentenceMaking = quiz.sentence_making_enabled && smTotal > 0;
  const hasRecording = quiz.recording_enabled && recTotal > 0;
  const multipleTypes = [hasFillBlank, hasMatchup, hasTypeAnswer, hasWordMagnet, hasSentenceMaking, hasRecording].filter(Boolean).length > 1;

  const matchupAnswerMap: Record<string, MatchupAnswerRow> = {};
  for (const a of matchupAnswers) matchupAnswerMap[a.problem_id] = a;

  const getAnswerForProblem = (problemId: string) => {
    return result.answers.find(a => (a as any).problemId === problemId || (a as any).problem_id === problemId || (a as any).id === problemId);
  };

  // 문장 만들기 답안 그룹화 (문제별)
  const getSentenceMakingAnswersForProblem = (problemId: string) => {
    return sentenceMakingAnswers.filter(a => a.problem_id === problemId);
  };

  // 녹음 답안 그룹화 (문제별)
  const getRecordingAnswersForProblem = (problemId: string) => {
    return recordingAnswers.filter(a => a.problem_id === problemId);
  };

  // 오디오 재생 핸들러
  const handlePlayAudio = (url: string) => {
    if (playingAudio === url) {
      setPlayingAudio(null);
      return;
    }
    setPlayingAudio(url);
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
  };

  // Group problems by set
  const wordsPerSet = quiz.words_per_set || 5;
  const groupedProblems: Problem[][] = [];
  for (let i = 0; i < quiz.problems.length; i += wordsPerSet) {
    groupedProblems.push(quiz.problems.slice(i, i + wordsPerSet));
  }

  // 성취도 기준 점수색 헬퍼
  const scoreColor = (pct: number) =>
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";

  // 유형별 리뷰 콘텐츠 — 탭 뷰(다중 유형)와 단일 유형 화면에서 그대로 재사용
  const matchupContent = (
    <div className="space-y-4 mt-8">
      {matchupProblems.map((p, idx) => {
        const a = matchupAnswerMap[p.id];
        return (
          <WordPairResultCard
            key={p.id}
            number={idx + 1}
            prompt={p.korean_text}
            correctAnswer={p.meaning_text}
            userAnswer={a?.selected_meaning || ""}
            isCorrect={!!a?.is_correct}
          />
        );
      })}
    </div>
  );

  const typeAnswerContent = (
    <div className="space-y-4 mt-8">
      {typeAnswerDetail.map((r, idx) => (
        <WordPairResultCard
          key={r.problemId}
          number={idx + 1}
          prompt={r.prompt}
          correctAnswer={r.correctAnswer}
          userAnswer={r.userAnswer}
          isCorrect={r.isCorrect}
          isSkipped={r.skipped}
        />
      ))}
    </div>
  );

  const wordMagnetContent = (
    <div className="space-y-4 mt-8">
      {wordMagnetDetail.map((r, idx) => (
        <WordMagnetResultCard key={r.problemId} result={r} index={idx} />
      ))}
    </div>
  );

  const sentenceMakingContent = (
    <div className="space-y-4 mt-8">
      {sentenceMakingProblems.map((problem, idx) => {
        const answers = getSentenceMakingAnswersForProblem(problem.id);
        const lastAttempt = answers[answers.length - 1];

        // Handle both camelCase and snake_case depending on how the data was stored
        const isSkipped = (lastAttempt as any)?.skipped ?? (lastAttempt as any)?.is_skipped ?? false;
        const isPassed = (lastAttempt as any)?.isPassed ?? lastAttempt?.is_passed ?? false;
        const totalScore = (lastAttempt as any)?.totalScore ?? lastAttempt?.total_score ?? 0;
        const isPerfect = totalScore === 100;

        const studentSentence = (lastAttempt as any)?.sentence ?? lastAttempt?.student_sentence ?? "(입력 없음)";
        const rawFeedback = (lastAttempt as any)?.feedback ?? lastAttempt?.ai_feedback ?? "";
        const cleanFeedback = rawFeedback.replace(/Model Answer:\s*.*/i, '').trim();

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                    isSkipped ? "bg-muted-foreground" : isPerfect ? "bg-success" : "bg-primary"
                  }`}>
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700">
                    {problem.word}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isSkipped ? (
                    <HelpCircle className="w-5 h-5 text-muted-foreground" />
                  ) : isPassed ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-warning" />
                  )}
                </div>
              </div>

              {isSkipped ? (
                <div className="mb-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-muted text-muted-foreground">
                      모름
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed text-muted-foreground">문제를 건너뛰었어요</h3>
                  </div>
                  {lastAttempt?.model_answer && (
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                        추천 문장
                      </span>
                      <h3 className="text-lg leading-relaxed">{lastAttempt.model_answer}</h3>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 ${
                      isPerfect ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"
                    }`}>
                      내 답변
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed">
                      {renderSentenceWithDiff(studentSentence, lastAttempt?.model_answer,
                        isPerfect || !lastAttempt?.model_answer || studentSentence.trim() === lastAttempt.model_answer.trim()
                      )}
                    </h3>
                  </div>

                  {(!isPerfect && lastAttempt?.model_answer && lastAttempt.model_answer.trim() !== studentSentence.trim()) && (
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                        추천 문장
                      </span>
                      <h3 className="text-lg leading-relaxed">
                        {renderModelAnswerWithDiff(lastAttempt.model_answer, studentSentence)}
                      </h3>
                    </div>
                  )}
                </div>
              )}

              {!isSkipped && cleanFeedback && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{cleanFeedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const recordingContent = (
    <div className="space-y-4">
      {recordingProblems.map((problem, idx) => {
        const answers = getRecordingAnswersForProblem(problem.id);
        const lastAttempt = answers[answers.length - 1];
        const isPassed = (lastAttempt as any)?.isPassed ?? lastAttempt?.is_passed ?? false;
        const wordFeedback = (lastAttempt as any)?.wordLevelFeedback ?? lastAttempt?.word_level_feedback ?? [];
        const recognizedText = (lastAttempt as any)?.recognizedText ?? (lastAttempt as any)?.recognized_text;
        const speakingFeedbackInput: SpeakingFeedbackInput = lastAttempt ? {
          isPassed,
          overallScore: (lastAttempt as any)?.overallScore ?? lastAttempt?.overall_score ?? 0,
          wordLevelFeedback: wordFeedback,
        } : { isPassed: false, overallScore: 0 };

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isPassed ? "bg-success" : "bg-destructive"}`}>
                    {idx + 1}
                  </span>
                  <div className={`text-sm font-semibold px-3 py-1 rounded-full ${problem.mode === "listen" ? "text-orange-700 bg-orange-100" : "text-primary/80 bg-primary/10"}`}>
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
                {problem.mode === "listen" && problem.sentence_audio_url && (
                  <div className="flex items-center gap-0 sm:gap-4">
                    <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">원어민 음성</p>
                    <button
                      onClick={() => handlePlayAudio(problem.sentence_audio_url)}
                      className="flex-1 flex items-center justify-center bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-2xl py-3 px-4 transition-colors"
                    >
                      <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingAudio === problem.sentence_audio_url ? "text-cyan-600 animate-pulse" : "text-cyan-500"}`} />
                      <div className="flex gap-[3px] items-center h-5">
                        {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                          <div
                            key={`orig-${i}`}
                            className={`w-[3px] rounded-full transition-all duration-300 ${playingAudio === problem.sentence_audio_url ? "bg-cyan-500 animate-pulse" : "bg-cyan-200"}`}
                            style={{ height: `${h * 3}px`, opacity: playingAudio === problem.sentence_audio_url ? (h / 8) + 0.2 : 1 }}
                          />
                        ))}
                      </div>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-0 sm:gap-4">
                  <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">내 발음</p>
                  <button
                    onClick={() => lastAttempt?.recording_url && handlePlayAudio(lastAttempt.recording_url)}
                    disabled={!lastAttempt?.recording_url}
                    className={`flex-1 flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-2xl py-3 px-4 transition-colors ${!lastAttempt?.recording_url ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingAudio === lastAttempt?.recording_url ? "text-amber-600 animate-pulse" : "text-amber-500"}`} />
                    <div className="flex gap-[3px] items-center h-5">
                      {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                        <div
                          key={`read-${i}`}
                          className={`w-[3px] rounded-full transition-all duration-300 ${playingAudio === lastAttempt?.recording_url ? "bg-amber-500 animate-pulse" : "bg-amber-200"}`}
                          style={{ height: `${h * 3}px`, opacity: playingAudio === lastAttempt?.recording_url ? (h / 8) + 0.2 : 1 }}
                        />
                      ))}
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5 space-y-4 px-1 sm:px-3">
                <div className="text-lg">
                  {renderSentenceWithFeedback(problem.sentence, wordFeedback, isPassed, recognizedText)}
                </div>

                {recognizedText && (
                  <div className="flex items-start gap-2">
                    <Ear className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    <p className="text-base">
                      {renderRecognizedText(recognizedText, problem.sentence)}
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed break-keep">{lastAttempt ? generateSpeakingFeedback(speakingFeedbackInput) : ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const fillBlankContent = (
    <div className="space-y-8">
      {groupedProblems.map((setProblems, setIdx) => (
        <div key={setIdx} className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="text-lg font-bold text-foreground">세트 {setIdx + 1}</span>
            <div className="h-px bg-border flex-1" />
          </div>
          <div className="grid gap-4">
            {setProblems.map((problem, idx) => {
              const userAnswer = getAnswerForProblem(problem.id);
              const isCorrect = userAnswer?.isCorrect || false;
              const problemNumber = setIdx * wordsPerSet + idx + 1;
              return (
                <QuizReviewCard
                  key={problem.id}
                  problem={problem}
                  userAnswer={userAnswer?.userAnswer}
                  isCorrect={isCorrect}
                  problemNumber={problemNumber}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Result Header */}
          <div className="flex flex-col items-center justify-center py-6 mb-8 mt-2 animate-fade-in">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-500 mb-6">{quiz.title}</h1>
            <div className="relative inline-flex items-center justify-center mb-4">
              <p className="text-5xl sm:text-6xl font-extrabold text-primary drop-shadow-sm tracking-tight text-center">
                {percentage}%
              </p>
              {percentage >= 100 && (
                <span className="absolute -top-4 -right-8 text-4xl animate-bounce">🎉</span>
              )}
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm px-6 py-2.5 rounded-full shadow-sm border border-slate-100 mt-2">
              <p className="text-lg sm:text-xl font-bold text-slate-700 text-center">
                {totalQuestions}문제 중 {totalScore}문제를 맞혔어요!
              </p>
            </div>
            
            <p className="mt-4 text-base sm:text-lg font-bold text-slate-500">
              {percentage >= 100 ? '완벽해요! 모든 문제를 맞혔어요 🎉'
               : isGood ? `정말 잘했어요! 틀린 ${wrongCount}개만 복습하면 완벽해요 👏`
               : isMedium ? `${totalScore}개는 이미 알아요. 틀린 ${wrongCount}개만 다시 볼까요? 💪`
               : `괜찮아요, ${totalScore}개는 맞혔어요. 오답노트로 차근차근 복습해요 📚`}
            </p>
          </div>

          {/* 탭 기반 상세 리뷰 */}
          {multipleTypes ? (
            <Tabs defaultValue={hasMatchup ? "matchup" : hasTypeAnswer ? "type_answer" : hasFillBlank ? "fill_blank" : hasWordMagnet ? "word_magnet" : hasSentenceMaking ? "sentence_making" : "recording"} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-8 h-auto p-1.5 bg-slate-100/60 rounded-2xl gap-1">
                {hasMatchup && (
                  <TabsTrigger value="matchup" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Link2 className="w-4 h-4" />
                      <span className="text-sm">짝 맞추기</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(muPercentage)}`}>{muPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasTypeAnswer && (
                  <TabsTrigger value="type_answer" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Keyboard className="w-4 h-4" />
                      <span className="text-sm">단어 받아쓰기</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(taPercentage)}`}>{taPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasFillBlank && (
                  <TabsTrigger value="fill_blank" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">빈칸 채우기</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(fillBlankPercentage)}`}>{fillBlankPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasWordMagnet && (
                  <TabsTrigger value="word_magnet" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Magnet className="w-4 h-4" />
                      <span className="text-sm">문장 순서 맞추기</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(wmPercentage)}`}>{wmPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasSentenceMaking && (
                  <TabsTrigger value="sentence_making" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Pencil className="w-4 h-4" />
                      <span className="text-sm">문장 만들기</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(smPercentage)}`}>{smPercentage}%</span>
                  </TabsTrigger>
                )}
                {hasRecording && (
                  <TabsTrigger value="recording" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
                    <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
                      <Mic className="w-4 h-4" />
                      <span className="text-sm">말하기 연습</span>
                    </div>
                    <span className={`text-xl font-bold ${scoreColor(recPercentage)}`}>{recPercentage}%</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* 짝 맞추기 리뷰 */}
              {hasMatchup && (
                <TabsContent value="matchup">
                  {matchupContent}
                </TabsContent>
              )}

              {/* 단어 받아쓰기 리뷰 */}
              {hasTypeAnswer && (
                <TabsContent value="type_answer">
                  {typeAnswerContent}
                </TabsContent>
              )}

              {/* 빈칸 채우기 리뷰 */}
              {hasFillBlank && (
                <TabsContent value="fill_blank">
                  {fillBlankContent}
                </TabsContent>
              )}

              {/* 문장 순서 맞추기 리뷰 */}
              {hasWordMagnet && (
                <TabsContent value="word_magnet">
                  {wordMagnetContent}
                </TabsContent>
              )}

              {/* 문장 만들기 리뷰 */}
              {hasSentenceMaking && (
                <TabsContent value="sentence_making">
                  {sentenceMakingContent}
                </TabsContent>
              )}

              {/* 녹음 리뷰 */}
              {hasRecording && (
                <TabsContent value="recording">
                  {recordingContent}
                </TabsContent>
              )}
            </Tabs>
          ) : (
            /* 단일 유형일 때 */
            <div className="mt-4">
              {hasMatchup && matchupContent}
              {hasTypeAnswer && typeAnswerContent}
              {hasFillBlank && fillBlankContent}
              {hasWordMagnet && wordMagnetContent}
              {hasSentenceMaking && sentenceMakingContent}
              {hasRecording && recordingContent}
            </div>
          )}

          {/* 피드백 별점 카드 */}
          <div className="mt-12">
            <FeedbackPromptCard context="quiz_result" />
          </div>

          {/* 하단 버튼 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 mb-20">
            {wrongCount > 0 && (
              <Link to="/wrong-answers">
                <Button className="w-full sm:w-auto min-w-[200px] h-14 text-base rounded-xl font-bold" size="lg">
                  틀린 단어 {wrongCount}개 다시 풀기
                </Button>
              </Link>
            )}
            <Link to="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto min-w-[200px] h-14 text-base rounded-xl font-medium" size="lg">
                <Home className="w-4 h-4 mr-2" /> 대시보드로 돌아가기
              </Button>
            </Link>
            <Link to="/quizzes">
              <Button className="w-full sm:w-auto min-w-[200px] h-14 text-base rounded-xl bg-primary hover:bg-primary/90 shadow-md font-bold" size="lg">
                새 퀴즈 풀기 ✨
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
