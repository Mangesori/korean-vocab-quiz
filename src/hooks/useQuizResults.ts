import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuizResult {
  id: string;
  student_id: string;
  score: number;
  total_questions: number;
  answers: any;
  completed_at: string;
  is_anonymous: boolean;
  anonymous_name: string | null;
  student_profile?: {
    name: string;
    email?: string;
  };
}

export function useQuizResults(quizId: string) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (quizId) {
      fetchResults();
      subscribeToNewResults();
    }
    
    return () => {
      supabase.channel(`quiz_results:${quizId}`).unsubscribe();
    };
  }, [quizId]);

  const fetchResults = async () => {
    setIsLoading(true);
    
    // 1. Fetch results
    const { data: resultsData, error } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("quiz_id", quizId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Error fetching results:", error);
      setIsLoading(false);
      return;
    }

    if (!resultsData) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // 2. Fetch student profiles for non-anonymous results
    const studentIds = resultsData
      .filter(r => !r.is_anonymous && r.student_id)
      .map(r => r.student_id);

    let profilesMap: Record<string, any> = {};

    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", studentIds);

      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.user_id] = p;
        });
      }
    }

    // 3. Combine data
    const combinedResults: QuizResult[] = resultsData.map(r => ({
      ...r,
      student_profile: profilesMap[r.student_id],
    }));

    setResults(combinedResults);
    setIsLoading(false);
  };

  const subscribeToNewResults = () => {
    supabase
      .channel(`quiz_results:${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quiz_results",
          filter: `quiz_id=eq.${quizId}`,
        },
        (payload) => {
          // When a new result comes in, refresh the list to get full data (including profiles)
          // Or optimistically add it. For now, fetching is safer for profile data.
          fetchResults();
        }
      )
      .subscribe();
  };

  return { results, isLoading, refresh: fetchResults };
}
