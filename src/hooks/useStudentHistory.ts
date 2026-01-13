import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentQuizActivity {
  id: string; // result id
  quiz_title: string;
  score: number;
  total_questions: number;
  completed_at: string;
  answers: any;
}

export interface AssignedQuiz {
  id: string; // quiz_id
  quiz_id: string;
  title: string;
  created_at: string;
  status: "completed" | "pending";
  result?: StudentQuizActivity;
}

export function useStudentHistory(studentId: string, classId: string) {
  const [activities, setActivities] = useState<AssignedQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (studentId && classId) {
      fetchHistory();
    }
  }, [studentId, classId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      // 1. Get all quizzes assigned to this class
      const { data: assignedQuizzes, error: quizError } = await supabase
        .from("quiz_assignments")
        .select(`
          quiz_id,
          created_at,
          quizzes (
            id,
            title
          )
        `)
        .eq("class_id", classId);

      if (quizError) throw quizError;

      // 2. Get all results for this student for these quizzes
      // Explicitly checking for null/undefined assignedQuizzes
      const quizIds = assignedQuizzes ? assignedQuizzes.map((cq) => cq.quiz_id) : [];
      
      const resultsMap: Record<string, StudentQuizActivity> = {};
      
      if (quizIds.length > 0) {
        const { data: results, error: resultError } = await supabase
          .from("quiz_results")
          .select("*")
          .eq("student_id", studentId)
          .in("quiz_id", quizIds);

        if (resultError) throw resultError;

        if (results) {
          // Sort by completed_at desc to get latest first
          results.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
          
          results.forEach((r) => {
            // Only keep the latest result for each quiz for the summary
            if (!resultsMap[r.quiz_id]) {
              resultsMap[r.quiz_id] = {
                id: r.id,
                quiz_title: "", // Placeholder, will be filled from assignment
                score: r.score,
                total_questions: r.total_questions,
                completed_at: r.completed_at,
                answers: r.answers
              };
            }
          });
        }
      }

      // 3. Combine
      const combined: AssignedQuiz[] = (assignedQuizzes || []).map((cq: any) => {
        const result = resultsMap[cq.quiz_id];
        return {
          id: cq.quiz_id, 
          quiz_id: cq.quiz_id,
          title: cq.quizzes?.title || "삭제된 퀴즈",
          created_at: cq.created_at,
          status: result ? "completed" : "pending",
          result: result ? {
            ...result,
            quiz_title: cq.quizzes?.title // Fill in title here
          } : undefined
        };
      });

      setActivities(combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (e) {
      console.error("Error fetching student history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return { activities, isLoading };
}
