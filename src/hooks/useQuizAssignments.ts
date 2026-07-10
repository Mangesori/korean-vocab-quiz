import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignedClass {
  id: string;
  name: string;
  memberCount: number;
}

export function useQuizAssignments(quizId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["quiz-assignments", quizId],
    enabled: !!quizId,
    queryFn: async (): Promise<AssignedClass[]> => {
      const { data: assignments } = await (supabase as any)
        .from("quiz_assignments")
        .select("class_id, classes(id, name)")
        .eq("quiz_id", quizId);

      if (!assignments || assignments.length === 0) return [];

      // class_id 기준 dedupe (재할당으로 중복 행 존재 가능)
      const classMap = new Map<string, { id: string; name: string }>();
      for (const a of assignments as any[]) {
        const cls = a.classes;
        if (cls && !classMap.has(cls.id)) {
          classMap.set(cls.id, { id: cls.id, name: cls.name });
        }
      }
      const ids = Array.from(classMap.keys());
      if (ids.length === 0) return [];

      // 인원수 집계
      const { data: memberRows } = await supabase
        .from("class_members")
        .select("class_id")
        .in("class_id", ids);

      const countMap = new Map<string, number>();
      for (const m of (memberRows as any[]) ?? []) {
        countMap.set(m.class_id, (countMap.get(m.class_id) ?? 0) + 1);
      }

      return Array.from(classMap.values()).map((c) => ({
        ...c,
        memberCount: countMap.get(c.id) ?? 0,
      }));
    },
  });

  return { assignedClasses: data ?? [], isLoading };
}
