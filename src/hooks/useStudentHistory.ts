import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentQuizActivity {
  id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
  assigned_at: string;
  answers: any;
  status: "completed" | "pending";
  // per-type scores
  fill_blank_score: number | null;
  fill_blank_total: number | null;
  matchup_score: number | null;
  matchup_total: number | null;
  type_answer_score: number | null;
  type_answer_total: number | null;
  word_magnet_score: number | null;
  word_magnet_total: number | null;
  sentence_making_score: number | null;
  sentence_making_total: number | null;
  recording_score: number | null;
  recording_total: number | null;
  // quiz type flags
  fill_blank_enabled: boolean;
  matchup_enabled: boolean;
  type_answer_enabled: boolean;
  word_magnet_enabled: boolean;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
  // per-type submission times
  fill_blank_time: string | null;
  sentence_making_time: string | null;
  recording_time: string | null;
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
      const { data: assignedQuizzes, error: quizError } = await supabase
        .from("quiz_assignments")
        .select(`
          quiz_id,
          assigned_at,
          quizzes (
            id,
            title,
            fill_blank_enabled,
            matchup_enabled,
            type_answer_enabled,
            word_magnet_enabled,
            sentence_making_enabled,
            recording_enabled
          )
        `)
        .eq("class_id", classId);

      if (quizError) throw quizError;

      const quizIds = assignedQuizzes ? assignedQuizzes.map((cq) => cq.quiz_id) : [];

      const assignmentMap: Record<string, {
        title: string;
        assigned_at: string;
        fill_blank_enabled: boolean;
        matchup_enabled: boolean;
        type_answer_enabled: boolean;
        word_magnet_enabled: boolean;
        sentence_making_enabled: boolean;
        recording_enabled: boolean;
      }> = {};
      (assignedQuizzes || []).forEach((cq: any) => {
        assignmentMap[cq.quiz_id] = {
          title: cq.quizzes?.title || "삭제된 퀴즈",
          assigned_at: cq.assigned_at,
          fill_blank_enabled: cq.quizzes?.fill_blank_enabled ?? true,
          matchup_enabled: cq.quizzes?.matchup_enabled ?? false,
          type_answer_enabled: cq.quizzes?.type_answer_enabled ?? false,
          word_magnet_enabled: cq.quizzes?.word_magnet_enabled ?? false,
          sentence_making_enabled: cq.quizzes?.sentence_making_enabled ?? false,
          recording_enabled: cq.quizzes?.recording_enabled ?? false,
        };
      });

      const allActivities: StudentQuizActivity[] = [];
      const completedQuizIds = new Set<string>();

      if (quizIds.length > 0) {
        const { data: results, error: resultError } = await supabase
          .from("quiz_results")
          .select("*")
          .eq("student_id", studentId)
          .in("quiz_id", quizIds);

        if (resultError) throw resultError;

        if (results && results.length > 0) {
          const completedIds = results.map((r) => r.id);

          // Batch-fetch per-type submission times
          const [smAnswers, recAnswers] = await Promise.all([
            supabase
              .from("sentence_making_answers")
              .select("result_id, created_at")
              .in("result_id", completedIds)
              .order("created_at", { ascending: false }),
            supabase
              .from("recording_answers")
              .select("result_id, created_at")
              .in("result_id", completedIds)
              .order("created_at", { ascending: false }),
          ]);

          const smTimeMap: Record<string, string> = {};
          const recTimeMap: Record<string, string> = {};
          smAnswers.data?.forEach((a) => {
            if (!smTimeMap[a.result_id]) smTimeMap[a.result_id] = a.created_at;
          });
          recAnswers.data?.forEach((a) => {
            if (!recTimeMap[a.result_id]) recTimeMap[a.result_id] = a.created_at;
          });

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
              status: "completed",
              fill_blank_score: r.fill_blank_score ?? null,
              fill_blank_total: r.fill_blank_total ?? null,
              matchup_score: (r as any).matchup_score ?? null,
              matchup_total: (r as any).matchup_total ?? null,
              type_answer_score: (r as any).type_answer_score ?? null,
              type_answer_total: (r as any).type_answer_total ?? null,
              word_magnet_score: (r as any).word_magnet_score ?? null,
              word_magnet_total: (r as any).word_magnet_total ?? null,
              sentence_making_score: r.sentence_making_score ?? null,
              sentence_making_total: r.sentence_making_total ?? null,
              recording_score: r.recording_score ?? null,
              recording_total: r.recording_total ?? null,
              fill_blank_enabled: assignment?.fill_blank_enabled ?? true,
              matchup_enabled: assignment?.matchup_enabled ?? false,
              type_answer_enabled: assignment?.type_answer_enabled ?? false,
              word_magnet_enabled: assignment?.word_magnet_enabled ?? false,
              sentence_making_enabled: assignment?.sentence_making_enabled ?? false,
              recording_enabled: assignment?.recording_enabled ?? false,
              fill_blank_time: r.completed_at,
              sentence_making_time: smTimeMap[r.id] || null,
              recording_time: recTimeMap[r.id] || null,
            });
          });
        }
      }

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
            status: "pending",
            fill_blank_score: null,
            fill_blank_total: null,
            matchup_score: null,
            matchup_total: null,
            type_answer_score: null,
            type_answer_total: null,
            word_magnet_score: null,
            word_magnet_total: null,
            sentence_making_score: null,
            sentence_making_total: null,
            recording_score: null,
            recording_total: null,
            fill_blank_enabled: cq.quizzes?.fill_blank_enabled ?? true,
            matchup_enabled: cq.quizzes?.matchup_enabled ?? false,
            type_answer_enabled: cq.quizzes?.type_answer_enabled ?? false,
            word_magnet_enabled: cq.quizzes?.word_magnet_enabled ?? false,
            sentence_making_enabled: cq.quizzes?.sentence_making_enabled ?? false,
            recording_enabled: cq.quizzes?.recording_enabled ?? false,
            fill_blank_time: null,
            sentence_making_time: null,
            recording_time: null,
          });
        }
      });

      allActivities.sort((a, b) => {
        if (a.status === "pending" && b.status === "completed") return -1;
        if (a.status === "completed" && b.status === "pending") return 1;
        if (a.status === "completed" && b.status === "completed") {
          return new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime();
        }
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      });

      setActivities(allActivities);
    } catch (e) {
      console.error("Error fetching student history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return { activities, isLoading, refetch: fetchHistory };
}
