import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MyQuizItem {
  quiz_id: string;
  quiz_title: string;
  class_id: string;
  class_name: string;
  assigned_at: string;
  result_id: string | null;
  score: number | null;
  total_questions: number | null;
  completed_at: string | null;
  status: "completed" | "pending";
  answers: any;
  fill_blank_score: number | null;
  fill_blank_total: number | null;
  sentence_making_score: number | null;
  sentence_making_total: number | null;
  recording_score: number | null;
  recording_total: number | null;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
  is_anonymous: boolean;
  student_profile: { name: string } | null;
  anonymous_name: string | null;
}

export function useMyQuizzes(studentId: string) {
  const [quizzes, setQuizzes] = useState<MyQuizItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (studentId) fetchQuizzes();
  }, [studentId]);

  const fetchQuizzes = async () => {
    setIsLoading(true);
    try {
      const { data: memberships, error: memberError } = await supabase
        .from("student_class_members")
        .select("class_id, classes(id, name)")
        .eq("student_id", studentId);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) {
        setQuizzes([]);
        return;
      }

      const classIds = memberships.map((m) => m.class_id);
      const classNameMap: Record<string, string> = {};
      memberships.forEach((m: any) => {
        classNameMap[m.class_id] = m.classes?.name || "알 수 없는 클래스";
      });

      const { data: assignments, error: assignError } = await supabase
        .from("quiz_assignments")
        .select(`
          quiz_id,
          class_id,
          assigned_at,
          quizzes (
            id,
            title,
            sentence_making_enabled,
            recording_enabled
          )
        `)
        .in("class_id", classIds);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        setQuizzes([]);
        return;
      }

      const quizIds = assignments.map((a) => a.quiz_id);

      const { data: results, error: resultError } = await supabase
        .from("quiz_results")
        .select("*")
        .eq("student_id", studentId)
        .in("quiz_id", quizIds);

      if (resultError) throw resultError;

      const resultMap: Record<string, any> = {};
      results?.forEach((r) => {
        resultMap[r.quiz_id] = r;
      });

      const items: MyQuizItem[] = assignments.map((a: any) => {
        const result = resultMap[a.quiz_id];
        return {
          quiz_id: a.quiz_id,
          quiz_title: a.quizzes?.title || "삭제된 퀴즈",
          class_id: a.class_id,
          class_name: classNameMap[a.class_id] || "알 수 없는 클래스",
          assigned_at: a.assigned_at,
          result_id: result?.id || null,
          score: result?.score ?? null,
          total_questions: result?.total_questions ?? null,
          completed_at: result?.completed_at || null,
          status: result ? "completed" : "pending",
          answers: result?.answers || null,
          fill_blank_score: result?.fill_blank_score ?? null,
          fill_blank_total: result?.fill_blank_total ?? null,
          sentence_making_score: result?.sentence_making_score ?? null,
          sentence_making_total: result?.sentence_making_total ?? null,
          recording_score: result?.recording_score ?? null,
          recording_total: result?.recording_total ?? null,
          sentence_making_enabled: a.quizzes?.sentence_making_enabled ?? false,
          recording_enabled: a.quizzes?.recording_enabled ?? false,
          is_anonymous: false,
          student_profile: null,
          anonymous_name: null,
        };
      });

      items.sort((a, b) => {
        if (a.status === "pending" && b.status === "completed") return -1;
        if (a.status === "completed" && b.status === "pending") return 1;
        if (a.status === "completed" && b.status === "completed") {
          return new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime();
        }
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      });

      setQuizzes(items);
    } catch (e) {
      console.error("Error fetching my quizzes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return { quizzes, isLoading };
}
