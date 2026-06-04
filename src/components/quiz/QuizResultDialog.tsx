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
import { UserCircle, CheckCircle, XCircle, Volume2, Lightbulb, Loader2, TextCursorInput, PenLine, Mic, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";
import { useQuizResultDetail } from "@/hooks/useQuizResultDetail";
import { formatDateFull } from '@/lib/formatDate';
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
    fill_blank_score?: number | null;
    fill_blank_total?: number | null;
    sentence_making_score?: number | null;
    sentence_making_total?: number | null;
    recording_score?: number | null;
    recording_total?: number | null;
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
          return <span key={idx} className="text-primary font-bold mr-1.5 border-b-2 border-primary/30 pb-0.5">{word}</span>;
        }
        return <span key={idx} className="mr-1.5 text-slate-700">{word}</span>;
      })}
    </>
  );
}

function SentenceMakingView({
  problems,
  answers,
  resultId,
}: {
  problems: SentenceMakingProblemDetail[];
  answers: SentenceMakingAnswerDetail[];
  resultId: string;
}) {
  const [localAnswers, setLocalAnswers] = useState<SentenceMakingAnswerDetail[]>(answers);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ model_answer: string; ai_feedback: string }>({ model_answer: "", ai_feedback: "" });
  const [isSaving, setIsSaving] = useState(false);

  const startCardEdit = (id: string, modelAnswer: string | null, aiFeedback: string, studentSentence: string) => {
    setEditingCardId(id);
    setEditDraft({
      model_answer: modelAnswer?.trim() || studentSentence,
      ai_feedback: aiFeedback.replace(/Model Answer:\s*.*/i, "").trim(),
    });
  };

  const cancelCardEdit = () => setEditingCardId(null);

  const saveCardEdit = async (attempt: SentenceMakingAnswerDetail, word: string) => {
    setIsSaving(true);
    const newModelAnswer = editDraft.model_answer.trim();
    const originalModelAnswer = (attempt.model_answer || attempt.student_sentence).trim();
    const modelAnswerChanged = newModelAnswer !== originalModelAnswer;

    let newFeedback = editDraft.ai_feedback.trim();
    let newScores: { word_usage_score: number; grammar_score: number; naturalness_score: number; total_score: number; is_passed: boolean } | null = null;

    if (modelAnswerChanged) {
      const { data } = await supabase.functions.invoke("grade-sentence", {
        body: {
          regenerate_feedback: true,
          word,
          studentSentence: attempt.student_sentence,
          modelAnswer: newModelAnswer,
          translationLanguage: "English",
        },
      });
      if (data?.feedback) newFeedback = data.feedback;
      if (data?.totalScore !== undefined) {
        newScores = {
          word_usage_score: data.wordUsageScore,
          grammar_score: data.grammarScore,
          naturalness_score: data.naturalnessScore,
          total_score: data.totalScore,
          is_passed: data.isPassed,
        };
      }
    }

    const updatePayload: Record<string, unknown> = { model_answer: newModelAnswer, ai_feedback: newFeedback };
    if (newScores) Object.assign(updatePayload, newScores);

    const { error } = await supabase
      .from("sentence_making_answers")
      .update(updatePayload)
      .eq("id", attempt.id);

    setIsSaving(false);
    if (!error) {
      const updatedAnswers = localAnswers.map((a) =>
        a.id === attempt.id
          ? { ...a, model_answer: newModelAnswer, ai_feedback: newFeedback, ...(newScores ?? {}) }
          : a
      );
      setLocalAnswers(updatedAnswers);
      setEditingCardId(null);

      // 집계 점수 재계산: problem별 최고 attempt의 is_passed 카운트
      if (newScores) {
        const bestByProblem: Record<string, SentenceMakingAnswerDetail> = {};
        for (const a of updatedAnswers) {
          const ex = bestByProblem[a.problem_id];
          if (!ex || a.attempt_number > ex.attempt_number) bestByProblem[a.problem_id] = a;
        }
        const passedCount = Object.values(bestByProblem).filter((a) => a.is_passed).length;
        await supabase.rpc("update_quiz_result_sentence_score" as any, {
          _result_id: resultId,
          _score: passedCount,
          _total: problems.length,
        });
      }
    }
  };

  // answers의 problem_id는 sentence_making_problems.id (UUID)를 참조
  const answersByProblem: Record<string, SentenceMakingAnswerDetail> = {};
  for (const a of localAnswers) {
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
        const isGood = isPerfect || attempt.is_passed;
        const hasCorrections = !!attempt.model_answer &&
          attempt.model_answer.trim() !== attempt.student_sentence.trim();

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isGood ? "bg-success" : "bg-primary"}`}>
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
                  {editingCardId !== attempt.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 text-slate-500"
                      onClick={() => startCardEdit(attempt.id, attempt.model_answer, attempt.ai_feedback || "", attempt.student_sentence)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      수정
                    </Button>
                  )}
                </div>
              </div>

              {editingCardId === attempt.id ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-slate-100 text-slate-500">
                      학생 답변
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed text-slate-700">
                      {attempt.student_sentence}
                    </h3>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                      추천 문장
                    </span>
                    <Textarea
                      value={editDraft.model_answer}
                      onChange={(e) => setEditDraft((d) => ({ ...d, model_answer: e.target.value }))}
                      className="flex-1 text-base min-h-[60px]"
                      autoFocus
                    />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <Textarea
                      value={editDraft.ai_feedback}
                      onChange={(e) => setEditDraft((d) => ({ ...d, ai_feedback: e.target.value }))}
                      className="w-full text-sm min-h-[80px] bg-transparent border-0 shadow-none focus-visible:ring-0 resize-none p-0 text-slate-600"
                      placeholder="피드백 내용..."
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={cancelCardEdit} disabled={isSaving}>
                      취소
                    </Button>
                    <Button size="sm" onClick={() => saveCardEdit(attempt, problem.word)} disabled={isSaving}>
                      {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      {isSaving ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 ${isGood && !hasCorrections ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500"}`}>
                        학생 답변
                      </span>
                      <h3 className="text-lg font-bold leading-relaxed">
                        {renderSentenceWithDiff(attempt.student_sentence, attempt.model_answer, !hasCorrections)}
                      </h3>
                    </div>

                    {hasCorrections && (
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                          추천 문장
                        </span>
                        <h3 className="text-lg leading-relaxed">
                          {renderModelAnswerWithDiff(attempt.model_answer!, attempt.student_sentence)}
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
                </>
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

  const smDone = result.sentence_making_score !== null && result.sentence_making_score !== undefined;
  const recDone = result.recording_score !== null && result.recording_score !== undefined;

  const fillBlankScore = result.fill_blank_score ?? result.score;
  const fillBlankTotal = result.fill_blank_total ?? result.total_questions;

  const combinedScore =
    fillBlankScore +
    (smDone ? result.sentence_making_score! : 0) +
    (recDone ? result.recording_score! : 0);
  const combinedTotal =
    fillBlankTotal +
    (smDone ? (result.sentence_making_total ?? 0) : 0) +
    (recDone ? (result.recording_total ?? 0) : 0);

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
          word: answer.word || detail?.fillBlankWordMap?.[answer.problemId] || "",
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
                  {formatDateFull(result.completed_at)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {combinedScore} / {combinedTotal}
              </p>
              <p className="text-sm text-muted-foreground">
                정답률 {combinedTotal > 0 ? Math.round((combinedScore / combinedTotal) * 100) : 0}%
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
              <div className="flex justify-center mb-4">
                <TabsList>
                  {hasFillBlank && (
                    <TabsTrigger value="fill_blank" className="flex items-center gap-1.5">
                      <TextCursorInput className="hidden sm:block w-4 h-4" />
                      빈칸 채우기 ({fillBlankScore}/{fillBlankTotal})
                    </TabsTrigger>
                  )}
                  {hasSentenceMaking && (
                    <TabsTrigger value="sentence_making" className="flex items-center gap-1.5">
                      <PenLine className="hidden sm:block w-4 h-4" />
                      문장 만들기{
                        smDone
                          ? ` (${result.sentence_making_score}/${result.sentence_making_total ?? detail?.sentenceMakingProblems.length ?? 0})`
                          : detail?.sentenceMakingProblems.length
                          ? ` (${detail.sentenceMakingProblems.length})`
                          : ""
                      }
                    </TabsTrigger>
                  )}
                  {hasRecording && (
                    <TabsTrigger value="recording" className="flex items-center gap-1.5">
                      <Mic className="hidden sm:block w-4 h-4" />
                      말하기 연습{
                        recDone
                          ? ` (${result.recording_score}/${result.recording_total ?? detail?.recordingProblems.length ?? 0})`
                          : detail?.recordingProblems.length
                          ? ` (${detail.recordingProblems.length})`
                          : ""
                      }
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>
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
                    resultId={result.id}
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
