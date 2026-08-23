-- get_quiz_for_student이 돌려주는 jsonb에 kind를 추가한다.
-- QuizTake.tsx가 이 값을 보고 kind='wrong_review'인 퀴즈를 채점할 때
-- update_wa_progress를 함께 호출해 오답노트 진행도(익힌 단어 판정)에 반영한다.
-- 함수 본문은 20260621000003_hybrid_fill_blank_optional.sql의 최신 정의를 그대로
-- 따르고 kind 한 필드만 추가했다.
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

  IF NOT is_quiz_assigned_to_student(_quiz_id, _student_id) THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;

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
    'fill_blank_enabled', fill_blank_enabled,
    'sentence_making_enabled', sentence_making_enabled,
    'recording_enabled', recording_enabled,
    'matchup_enabled', matchup_enabled,
    'type_answer_enabled', type_answer_enabled,
    'word_magnet_enabled', word_magnet_enabled,
    'kind', kind
  ) INTO _quiz_data
  FROM quizzes
  WHERE id = _quiz_id;

  IF _quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

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
