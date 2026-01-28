import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentQuizActivity {
  id: string;           // result id (for completed) or quiz_id (for pending)
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_questions: number;
  completed_at: string | null; // 제출 시간 (미완료시 null)
  assigned_at: string;         // 배정일
  answers: any;
  status: "completed" | "pending";
}

export function useStudentHistory(studentId: string, classId: string) {
  const [activities, setActivities] = useState<StudentQuizActivity[]>([]);
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
          assigned_at,
          quizzes (
            id,
            title
          )
        `)
        .eq("class_id", classId);

      if (quizError) throw quizError;

      const quizIds = assignedQuizzes ? assignedQuizzes.map((cq) => cq.quiz_id) : [];

      // 배정일 맵 생성
      const assignmentMap: Record<string, { title: string; assigned_at: string }> = {};
      (assignedQuizzes || []).forEach((cq: any) => {
        assignmentMap[cq.quiz_id] = {
          title: cq.quizzes?.title || "삭제된 퀴즈",
          assigned_at: cq.assigned_at
        };
      });

      const allActivities: StudentQuizActivity[] = [];
      const completedQuizIds = new Set<string>();

      // 2. Get ALL results for this student (not just latest)
      if (quizIds.length > 0) {
        const { data: results, error: resultError } = await supabase
          .from("quiz_results")
          .select("*")
          .eq("student_id", studentId)
          .in("quiz_id", quizIds);

        if (resultError) throw resultError;

        if (results) {
          results.forEach((r) => {
            completedQuizIds.add(r.quiz_id);
            const assignment = assignmentMap[r.quiz_id];
            allActivities.push({
              id: r.id,
              quiz_id: r.quiz_id,
              quiz_title: assignment?.title || "삭제된 퀴즈",
              score: r.score,
              total_questions: r.total_questions,
              completed_at: r.completed_at,
              assigned_at: assignment?.assigned_at || r.completed_at,
              answers: r.answers,
              status: "completed"
            });
          });
        }
      }

      // 3. Add pending quizzes (not yet completed)
      (assignedQuizzes || []).forEach((cq: any) => {
        if (!completedQuizIds.has(cq.quiz_id)) {
          allActivities.push({
            id: cq.quiz_id,
            quiz_id: cq.quiz_id,
            quiz_title: cq.quizzes?.title || "삭제된 퀴즈",
            score: 0,
            total_questions: 0,
            completed_at: null,
            assigned_at: cq.assigned_at,
            answers: null,
            status: "pending"
          });
        }
      });

      // 4. Sort: completed (by completed_at desc) first, then pending (by assigned_at desc)
      allActivities.sort((a, b) => {
        // Completed first, pending last
        if (a.status === "completed" && b.status === "pending") return -1;
        if (a.status === "pending" && b.status === "completed") return 1;

        // Both completed: sort by completed_at desc
        if (a.status === "completed" && b.status === "completed") {
          return new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime();
        }

        // Both pending: sort by assigned_at desc
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      });

      setActivities(allActivities);

    } catch (e) {
      console.error("Error fetching student history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return { activities, isLoading };
}
