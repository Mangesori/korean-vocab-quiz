import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SentenceMakingProblemDetail {
  id: string;
  problem_id: string;
  word: string;
  word_meaning?: string;
  model_answer: string;
}

export interface SentenceMakingAnswerDetail {
  id: string;
  result_id: string;
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

export interface RecordingProblemDetail {
  id: string;
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  sentence_audio_url?: string;
  translation?: string;
  label?: string | null;
}

export interface RecordingAnswerDetail {
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
  word_level_feedback: { word: string; accuracyScore: number; errorType?: string }[];
  is_passed: boolean;
}

export interface MatchupResultDetail {
  problemId: string;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface TypeAnswerResultDetail {
  problemId: string;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  skipped?: boolean;
}

export interface WordMagnetResultDetail {
  problemId: string;
  translation: string;
  correctSentence: string;
  userSentence: string;
  isCorrect: boolean;
  skipped?: boolean;
}

export interface QuizResultDetail {
  sentenceMakingEnabled: boolean;
  recordingEnabled: boolean;
  matchupEnabled: boolean;
  typeAnswerEnabled: boolean;
  wordMagnetEnabled: boolean;
  sentenceMakingProblems: SentenceMakingProblemDetail[];
  sentenceMakingAnswers: SentenceMakingAnswerDetail[];
  recordingProblems: RecordingProblemDetail[];
  recordingAnswers: RecordingAnswerDetail[];
  matchupResults: MatchupResultDetail[];
  typeAnswerResults: TypeAnswerResultDetail[];
  wordMagnetResults: WordMagnetResultDetail[];
  fillBlankWordMap: Record<string, string>;
  difficulty: string;
  translationLanguage: string;
}

export function useQuizResultDetail(resultId: string | null, quizId: string | null) {
  const [detail, setDetail] = useState<QuizResultDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!resultId || !quizId) return;
    fetchDetail();
  }, [resultId, quizId]);

  const fetchDetail = async () => {
    if (!resultId || !quizId) return;
    setIsLoading(true);

    // 퀴즈 플래그 + problems(word fallback용) + 재채점용 난이도/언어 조회
    const { data: quizData } = await supabase
      .from("quizzes")
      .select("sentence_making_enabled, recording_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, problems, difficulty, translation_language")
      .eq("id", quizId)
      .single();

    const sentenceMakingEnabled = quizData?.sentence_making_enabled ?? false;
    const recordingEnabled = quizData?.recording_enabled ?? false;
    const matchupEnabled = (quizData as any)?.matchup_enabled ?? false;
    const typeAnswerEnabled = (quizData as any)?.type_answer_enabled ?? false;
    const wordMagnetEnabled = (quizData as any)?.word_magnet_enabled ?? false;

    const fillBlankWordMap: Record<string, string> = {};
    for (const p of ((quizData?.problems as any[]) || [])) {
      if (p.id && p.word) fillBlankWordMap[p.id] = p.word;
    }

    let sentenceMakingProblems: SentenceMakingProblemDetail[] = [];
    let sentenceMakingAnswers: SentenceMakingAnswerDetail[] = [];
    let recordingProblems: RecordingProblemDetail[] = [];
    let recordingAnswers: RecordingAnswerDetail[] = [];
    let matchupResults: MatchupResultDetail[] = [];
    let typeAnswerResults: TypeAnswerResultDetail[] = [];
    let wordMagnetResults: WordMagnetResultDetail[] = [];

    if (matchupEnabled) {
      const [{ data: muProblems }, { data: muAnswers }] = await Promise.all([
        supabase
          .from("matchup_problems")
          .select("problem_id, korean_text, meaning_text")
          .eq("quiz_id", quizId),
        supabase
          .from("matchup_answers")
          .select("problem_id, selected_meaning, is_correct, attempt_number")
          .eq("result_id", resultId),
      ]);
      // problem_id별 best attempt 선택: 정답 우선, 그다음 최고 attempt_number
      const bestByProblem: Record<string, any> = {};
      for (const a of ((muAnswers as any[]) || [])) {
        const ex = bestByProblem[a.problem_id];
        if (
          !ex ||
          (!!a.is_correct && !ex.is_correct) ||
          (!!a.is_correct === !!ex.is_correct && (a.attempt_number ?? 0) > (ex.attempt_number ?? 0))
        ) {
          bestByProblem[a.problem_id] = a;
        }
      }
      matchupResults = ((muProblems as any[]) || []).map((p) => {
        const a = bestByProblem[p.problem_id];
        return {
          problemId: p.problem_id,
          prompt: p.korean_text,
          correctAnswer: p.meaning_text,
          userAnswer: a?.selected_meaning || "",
          isCorrect: !!a?.is_correct,
        };
      });
    }

    if (typeAnswerEnabled) {
      const { data: taDetail } = await supabase.rpc("get_type_answer_result_detail", {
        _result_id: resultId,
      });
      if (taDetail) typeAnswerResults = taDetail as TypeAnswerResultDetail[];
    }

    if (wordMagnetEnabled) {
      const { data: wmDetail } = await supabase.rpc("get_word_magnet_result_detail", {
        _result_id: resultId,
      });
      if (wmDetail) wordMagnetResults = wmDetail as WordMagnetResultDetail[];
    }

    if (sentenceMakingEnabled) {
      const [{ data: smProblems }, { data: smAnswers }] = await Promise.all([
        supabase
          .from("sentence_making_problems")
          .select("id, problem_id, word, word_meaning, model_answer")
          .eq("quiz_id", quizId),
        supabase
          .from("sentence_making_answers")
          .select("*")
          .eq("result_id", resultId)
          .order("problem_id")
          .order("attempt_number"),
      ]);
      if (smProblems) sentenceMakingProblems = smProblems as SentenceMakingProblemDetail[];
      if (smAnswers) sentenceMakingAnswers = smAnswers as SentenceMakingAnswerDetail[];
    }

    if (recordingEnabled) {
      const [{ data: recProblems }, { data: recAnswers }] = await Promise.all([
        supabase
          .from("recording_problems")
          .select("id, problem_id, sentence, mode, sentence_audio_url, translation, label")
          .eq("quiz_id", quizId),
        supabase
          .from("recording_answers")
          .select("*")
          .eq("result_id", resultId)
          .order("problem_id")
          .order("attempt_number"),
      ]);
      if (recProblems) recordingProblems = recProblems as RecordingProblemDetail[];
      if (recAnswers) {
        recordingAnswers = (recAnswers as any[]).map((a) => ({
          ...a,
          word_level_feedback: Array.isArray(a.word_level_feedback)
            ? a.word_level_feedback
            : [],
        })) as RecordingAnswerDetail[];
      }
    }

    setDetail({
      sentenceMakingEnabled,
      recordingEnabled,
      matchupEnabled,
      typeAnswerEnabled,
      wordMagnetEnabled,
      sentenceMakingProblems,
      sentenceMakingAnswers,
      recordingProblems,
      recordingAnswers,
      matchupResults,
      typeAnswerResults,
      wordMagnetResults,
      fillBlankWordMap,
      difficulty: quizData?.difficulty ?? "A1",
      translationLanguage: quizData?.translation_language ?? "en",
    });
    setIsLoading(false);
  };

  return { detail, isLoading };
}
