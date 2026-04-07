import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, CheckCircle, XCircle, Volume2, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";
import { useQuizResultDetail } from "@/hooks/useQuizResultDetail";
import type {
  SentenceMakingProblemDetail,
  SentenceMakingAnswerDetail,
  RecordingProblemDetail,
  RecordingAnswerDetail,
} from "@/hooks/useQuizResultDetail";

interface QuizResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    id: string;
    score: number;
    total_questions: number;
    completed_at: string;
    answers: any[];
  } | null;
  studentName: string;
  isAnonymous?: boolean;
  quizId: string;
}

// 학생 답변과 모범 답안을 비교하여 틀린 단어를 빨간색으로 표시
function renderSentenceWithDiff(studentSentence: string, modelAnswer: string | null | undefined, isPerfect: boolean) {
  if (isPerfect || !modelAnswer) {
    return <span className={isPerfect ? "text-success" : "text-slate-700"}>{studentSentence}</span>;
  }
  const studentWords = studentSentence.trim().split(/\s+/);
  const modelWords = modelAnswer.trim().split(/\s+/);
  return (
    <>
      {studentWords.map((word, idx) => {
        const isCorrect = modelWords.includes(word);
        if (!isCorrect) {
          return <span key={idx} className="text-destructive font-bold mr-1.5 border-b-2 border-destructive/30 pb-0.5">{word}</span>;
        }
        return <span key={idx} className="mr-1.5 text-slate-700">{word}</span>;
      })}
    </>
  );
}

function renderModelAnswerWithDiff(modelAnswer: string, studentSentence: string) {
  const modelWords = modelAnswer.trim().split(/\s+/);
  const studentWords = studentSentence.trim().split(/\s+/);
  return (
    <>
      {modelWords.map((word, idx) => {
        const isOriginal = studentWords.includes(word);
        if (!isOriginal) {
          return <span key={idx} className="text-[#6366F1] font-bold mr-1.5 border-b-2 border-[#6366F1]/30 pb-0.5">{word}</span>;
        }
        return <span key={idx} className="mr-1.5 text-slate-700">{word}</span>;
      })}
    </>
  );
}

