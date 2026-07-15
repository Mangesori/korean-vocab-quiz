-- 반 단위 오답 수집 RPC: 선생님 오답 퀴즈 화면이 quiz_results.answers를 직접 파싱해
-- 빈칸 채우기 오답만 잡던 문제를 고친다. get_student_wrong_answers의 4개 분기(빈칸 채우기/
-- 짝 맞추기/단어 받아쓰기/문장 순서 맞추기)를 그대로 쓰되 여러 학생을 한 번에 조회하고,
-- 어떤 학생의 오답인지 알 수 있게 student_id를 함께 반환한다(집계는 클라이언트가 담당).
-- 권한은 _student_ids 중 호출자가 담당 교사인 학생만 남긴 _allowed로 제한한다.

CREATE OR REPLACE FUNCTION public.get_class_wrong_answers(_student_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT cm.student_id), '{}')
  INTO _allowed
  FROM public.class_members cm
  JOIN public.classes c ON c.id = cm.class_id
  WHERE cm.student_id = ANY(_student_ids) AND c.teacher_id = auth.uid();

  IF array_length(_allowed, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(sub.obj ORDER BY sub.completed_at DESC)
    FROM (
      -- 빈칸 채우기 (quiz_results.answers jsonb)
      SELECT jsonb_build_object(
        'student_id', r.student_id,
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
      WHERE r.student_id = ANY(_allowed)
        AND COALESCE((elem->>'isCorrect')::boolean, false) = false

      UNION ALL
      -- 짝 맞추기
      SELECT jsonb_build_object(
        'student_id', a.student_id,
        'quiz_title', q.title, 'word', p.korean_text, 'correct_answer', p.meaning_text,
        'user_answer', COALESCE(a.selected_meaning,''), 'sentence', '',
        'translation', NULL, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'matchup'
      ) AS obj, r.completed_at
      FROM public.matchup_answers a
      JOIN public.matchup_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = ANY(_allowed) AND a.is_correct = false

      UNION ALL
      -- 단어 받아쓰기
      SELECT jsonb_build_object(
        'student_id', a.student_id,
        'quiz_title', q.title, 'word', p.answer, 'correct_answer', p.answer,
        'user_answer', COALESCE(a.student_answer,''), 'sentence', COALESCE(p.prompt,''),
        'translation', NULL, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'type_answer'
      ) AS obj, r.completed_at
      FROM public.type_answer_answers a
      JOIN public.type_answer_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = ANY(_allowed) AND a.is_correct = false

      UNION ALL
      -- 문장 순서 맞추기
      SELECT jsonb_build_object(
        'student_id', a.student_id,
        'quiz_title', q.title, 'word', p.base_text, 'correct_answer', p.base_text,
        'user_answer', COALESCE(a.student_sentence,''), 'sentence', '',
        'translation', p.translation, 'audio_url', NULL, 'completed_at', r.completed_at, 'source', 'word_magnet'
      ) AS obj, r.completed_at
      FROM public.word_magnet_answers a
      JOIN public.word_magnet_problems p ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
      JOIN public.quiz_results r ON r.id = a.result_id
      JOIN public.quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = ANY(_allowed) AND a.is_correct = false
    ) sub
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_wrong_answers(uuid[]) TO authenticated;
