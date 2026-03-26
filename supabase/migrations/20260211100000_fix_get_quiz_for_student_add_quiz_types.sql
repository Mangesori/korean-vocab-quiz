-- get_quiz_for_student RPC에 sentence_making_enabled, recording_enabled 필드 추가
-- 이 필드가 없으면 학생이 빈칸 채우기 후 문장 만들기/녹음 단계로 전환되지 않음

CREATE OR REPLACE FUNCTION public.get_quiz_for_student(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _quiz_data jsonb;
  _problems jsonb;
  _sanitized_problems jsonb := '[]'::jsonb;
  _problem jsonb;
BEGIN
  _student_id := auth.uid();

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 퀴즈 할당 확인
  IF NOT is_quiz_assigned_to_student(_quiz_id, _student_id) THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;

  -- 퀴즈 데이터 가져오기
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'difficulty', difficulty,
    'timer_enabled', timer_enabled,
    'timer_seconds', timer_seconds,
    'words', words,
    'words_per_set', words_per_set,
    'translation_language', translation_language,
    'teacher_id', teacher_id,
    'problems', problems,
    'sentence_making_enabled', sentence_making_enabled,
    'recording_enabled', recording_enabled
  ) INTO _quiz_data
  FROM quizzes
  WHERE id = _quiz_id;

  IF _quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  -- 문제에서 정답(answer) 필드 제거
  _problems := _quiz_data->'problems';

  FOR _problem IN SELECT * FROM jsonb_array_elements(_problems)
  LOOP
    _sanitized_problems := _sanitized_problems || jsonb_build_object(
      'id', _problem->>'id',
      'word', _problem->>'word',
      'sentence', _problem->>'sentence',
      'hint', _problem->>'hint',
      'translation', _problem->>'translation'
    );
  END LOOP;

  RETURN jsonb_set(_quiz_data, '{problems}', _sanitized_problems);
END;
$$;
