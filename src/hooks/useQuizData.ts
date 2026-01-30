import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { useClasses, Class as ClassModel } from "./useClasses";

export interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

export interface Quiz {
  id: string;
  title: string;
  words: string[];
  difficulty: string;
  translation_language: string;
  words_per_set: number;
  timer_enabled: boolean;
  timer_seconds: number | null;
  problems: Problem[];
  created_at: string;
  teacher_id: string;
  api_provider?: "openai" | "gemini" | "gemini-pro";
}

export type Class = ClassModel;

export function useQuizData(quizId: string | undefined, userId: string | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { classes } = useClasses(userId);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);

  // Fetch quiz data
  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").eq("id", quizId).single();

      if (error) {
        throw new Error("퀴즈를 불러올 수 없습니다");
      }

      const quizData = data as any;

      // Sort problems to match the original word list order
      if (quizData.problems && quizData.words) {
        const sortedProblems = quizData.problems.sort((a: Problem, b: Problem) => {
          const indexA = quizData.words.indexOf(a.word);
          const indexB = quizData.words.indexOf(b.word);
          return indexA - indexB;
        });
        quizData.problems = sortedProblems;
      }

      return quizData as Quiz;
    },
    enabled: !!userId && !!quizId,
  });

  // Fetch audio status
  const { data: audioData } = useQuery({
    queryKey: ['quizAudio', quizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_problems")
        .select("problem_id, sentence_audio_url")
        .eq("quiz_id", quizId);

      return data || [];
    },
    enabled: !!userId && !!quizId,
  });

  // Update audio state when data changes
  useEffect(() => {
    if (audioData && audioData.length > 0) {
      const hasAnyAudio = audioData.some(p => !!p.sentence_audio_url);
      setHasAudio(hasAnyAudio);

      const urls: Record<string, string> = {};
      audioData.forEach(p => {
        if (p.sentence_audio_url) {
          urls[p.problem_id] = p.sentence_audio_url;
        }
      });
      setAudioUrls(urls);
    } else {
      setHasAudio(false);
    }
  }, [audioData]);

  // Realtime subscription for audio updates
  useEffect(() => {
    if (!userId || !quizId) return;

    const handleAudioUpdate = (payload: any) => {
      const newProblem = payload.new as any;
      if (newProblem.sentence_audio_url) {
        setAudioUrls((prev) => ({
          ...prev,
          [newProblem.problem_id]: newProblem.sentence_audio_url,
        }));
        setHasAudio(true);
      }
    };

    const channel = supabase
      .channel('quiz-detail-audio-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quiz_problems',
          filter: `quiz_id=eq.${quizId}`,
        },
        handleAudioUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_problems',
          filter: `quiz_id=eq.${quizId}`,
        },
        handleAudioUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, quizId]);

  const updateQuizTitle = (newTitle: string) => {
    queryClient.setQueryData(['quiz', quizId], (prev: Quiz | undefined) =>
      prev ? { ...prev, title: newTitle } : prev
    );
  };

  const updateQuizProblems = (newProblems: Problem[]) => {
    queryClient.setQueryData(['quiz', quizId], (prev: Quiz | undefined) =>
      prev ? { ...prev, problems: newProblems } : prev
    );
  };

  const refetchQuiz = () => {
    queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
  };

  return {
    quiz: quiz ?? null,
    classes,
    isLoading,
    hasAudio,
    audioUrls,
    setAudioUrls,
    setHasAudio,
    updateQuizTitle,
    updateQuizProblems,
    refetchQuiz,
  };
}
