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
import { UserCircle, CheckCircle, XCircle, HelpCircle, Volume2, Lightbulb, Loader2, TextCursorInput, PenLine, Mic, Pencil, RefreshCw, Link2, Keyboard, Magnet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";
import { WordPairResultCard } from "@/components/quiz/shared/WordPairResultCard";
import { WordMagnetResultCard } from "@/components/quiz/shared/WordMagnetResultCard";
import { useQuizResultDetail } from "@/hooks/useQuizResultDetail";
import { renderSentenceWithDiff, renderModelAnswerWithDiff, renderSentenceWithFeedback } from "@/components/quiz/quizResultUtils";
import { formatDateFull } from '@/lib/formatDate';
import type {
  SentenceMakingProblemDetail,
  SentenceMakingAnswerDetail,
  RecordingProblemDetail,
  RecordingAnswerDetail,
} from "@/hooks/useQuizResultDetail";
import type { GradedError } from "@/types/quiz";
import type { Json } from "@/integrations/supabase/types";

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
    matchup_score?: number | null;
    matchup_total?: number | null;
    type_answer_score?: number | null;
    type_answer_total?: number | null;
    word_magnet_score?: number | null;
    word_magnet_total?: number | null;
    sentence_making_score?: number | null;
    sentence_making_total?: number | null;
    recording_score?: number | null;
    recording_total?: number | null;
  } | null;
  studentName: string;
  isAnonymous?: boolean;
  quizId: string;
  // 점수 수정/재채점 후 부모 목록에 실시간 구독이 없는 경우(예: StudentHistoryDialog)
  // 최신 데이터를 다시 불러오도록 알려주는 콜백. 실시간 구독이 있는 목록(QuizResultsList)은
  // 넘기지 않아도 무방하다.
  onDataChanged?: () => void;
}


// 채점 실패 시 남는 표식 문구 — SentenceMakingStage.tsx / grade-sentence 에서 동일 문구 사용
const GRADING_FAILURE_MARKER = "채점에 실패했습니다";
const isFailedAttempt = (a: SentenceMakingAnswerDetail) =>
  !!a.ai_feedback?.includes(GRADING_FAILURE_MARKER);

interface BatchGradeResult {
  problemId: string;
  errors?: GradedError[];
  totalScore: number;
  feedback: string;
  modelAnswer: string;
  isPassed: boolean;
}

