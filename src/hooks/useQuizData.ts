
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
}

export interface Class {
  id: string;
  name: string;
}

export function useQuizData(quizId: string | undefined, userId: string | undefined) {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userId && quizId) {
      fetchQuiz();
      fetchClasses();
      checkAudioStatus();

      // Realtime subscription for audio updates
      const channel = supabase
        .channel('quiz-detail-audio-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quiz_problems',
            filter: `quiz_id=eq.${quizId}`,
          },
          (payload) => {
            const newProblem = payload.new as any;
            if (newProblem.sentence_audio_url) {
              setAudioUrls((prev) => ({
                ...prev,
                [newProblem.problem_id]: newProblem.sentence_audio_url,
              }));
              setHasAudio(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, quizId]);

  const fetchQuiz = async () => {
    if (!quizId) return;
    
    const { data, error } = await supabase.from("quizzes").select("*").eq("id", quizId).single();

    if (error) {
      toast.error("퀴즈를 불러올 수 없습니다");
      navigate("/dashboard");
      return;
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
    
    setQuiz(quizData);
    setIsLoading(false);
  };

  const fetchClasses = async () => {
    if (!userId) return;
    const { data } = await supabase.from("classes").select("id, name").eq("teacher_id", userId);

    if (data) setClasses(data);
  };

  const checkAudioStatus = async () => {
    if (!quizId) return;
    
    const { data } = await supabase
      .from("quiz_problems")
      .select("problem_id, sentence_audio_url")
      .eq("quiz_id", quizId);
    
    if (data && data.length > 0) {
      const hasAnyAudio = data.some(p => !!p.sentence_audio_url);
      setHasAudio(hasAnyAudio);
      
      // 오디오 URL들을 상태에 저장
      const urls: Record<string, string> = {};
      data.forEach(p => {
        if (p.sentence_audio_url) {
          urls[p.problem_id] = p.sentence_audio_url;
        }
      });
      setAudioUrls(urls);
    } else {
      setHasAudio(false);
    }
  };

  const updateQuizTitle = async (newTitle: string) => {
    if (!quiz) return;
    setQuiz({ ...quiz, title: newTitle });
  };
  
  const updateQuizProblems = async (newProblems: Problem[]) => {
    if (!quiz) return;
    setQuiz({ ...quiz, problems: newProblems });
  };

  return {
    quiz,
    classes,
    isLoading,
    hasAudio,
    audioUrls,
    setAudioUrls,
    setHasAudio,
    updateQuizTitle,
    updateQuizProblems,
    refetchQuiz: fetchQuiz,
  };
}