function SentenceMakingView({
  problems,
  answers,
}: {
  problems: SentenceMakingProblemDetail[];
  answers: SentenceMakingAnswerDetail[];
}) {
  // answers의 problem_id는 sentence_making_problems.id (UUID)를 참조
  const answersByProblem: Record<string, SentenceMakingAnswerDetail> = {};
  for (const a of answers) {
    const existing = answersByProblem[a.problem_id];
    if (!existing || a.attempt_number > existing.attempt_number) {
      answersByProblem[a.problem_id] = a;
    }
  }

  if (problems.length === 0 || answers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <p className="text-sm">이 학생은 문장 만들기를 완료하지 않았습니다.</p>
      </div>
    );
  }

  const hasAnyAttempt = problems.some((p) => answersByProblem[p.id]);
  if (!hasAnyAttempt) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <p className="text-sm">이 학생은 문장 만들기를 완료하지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {problems.map((problem, idx) => {
        const attempt = answersByProblem[problem.id];
        if (!attempt) return null;
        const isPerfect = attempt.total_score === 100;

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isPerfect ? "bg-success" : "bg-[#6366F1]"}`}>
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700">
                    {problem.word}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-500">{attempt.total_score}점</span>
                  {attempt.is_passed ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-warning" />
                  )}
                </div>
              </div>

              <div className="mb-6 space-y-3">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 ${isPerfect ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"}`}>
                    학생 답변
                  </span>
                  <h3 className="text-lg font-bold leading-relaxed">
                    {renderSentenceWithDiff(attempt.student_sentence, attempt.model_answer, isPerfect)}
                  </h3>
                </div>

                {!isPerfect && attempt.model_answer && (
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-[#6366F1]/10 text-[#6366F1]">
                      추천 문장
                    </span>
                    <h3 className="text-lg leading-relaxed">
                      {renderModelAnswerWithDiff(attempt.model_answer, attempt.student_sentence)}
                    </h3>
                  </div>
                )}
              </div>

              {attempt.ai_feedback && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {attempt.ai_feedback.replace(/Model Answer:\s*.*/i, "").trim()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecordingView({
  problems,
  answers,
}: {
  problems: RecordingProblemDetail[];
  answers: RecordingAnswerDetail[];
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showTrans, setShowTrans] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // answers의 problem_id는 recording_problems.id (UUID)를 참조
  const bestByProblem: Record<string, RecordingAnswerDetail> = {};
  for (const a of answers) {
    const existing = bestByProblem[a.problem_id];
    if (!existing || a.overall_score > existing.overall_score) {
      bestByProblem[a.problem_id] = a;
    }
  }

  const playAudio = (url: string, id: string) => {
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play();
  };

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
    return (
      <span className="font-bold">
        {sentence.split(/(\s+)/).map((word, idx) => {
          const clean = word.replace(/[.,!?。，！？]/g, "");
          return lowScoreWords.has(clean)
            ? <span key={idx} className="text-destructive">{word}</span>
            : <span key={idx} className="text-success">{word}</span>;
        })}
      </span>
    );
  };

  if (problems.length === 0 || answers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <p className="text-sm">이 학생은 말하기 연습을 완료하지 않았습니다.</p>
      </div>
    );
  }

  const hasAnyBest = problems.some((p) => bestByProblem[p.id]);
  if (!hasAnyBest) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <p className="text-sm">이 학생은 말하기 연습을 완료하지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {problems.map((problem, idx) => {
        const best = bestByProblem[problem.id];
        if (!best) return null;

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${best.is_passed ? "bg-success" : "bg-destructive"}`}>
                    {idx + 1}
                  </span>
                  <div className={`text-sm font-semibold px-3 py-1 rounded-full ${problem.mode === "listen" ? "text-orange-700 bg-orange-100" : "text-primary/80 bg-primary/10"}`}>
                    {problem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
                  </div>
                  <span className="text-sm font-semibold text-slate-500">{Math.round(best.overall_score)}점</span>
                </div>
                {problem.translation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTrans((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                  >
                    <Lightbulb className={`w-4 h-4 sm:mr-2 ${showTrans[problem.id] ? "text-warning" : ""}`} />
                    <span className="hidden sm:inline">번역 보기</span>
                  </Button>
                )}
              </div>

              <h3 className="text-lg font-bold mb-3 text-slate-800 leading-relaxed pl-3">
                {problem.sentence}
              </h3>

              {showTrans[problem.id] && problem.translation && (
                <p className="text-sm text-muted-foreground mb-4 bg-slate-50 p-3 rounded-lg">
                  {problem.translation}
                </p>
              )}

              <div className="flex flex-col gap-3 mb-4">
                {problem.mode === "listen" && problem.sentence_audio_url && (
                  <div className="flex items-center gap-0 sm:gap-4">
                    <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">원어민 음성</p>
                    <button
                      onClick={() => playAudio(problem.sentence_audio_url!, `original-${problem.id}`)}
                      className="flex-1 flex items-center justify-center bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-2xl py-3 px-4 transition-colors"
                    >
                      <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingId === `original-${problem.id}` ? "text-cyan-600 animate-pulse" : "text-cyan-500"}`} />
                      <div className="flex gap-[3px] items-center h-5">
                        {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                          <div
                            key={i}
                            className={`w-[3px] rounded-full ${playingId === `original-${problem.id}` ? "bg-cyan-500 animate-pulse" : "bg-cyan-200"}`}
                            style={{ height: `${h * 3}px` }}
                          />
                        ))}
                      </div>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-0 sm:gap-4">
                  <p className="hidden sm:block text-sm font-semibold text-slate-500 w-24 shrink-0 text-right">학생 발음</p>
                  <button
                    onClick={() => playAudio(best.recording_url, problem.id)}
                    className="flex-1 flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-2xl py-3 px-4 transition-colors"
                  >
                    <Volume2 className={`w-5 h-5 mr-3 sm:mr-4 ${playingId === problem.id ? "text-amber-600 animate-pulse" : "text-amber-500"}`} />
                    <div className="flex gap-[3px] items-center h-5">
                      {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                        <div
                          key={i}
                          className={`w-[3px] rounded-full ${playingId === problem.id ? "bg-amber-500 animate-pulse" : "bg-amber-200"}`}
                          style={{ height: `${h * 3}px` }}
                        />
                      ))}
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4 text-lg pl-3">
                {renderSentenceWithFeedback(problem.sentence, best.word_level_feedback, best.is_passed)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function QuizResultDialog({
  isOpen,
  onClose,
  result,
  studentName,
  isAnonymous = false,
  quizId,
}: QuizResultDialogProps) {
  const { detail, isLoading: detailLoading } = useQuizResultDetail(
    isOpen && result ? result.id : null,
    isOpen ? quizId : null
  );

  if (!result) return null;

  const hasFillBlank = Array.isArray(result.answers) && result.answers.length > 0;
  const hasSentenceMaking = detail?.sentenceMakingEnabled ?? false;
  const hasRecording = detail?.recordingEnabled ?? false;

  const activeTabCount = [hasFillBlank, hasSentenceMaking, hasRecording].filter(Boolean).length;
  const showTabs = activeTabCount > 1;

  const defaultTab = hasFillBlank ? "fill_blank" : hasSentenceMaking ? "sentence_making" : "recording";

  const fillBlankContent = (
    <div className="grid gap-4">
      {result.answers.map((answer: any, index: number) => {
        const problemData = {
          id: answer.problemId || String(index),
          word: answer.word || "",
          answer: answer.correctAnswer,
          sentence: answer.sentence || "문제 내용 없음",
          hint: "",
          translation: answer.translation || "",
          sentence_audio_url: answer.audioUrl,
        };
        return (
          <QuizReviewCard
            key={index}
            problem={problemData}
            userAnswer={answer.userAnswer}
            isCorrect={answer.isCorrect}
            problemNumber={index + 1}
            isTeacherView={true}
          />
        );
      })}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>퀴즈 결과 상세</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 학생 정보 & 점수 */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isAnonymous ? (
                <UserCircle className="h-10 w-10 text-muted-foreground" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {(studentName || "?")[0]}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold text-lg">{studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(result.completed_at), "yyyy년 M월 d일 a h:mm", { locale: ko })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {result.score} / {result.total_questions}
              </p>
              <p className="text-sm text-muted-foreground">
                정답률 {Math.round((result.score / result.total_questions) * 100)}%
              </p>
            </div>
          </div>

          {/* 문제별 상세 */}
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : showTabs ? (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="mb-4">
                {hasFillBlank && <TabsTrigger value="fill_blank">빈칸 채우기</TabsTrigger>}
                {hasSentenceMaking && <TabsTrigger value="sentence_making">문장 만들기</TabsTrigger>}
                {hasRecording && <TabsTrigger value="recording">말하기 연습</TabsTrigger>}
              </TabsList>
              {hasFillBlank && (
                <TabsContent value="fill_blank">
                  {fillBlankContent}
                </TabsContent>
              )}
              {hasSentenceMaking && detail && (
                <TabsContent value="sentence_making">
                  <SentenceMakingView
                    problems={detail.sentenceMakingProblems}
                    answers={detail.sentenceMakingAnswers}
                  />
                </TabsContent>
              )}
              {hasRecording && detail && (
                <TabsContent value="recording">
                  <RecordingView
                    problems={detail.recordingProblems}
                    answers={detail.recordingAnswers}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="space-y-4">
              {hasFillBlank && fillBlankContent}
              {hasSentenceMaking && detail && (
                <SentenceMakingView
                  problems={detail.sentenceMakingProblems}
                  answers={detail.sentenceMakingAnswers}
                />
              )}
              {hasRecording && detail && (
                <RecordingView
                  problems={detail.recordingProblems}
                  answers={detail.recordingAnswers}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