function SentenceMakingView({
  problems,
  answers,
  resultId,
  difficulty,
  translationLanguage,
  onDataChanged,
}: {
  problems: SentenceMakingProblemDetail[];
  answers: SentenceMakingAnswerDetail[];
  resultId: string;
  difficulty: string;
  translationLanguage: string;
  onDataChanged?: () => void;
}) {
  const [localAnswers, setLocalAnswers] = useState<SentenceMakingAnswerDetail[]>(answers);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ model_answer: string; ai_feedback: string }>({ model_answer: "", ai_feedback: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [regradeProgress, setRegradeProgress] = useState({ current: 0, total: 0 });

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
    let newScores:
      | { errors: GradedError[]; total_score: number; is_passed: boolean }
      | null = null;

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
        // 세부 점수 3종은 더 이상 쓰지 않는다. 오류 목록으로 대체.
        // (GRADING-CRITERIA.md 참조)
        newScores = {
          errors: data.errors ?? [],
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
        await supabase.rpc("update_quiz_result_sentence_score", {
          _result_id: resultId,
          _score: passedCount,
          _total: problems.length,
        });
        onDataChanged?.();
      }
    }
  };

  // 채점 실패("채점에 실패했습니다" 표식이 남은 attempt)를 일괄 재채점
  const handleRegradeFailed = async () => {
    const latestByProblem: Record<string, SentenceMakingAnswerDetail> = {};
    for (const a of localAnswers) {
      const existing = latestByProblem[a.problem_id];
      if (!existing || a.attempt_number > existing.attempt_number) {
        latestByProblem[a.problem_id] = a;
      }
    }
    const wordByProblemId: Record<string, string> = {};
    for (const p of problems) wordByProblemId[p.id] = p.word;

    const targets = Object.values(latestByProblem).filter(isFailedAttempt);
    if (targets.length === 0) return;

    setIsRegrading(true);
    setRegradeProgress({ current: 0, total: targets.length });

    let updatedAnswers = localAnswers;
    const BATCH_SIZE = 5;
    let completed = 0;
    let hadError = false;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const chunk = targets.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("grade-sentence", {
        body: {
          problems: chunk.map((a) => ({
            word: wordByProblemId[a.problem_id] || "",
            studentSentence: a.student_sentence,
            problemId: a.id,
          })),
          difficulty,
          translationLanguage,
        },
      });

      if (error || data?.error || !data?.results) {
        console.error("Regrade batch failed:", error || data?.error);
        hadError = true;
      } else {
        for (const r of data.results as BatchGradeResult[]) {
          const attempt = chunk.find((a) => a.id === r.problemId);
          if (!attempt) continue;
          // 세부 점수 3종 대신 오류 목록. (GRADING-CRITERIA.md 참조)
          const newErrors: GradedError[] = r.errors ?? [];
          const patch = {
            total_score: r.totalScore,
            ai_feedback: r.feedback,
            model_answer: r.modelAnswer,
            is_passed: r.isPassed,
          };
          const { error: updateError } = await supabase
            .from("sentence_making_answers")
            // DB 컬럼은 jsonb라 Json으로 넘긴다.
            .update({ ...patch, errors: newErrors as unknown as Json })
            .eq("id", attempt.id);
          if (updateError) {
            console.error("Failed to persist regrade result:", updateError);
            hadError = true;
            continue;
          }
          updatedAnswers = updatedAnswers.map((a) =>
            a.id === attempt.id ? { ...a, ...patch, errors: newErrors } : a
          );
        }
      }

      completed += chunk.length;
      setRegradeProgress({ current: Math.min(completed, targets.length), total: targets.length });
      setLocalAnswers(updatedAnswers);
    }

    // 집계 점수 재계산: problem별 최고 attempt의 is_passed 카운트
    const bestByProblem: Record<string, SentenceMakingAnswerDetail> = {};
    for (const a of updatedAnswers) {
      const ex = bestByProblem[a.problem_id];
      if (!ex || a.attempt_number > ex.attempt_number) bestByProblem[a.problem_id] = a;
    }
    const passedCount = Object.values(bestByProblem).filter((a) => a.is_passed).length;
    await supabase.rpc("update_quiz_result_sentence_score", {
      _result_id: resultId,
      _score: passedCount,
      _total: problems.length,
    });
    onDataChanged?.();

    setIsRegrading(false);
    if (hadError) {
      toast.error("일부 문제 재채점에 실패했습니다. 다시 시도해주세요.");
    } else {
      toast.success("재채점이 완료되었습니다.");
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

  const failedCount = Object.values(answersByProblem).filter(isFailedAttempt).length;

  return (
    <div className="space-y-4">
      {failedCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-warning/10 border border-warning/30 rounded-xl">
          <p className="text-sm text-slate-700">
            채점에 실패한 문제 {failedCount}건이 있습니다.
          </p>
          <Button size="sm" onClick={handleRegradeFailed} disabled={isRegrading}>
            {isRegrading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                재채점 중... ({regradeProgress.current}/{regradeProgress.total})
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                실패한 문제 재채점
              </>
            )}
          </Button>
        </div>
      )}
      {problems.map((problem, idx) => {
        const attempt = answersByProblem[problem.id];
        if (!attempt) return null;
        const isSkipped = !!attempt.is_skipped;
        const isPerfect = attempt.total_score === 100;
        const isGood = isPerfect || attempt.is_passed;
        const hasCorrections = !!attempt.model_answer &&
          attempt.model_answer.trim() !== attempt.student_sentence.trim();

        return (
          <Card key={problem.id} className="overflow-hidden border bg-white rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${isSkipped ? "bg-muted-foreground" : isGood ? "bg-success" : "bg-primary"}`}>
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700">
                    {problem.word}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isSkipped ? (
                    <>
                      <span className="text-sm font-semibold text-muted-foreground">모름</span>
                      <HelpCircle className="w-5 h-5 text-muted-foreground" />
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-500">{attempt.total_score}점</span>
                      {attempt.is_passed ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : (
                        <XCircle className="w-5 h-5 text-warning" />
                      )}
                    </>
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
              ) : isSkipped ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-muted text-muted-foreground">
                      모름
                    </span>
                    <h3 className="text-lg font-bold leading-relaxed text-muted-foreground">문제를 건너뛰었어요</h3>
                  </div>
                  {attempt.model_answer && (
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-xs font-bold py-1 w-16 text-center rounded-md mt-0.5 bg-primary/10 text-primary">
                        추천 문장
                      </span>
                      <h3 className="text-lg leading-relaxed">{attempt.model_answer}</h3>
                    </div>
                  )}
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
  recordingScore,
  recordingTotal,
}: {
  problems: RecordingProblemDetail[];
  answers: RecordingAnswerDetail[];
  recordingScore?: number | null;
  recordingTotal?: number | null;
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

  // 점수(recording_score)는 저장돼 있는데 상세 기록(recording_answers)이 없는 경우 —
  // 학생은 실제로 완료했지만 저장 단계에서 오류가 나서 상세 데이터만 유실된 상태.
  // "완료하지 않았습니다"라고 하면 사실과 다르므로 문구를 구분한다.
  const scoreExistsButDetailMissing =
    recordingScore !== null && recordingScore !== undefined &&
    recordingTotal !== null && recordingTotal !== undefined &&
    recordingTotal > 0;

  const notCompletedMessage = scoreExistsButDetailMissing ? (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center">
      <p className="text-sm font-medium text-slate-700">
        점수({recordingScore}/{recordingTotal})는 저장되어 있지만, 문제별 상세 녹음 기록을 불러올 수 없습니다.
      </p>
      <p className="text-xs">저장 중 오류가 발생해 상세 기록이 유실되었을 수 있습니다. 학생에게 말하기 연습 재응시를 요청해주세요.</p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <p className="text-sm">이 학생은 말하기 연습을 완료하지 않았습니다.</p>
    </div>
  );

  if (problems.length === 0 || answers.length === 0) {
    return notCompletedMessage;
  }

  const hasAnyBest = problems.some((p) => bestByProblem[p.id]);
  if (!hasAnyBest) {
    return notCompletedMessage;
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${best.is_passed ? "bg-success" : "bg-destructive"}`}>
                    {idx + 1}
                  </span>
                  {problem.label && (
                    <Badge variant="outline" className="font-semibold text-base px-3 py-1 bg-slate-50 border-slate-200 text-slate-700">
                      {problem.label}
                    </Badge>
                  )}
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

              <div className="mt-4 border-t border-slate-100 pt-4 text-lg pl-3 space-y-3">
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
  onDataChanged,
}: QuizResultDialogProps) {
  const { detail, isLoading: detailLoading } = useQuizResultDetail(
    isOpen && result ? result.id : null,
    isOpen ? quizId : null
  );

  if (!result) return null;

  const smDone = result.sentence_making_score !== null && result.sentence_making_score !== undefined;
  const recDone = result.recording_score !== null && result.recording_score !== undefined;

  // 빈칸이 실제로 이 퀴즈에 포함됐는지(문항별 답안 배열이 비어있지 않은지)를
  // 총점식보다 먼저 판정한다. 빈칸이 없으면 fill_blank 폴백(result.score 전체 집계값)을
  // 끌어오지 않아 다른 유형 점수가 이중으로 더해지는 것을 막는다.
  const hasFillBlank = Array.isArray(result.answers) && result.answers.length > 0;

  const fillBlankScore = hasFillBlank ? (result.fill_blank_score ?? result.score) : 0;
  const fillBlankTotal = hasFillBlank ? (result.fill_blank_total ?? result.total_questions) : 0;

  const combinedScore =
    fillBlankScore +
    (result.matchup_score ?? 0) +
    (result.type_answer_score ?? 0) +
    (result.word_magnet_score ?? 0) +
    (result.sentence_making_score ?? 0) +
    (result.recording_score ?? 0);
  const combinedTotal =
    fillBlankTotal +
    (result.matchup_total ?? 0) +
    (result.type_answer_total ?? 0) +
    (result.word_magnet_total ?? 0) +
    (result.sentence_making_total ?? 0) +
    (result.recording_total ?? 0);

  const hasSentenceMaking = detail?.sentenceMakingEnabled ?? false;
  const hasRecording = detail?.recordingEnabled ?? false;
  const hasMatchup = (result.matchup_total ?? 0) > 0;
  const hasTypeAnswer = (result.type_answer_total ?? 0) > 0;
  const hasWordMagnet = (result.word_magnet_total ?? 0) > 0;

  const activeTabCount = [hasMatchup, hasTypeAnswer, hasFillBlank, hasWordMagnet, hasSentenceMaking, hasRecording].filter(Boolean).length;
  const showTabs = activeTabCount > 1;

  // 정규 순서(matchup→type_answer→fill_blank→word_magnet→sentence_making→recording)로 첫 활성 유형
  const defaultTab = hasMatchup
    ? "matchup"
    : hasTypeAnswer
    ? "type_answer"
    : hasFillBlank
    ? "fill_blank"
    : hasWordMagnet
    ? "word_magnet"
    : hasSentenceMaking
    ? "sentence_making"
    : "recording";

  const matchupContent = (
    <div className="grid gap-4">
      {(detail?.matchupResults ?? []).map((r, i) => (
        <WordPairResultCard
          key={r.problemId}
          number={i + 1}
          prompt={r.prompt}
          correctAnswer={r.correctAnswer}
          userAnswer={r.userAnswer}
          isCorrect={r.isCorrect}
          answerLabel="학생 답변"
        />
      ))}
    </div>
  );

  const typeAnswerContent = (
    <div className="grid gap-4">
      {(detail?.typeAnswerResults ?? []).map((r, i) => (
        <WordPairResultCard
          key={r.problemId}
          number={i + 1}
          prompt={r.prompt}
          correctAnswer={r.correctAnswer}
          userAnswer={r.userAnswer}
          isCorrect={r.isCorrect}
          isSkipped={r.skipped}
          answerLabel="학생 답변"
        />
      ))}
    </div>
  );

  const wordMagnetContent = (
    <div className="grid gap-4">
      {(detail?.wordMagnetResults ?? []).map((r, i) => (
        <WordMagnetResultCard key={r.problemId} result={r} index={i} answerLabel="학생 답변" />
      ))}
    </div>
  );

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
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>퀴즈 결과 상세</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 학생 정보 & 점수 */}
          <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
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
          </div>

          {/* 문제별 상세 */}
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : showTabs ? (
            <Tabs defaultValue={defaultTab}>
              <div className="flex justify-center mb-4">
                <TabsList className="flex-wrap h-auto">
                  {hasMatchup && (
                    <TabsTrigger value="matchup" className="flex items-center gap-1.5">
                      <Link2 className="hidden sm:block w-4 h-4" />
                      짝 맞추기 ({result.matchup_score ?? 0}/{result.matchup_total ?? 0})
                    </TabsTrigger>
                  )}
                  {hasTypeAnswer && (
                    <TabsTrigger value="type_answer" className="flex items-center gap-1.5">
                      <Keyboard className="hidden sm:block w-4 h-4" />
                      단어 받아쓰기 ({result.type_answer_score ?? 0}/{result.type_answer_total ?? 0})
                    </TabsTrigger>
                  )}
                  {hasFillBlank && (
                    <TabsTrigger value="fill_blank" className="flex items-center gap-1.5">
                      <TextCursorInput className="hidden sm:block w-4 h-4" />
                      빈칸 채우기 ({fillBlankScore}/{fillBlankTotal})
                    </TabsTrigger>
                  )}
                  {hasWordMagnet && (
                    <TabsTrigger value="word_magnet" className="flex items-center gap-1.5">
                      <Magnet className="hidden sm:block w-4 h-4" />
                      문장 순서 ({result.word_magnet_score ?? 0}/{result.word_magnet_total ?? 0})
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
              {hasMatchup && (
                <TabsContent value="matchup">
                  {matchupContent}
                </TabsContent>
              )}
              {hasTypeAnswer && (
                <TabsContent value="type_answer">
                  {typeAnswerContent}
                </TabsContent>
              )}
              {hasFillBlank && (
                <TabsContent value="fill_blank">
                  {fillBlankContent}
                </TabsContent>
              )}
              {hasWordMagnet && (
                <TabsContent value="word_magnet">
                  {wordMagnetContent}
                </TabsContent>
              )}
              {hasSentenceMaking && detail && (
                <TabsContent value="sentence_making">
                  <SentenceMakingView
                    problems={detail.sentenceMakingProblems}
                    answers={detail.sentenceMakingAnswers}
                    resultId={result.id}
                    difficulty={detail.difficulty}
                    translationLanguage={detail.translationLanguage}
                    onDataChanged={onDataChanged}
                  />
                </TabsContent>
              )}
              {hasRecording && detail && (
                <TabsContent value="recording">
                  <RecordingView
                    problems={detail.recordingProblems}
                    answers={detail.recordingAnswers}
                    recordingScore={result.recording_score}
                    recordingTotal={result.recording_total}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="space-y-4">
              {hasMatchup && matchupContent}
              {hasTypeAnswer && typeAnswerContent}
              {hasFillBlank && fillBlankContent}
              {hasWordMagnet && wordMagnetContent}
              {hasSentenceMaking && detail && (
                <SentenceMakingView
                  problems={detail.sentenceMakingProblems}
                  answers={detail.sentenceMakingAnswers}
                  resultId={result.id}
                  difficulty={detail.difficulty}
                  translationLanguage={detail.translationLanguage}
                  onDataChanged={onDataChanged}
                />
              )}
              {hasRecording && detail && (
                <RecordingView
                  problems={detail.recordingProblems}
                  answers={detail.recordingAnswers}
                  recordingScore={result.recording_score}
                  recordingTotal={result.recording_total}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
