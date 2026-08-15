import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_ORDER, isStageEnabled, type BaseStage } from "@/types/quiz";

const STAGE_SCORE_KEY: Record<BaseStage, string> = {
  matchup: "matchup_score",
  type_answer: "type_answer_score",
  fill_blank: "fill_blank_score",
  word_magnet: "word_magnet_score",
  sentence_making: "sentence_making_score",
  recording: "recording_score",
};

export interface MyQuizItem {
  quiz_id: string;
  quiz_title: string;
  class_id: string | null;
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
  matchup_score: number | null;
  matchup_total: number | null;
  type_answer_score: number | null;
  type_answer_total: number | null;
  word_magnet_score: number | null;
  word_magnet_total: number | null;
  fill_blank_enabled: boolean;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
  matchup_enabled: boolean;
  type_answer_enabled: boolean;
  word_magnet_enabled: boolean;
  difficulty: string | null;
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
      // class_members에는 "Students can view their own memberships"(student_id = auth.uid())
      // 정책이 있어 학생이 자기 소속을 그대로 읽을 수 있다. 예전엔 존재하지 않는
      // student_class_members 뷰를 조회해 이 화면이 항상 비어 있었다.
      const { data: memberships, error: memberError } = await supabase
        .from("class_members")
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

      // class_id로 배정된 것(반 전체)뿐 아니라 student_id로 나에게만 개별
      // 배정된 것도 봐야 한다(예: 어휘 보강 퀴즈). classIds가 비어 있으면
      // `class_id.in.()` 문법이 깨지므로 그때는 student_id 단독 조건만 건다.
      let assignmentsQuery = supabase
        .from("quiz_assignments")
        .select(`
          quiz_id,
          class_id,
          assigned_at,
          quizzes (
            id,
            title,
            difficulty,
            fill_blank_enabled,
            sentence_making_enabled,
            recording_enabled,
            matchup_enabled,
            type_answer_enabled,
            word_magnet_enabled
          )
        `);
      assignmentsQuery =
        classIds.length > 0
          ? assignmentsQuery.or(`class_id.in.(${classIds.join(",")}),student_id.eq.${studentId}`)
          : assignmentsQuery.eq("student_id", studentId);

      const { data: assignments, error: assignError } = await assignmentsQuery;

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        setQuizzes([]);
        return;
      }

      // 같은 퀴즈가 클래스 배정 + 개인 배정 등 여러 경로로 중복 배정될 수 있다
      // (대시보드와 같은 문제). quiz_id 기준으로 한 번만 남기고, 출처는 라벨로 합친다.
      const byQuizId = new Map<string, { assignment: any; labels: string[] }>();
      assignments.forEach((a: any) => {
        const label = a.class_id ? (classNameMap[a.class_id] || "알 수 없는 클래스") : "개인 과제";
        const existing = byQuizId.get(a.quiz_id);
        if (existing) {
          if (!existing.labels.includes(label)) existing.labels.push(label);
          // 클래스 배정을 대표로 삼는다 — class_id가 있어야 반 이름을 보여줄 수 있다.
          if (a.class_id && !existing.assignment.class_id) existing.assignment = a;
        } else {
          byQuizId.set(a.quiz_id, { assignment: a, labels: [label] });
        }
      });
      const dedupedAssignments = [...byQuizId.values()];

      const quizIds = dedupedAssignments.map(({ assignment }) => assignment.quiz_id);

      const { data: results, error: resultError } = await supabase
        .from("quiz_results")
        .select("*")
        .eq("student_id", studentId)
        .in("quiz_id", quizIds)
        .order("completed_at", { ascending: true });

      if (resultError) throw resultError;

      // 정렬을 ascending으로 걸고 마지막에 덮어쓰는 순서로 채워서, 재시도로 결과가
      // 여러 건이어도 항상 가장 최근 제출이 남는다.
      const resultMap: Record<string, any> = {};
      results?.forEach((r) => {
        resultMap[r.quiz_id] = r;
      });

      const items: MyQuizItem[] = dedupedAssignments.map(({ assignment: a, labels }) => {
        const result = resultMap[a.quiz_id];
        // "결과 행이 있다"만으로는 완료가 아니다 — 스테이지별로 부분 제출된 결과 행도
        // 존재할 수 있다. 활성 스테이지가 전부 채점됐을 때만 완료로 본다(대시보드·내
        // 클래스와 같은 기준).
        const quizFlags = a.quizzes ?? {};
        const isComplete =
          !!result &&
          STAGE_ORDER.every(
            (stage) => !isStageEnabled(stage, quizFlags) || typeof result[STAGE_SCORE_KEY[stage]] === "number"
          );
        return {
          quiz_id: a.quiz_id,
          quiz_title: a.quizzes?.title || "삭제된 퀴즈",
          class_id: a.class_id,
          class_name: labels.join(" · "),
          assigned_at: a.assigned_at,
          result_id: result?.id || null,
          score: result?.score ?? null,
          total_questions: result?.total_questions ?? null,
          completed_at: result?.completed_at || null,
          status: isComplete ? "completed" : "pending",
          answers: result?.answers || null,
          fill_blank_score: result?.fill_blank_score ?? null,
          fill_blank_total: result?.fill_blank_total ?? null,
          sentence_making_score: result?.sentence_making_score ?? null,
          sentence_making_total: result?.sentence_making_total ?? null,
          recording_score: result?.recording_score ?? null,
          recording_total: result?.recording_total ?? null,
          matchup_score: result?.matchup_score ?? null,
          matchup_total: result?.matchup_total ?? null,
          type_answer_score: result?.type_answer_score ?? null,
          type_answer_total: result?.type_answer_total ?? null,
          word_magnet_score: result?.word_magnet_score ?? null,
          word_magnet_total: result?.word_magnet_total ?? null,
          fill_blank_enabled: a.quizzes?.fill_blank_enabled ?? false,
          sentence_making_enabled: a.quizzes?.sentence_making_enabled ?? false,
          recording_enabled: a.quizzes?.recording_enabled ?? false,
          matchup_enabled: a.quizzes?.matchup_enabled ?? false,
          type_answer_enabled: a.quizzes?.type_answer_enabled ?? false,
          word_magnet_enabled: a.quizzes?.word_magnet_enabled ?? false,
          difficulty: a.quizzes?.difficulty ?? null,
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
