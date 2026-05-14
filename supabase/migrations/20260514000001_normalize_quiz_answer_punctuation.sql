-- Allow trailing punctuation in fill-in-blank answers.
-- e.g. student writes "명사예요." but correct answer is "명사예요" → still correct.

CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  _quiz_id uuid,
  _student_answers jsonb,
  _problem_order text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _quiz_exists boolean;
  _is_assigned boolean;
  _score integer := 0;
  _total integer := 0;
  _user_answer text;
  _correct_answer text;
  _result_id uuid;
  _answers_array jsonb := '[]'::jsonb;
  _quiz_problems jsonb;
  _problem jsonb;
  _problem_id text;
  _temp_answers jsonb := '{}'::jsonb;
  _is_redo boolean := false;
  _student_name text;
  _ordered_id text;
BEGIN
  _student_id := auth.uid();
  IF _student_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT has_role(_student_id, 'student') THEN RAISE EXCEPTION 'Only students can submit quiz answers'; END IF;

  SELECT EXISTS (SELECT 1 FROM quizzes WHERE id = _quiz_id) INTO _quiz_exists;
  IF NOT _quiz_exists THEN RAISE EXCEPTION 'Quiz not found'; END IF;

  SELECT is_quiz_assigned_to_student(_quiz_id, _student_id) INTO _is_assigned;
  IF NOT _is_assigned THEN RAISE EXCEPTION 'Quiz not assigned to student'; END IF;

  SELECT problems INTO _quiz_problems FROM quizzes WHERE id = _quiz_id;
  IF _quiz_problems IS NULL THEN RAISE EXCEPTION 'Quiz problems not found'; END IF;

  -- First pass: score and build keyed map
  FOR _problem IN SELECT * FROM jsonb_array_elements(_quiz_problems)
  LOOP
    _total := _total + 1;
    _problem_id := _problem->>'id';
    _correct_answer := _problem->>'answer';

    -- Normalize: lowercase, trim, strip trailing punctuation
    _user_answer := LOWER(TRIM(REGEXP_REPLACE(COALESCE(_student_answers->>_problem_id, ''), '[.。!?！？,，\s]+$', '')));

    IF _user_answer = LOWER(TRIM(REGEXP_REPLACE(COALESCE(_correct_answer, ''), '[.。!?！？,，\s]+$', ''))) THEN
      _score := _score + 1;
    END IF;

    _temp_answers := _temp_answers || jsonb_build_object(_problem_id, jsonb_build_object(
      'problemId', _problem_id,
      'userAnswer', COALESCE(_student_answers->>_problem_id, ''),
      'correctAnswer', _correct_answer,
      'isCorrect', (_user_answer = LOWER(TRIM(REGEXP_REPLACE(COALESCE(_correct_answer, ''), '[.。!?！？,，\s]+$', '')))),
      'sentence', COALESCE(_problem->>'sentence', '문제 내용 없음'),
      'translation', COALESCE(_problem->>'translation', ''),
      'audioUrl', _problem->>'sentence_audio_url',
      'word', _problem->>'word'
    ));
  END LOOP;

  -- Second pass: build ordered answers array
  IF _problem_order IS NOT NULL AND array_length(_problem_order, 1) > 0 THEN
    FOREACH _ordered_id IN ARRAY _problem_order
    LOOP
      IF _temp_answers ? _ordered_id THEN
        _answers_array := _answers_array || jsonb_build_array(_temp_answers->_ordered_id);
      END IF;
    END LOOP;
  ELSE
    FOR _problem IN SELECT * FROM jsonb_array_elements(_quiz_problems)
    LOOP
      _problem_id := _problem->>'id';
      IF _temp_answers ? _problem_id THEN
        _answers_array := _answers_array || jsonb_build_array(_temp_answers->_problem_id);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers, fill_blank_score, fill_blank_total)
  VALUES (_quiz_id, _student_id, _score, _total, _answers_array, _score, _total)
  RETURNING id INTO _result_id;

  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE quiz_id = _quiz_id AND from_user_id = _student_id AND type = 'quiz_completed'
  ) INTO _is_redo;

  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  DELETE FROM notifications
  WHERE quiz_id = _quiz_id AND from_user_id = _student_id AND type = 'quiz_completed';

  INSERT INTO notifications (user_id, type, title, message, quiz_id, from_user_id)
  SELECT
    q.teacher_id,
    'quiz_completed'::notification_type,
    _student_name || korean_subject_postfix(_student_name) || ' 빈칸 채우기 퀴즈를 ' ||
      CASE WHEN _is_redo THEN '다시 풀었습니다.' ELSE '완료했습니다.' END,
    q.title || ' — 빈칸 채우기: ' || _score::text || '/' || _total::text,
    _quiz_id,
    _student_id
  FROM quizzes q WHERE q.id = _quiz_id;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', _result_id,
    'score', _score,
    'total', _total,
    'is_redo', _is_redo
  );
END;
$$;
