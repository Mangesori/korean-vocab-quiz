-- 회귀 수정: get_student_wrong_answers가 completed_at을 반환하지 않아(정렬용으로만 사용)
-- 프론트에서 날짜가 빈 값이 되고 date-fns가 크래시했다. 4개 분기 반환 객체에 completed_at을 추가한다.
-- 순수 CREATE OR REPLACE (additive). 로직·권한·정렬은 20260710000000과 동일.

CREATE OR REPLACE FUNCTION public.get_student_wrong_answers(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
BEGIN
  _is_owner := (_student_id = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = _student_id AND c.teacher_id = auth.uid()
  );
  IF NOT _is_owner THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(sub.obj ORDER BY sub.completed_at DESC)
    FROM (
      -- 빈칸 채우기 (quiz_results.answers jsonb)
      SELECT jsonb_build_object(
        'quiz_title', q.title,
        'word', COALESCE(NULLIF(elem->>'word',''), elem->>'correctAnswer'),
        'correct_answer', elem->>'correctAnswer',
        'user_answer', COALESCE(elem->>'userAnswer',''),
        'sentence', COALESCE(elem->>'sentence',''),
        'translation', elem->>'translation',
        'audio_url', elem->>'audioUrl',
        'completed_at', r.completed_at,
        'source', 'fill_blank'
      ) AS obj, r.completed_at AS completed_at
      FROM public.quiz_results r
      JOIN public.quizzes q ON q.id = r.quiz_id
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.answers, '[]'::jsonb)) elem
      WHERE r.student_id = _student_id
        AND COALESCE((elem->>'isCorrect')::boolean, false) = false

      UNION ALL
      -- 짝 맞추기
      SELECT jsonb_build_object(
        'quiz_title', q.title, 'word', p.korean_text, 'correct_answer', p.meaning_text,
        'user_answer', COALESCE(a.selected_meaning,''), 'sentence', '',
        'translation', NULL, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'matchup'
      ) AS obj, r.completed_at
      FROM public.matchup_answers a
      JOIN public.matchup_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = _student_id AND a.is_correct = false

      UNION ALL
      -- 단어 받아쓰기
      SELECT jsonb_build_object(
        'quiz_title', q.title, 'word', p.answer, 'correct_answer', p.answer,
        'user_answer', COALESCE(a.student_answer,''), 'sentence', COALESCE(p.prompt,''),
        'translation', NULL, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'type_answer'
      ) AS obj, r.completed_at
      FROM public.type_answer_answers a
      JOIN public.type_answer_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = _student_id AND a.is_correct = false

      UNION ALL
      -- 문장 순서 맞추기
      SELECT jsonb_build_object(
        'quiz_title', q.title, 'word', p.base_text, 'correct_answer', p.base_text,
        'user_answer', COALESCE(a.student_sentence,''), 'sentence', '',
        'translation', p.translation, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'word_magnet'
      ) AS obj, r.completed_at
      FROM public.word_magnet_answers a
      JOIN public.word_magnet_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = _student_id AND a.is_correct = false
    ) sub
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_wrong_answers(uuid) TO authenticated;
