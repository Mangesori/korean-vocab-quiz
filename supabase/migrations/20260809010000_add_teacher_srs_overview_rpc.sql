-- 선생님이 자기 반 학생들의 SRS 단계 분포를 보는 RPC. wrong_answer_progress RLS는
-- student_id = auth.uid()만 허용하므로 선생님은 직접 조회 불가 — get_class_wrong_answers와
-- 같은 패턴으로 SECURITY DEFINER 안에서 담임 검증 후 반환한다.

CREATE OR REPLACE FUNCTION public.get_class_srs_summary(_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  stage smallint,
  word_count int,
  due_now_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.student_id, p.stage, count(*)::int,
         count(*) FILTER (WHERE p.due_at IS NOT NULL AND p.due_at <= now() AND p.mastered_at IS NULL)::int
    FROM public.wrong_answer_progress p
    JOIN public.class_members cm ON cm.student_id = p.student_id
    JOIN public.classes c ON c.id = cm.class_id
   WHERE cm.class_id = _class_id AND c.teacher_id = auth.uid()
   GROUP BY p.student_id, p.stage;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_srs_summary(uuid) TO authenticated;
