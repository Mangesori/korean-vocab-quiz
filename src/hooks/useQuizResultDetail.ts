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
}

export interface RecordingProblemDetail {
  id: string;
  problem_id: string;
  sentence: string;
  mode: "read" | "listen";
  sentence_audio_url?: string;
  translation?: string;
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

export interface QuizResultDetail {
  sentenceMakingEnabled: boolean;
  recordingEnabled: boolean;
  sentenceMakingProblems: SentenceMakingProblemDetail[];
  sentenceMakingAnswers: SentenceMakingAnswerDetail[];
  recordingProblems: RecordingProblemDetail[];
  recordingAnswers: RecordingAnswerDetail[];
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

    // 퀴즈 플래그 조회
    const { data: quizData } = await supabase
      .from("quizzes")
      .select("sentence_making_enabled, recording_enabled")
      .eq("id", quizId)
      .single();

    const sentenceMakingEnabled = quizData?.sentence_making_enabled ?? false;
    const recordingEnabled = quizData?.recording_enabled ?? false;

    let sentenceMakingProblems: SentenceMakingProblemDetail[] = [];
    let sentenceMakingAnswers: SentenceMakingAnswerDetail[] = [];
    let recordingProblems: RecordingProblemDetail[] = [];
    let recordingAnswers: RecordingAnswerDetail[] = [];

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
          .select("id, problem_id, sentence, mode, sentence_audio_url, translation")
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
      sentenceMakingProblems,
      sentenceMakingAnswers,
      recordingProblems,
      recordingAnswers,
    });
    setIsLoading(false);
  };

  return { detail, isLoading };
}
