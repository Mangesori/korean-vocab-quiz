-- 오답노트 통합 수집 RPC: 4개 객관식 유형(빈칸 채우기/짝 맞추기/단어 받아쓰기/문장 순서 맞추기)의
-- 학생 본인 오답을 한 번에 조회한다. type_answer/word_magnet 정답은 RLS로 학생 직접 조회가 막혀
-- 있어(정답 노출 방지) SECURITY DEFINER로 우회하되, 본인(_student_id = auth.uid()) 또는
-- 해당 학생이 속한 클래스의 담당 교사만 조회 가능하게 제한한다.

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
        'translation', NULL, 'audio_url', NULL, 'source', 'matchup'
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
        'translation', NULL, 'audio_url', NULL, 'source', 'type_answer'
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
        'translation', p.translation, 'audio_url', NULL, 'source', 'word_magnet'
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
