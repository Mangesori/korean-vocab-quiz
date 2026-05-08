-- Fix: upsert notification (DELETE + INSERT) instead of NOT EXISTS guard.
-- Checks whether a prior notification existed to mark re-attempts differently.
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  _quiz_id uuid,
  _student_answers jsonb
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
  _is_redo boolean := false;
BEGIN
  -- 1. 인증 및 권한 확인
  _student_id := auth.uid();
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT has_role(_student_id, 'student') THEN
    RAISE EXCEPTION 'Only students can submit quiz answers';
  END IF;

  -- 2. 퀴즈 존재 및 할당 확인
  SELECT EXISTS (SELECT 1 FROM quizzes WHERE id = _quiz_id) INTO _quiz_exists;
  IF NOT _quiz_exists THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  SELECT is_quiz_assigned_to_student(_quiz_id, _student_id) INTO _is_assigned;
  IF NOT _is_assigned THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;

  -- 3. 퀴즈 문제 데이터 가져오기 (정답 포함)
  SELECT problems INTO _quiz_problems
  FROM quizzes
  WHERE id = _quiz_id;

  IF _quiz_problems IS NULL THEN
     RAISE EXCEPTION 'Quiz problems not found';
  END IF;

  -- 4. 재도전 여부 확인 (기존 알림이 있으면 재도전)
  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE quiz_id      = _quiz_id
      AND from_user_id = _student_id
      AND type         = 'quiz_completed'
  ) INTO _is_redo;

  -- 5. 문제 순회 및 채점
  FOR _problem IN SELECT * FROM jsonb_array_elements(_quiz_problems)
  LOOP
    _total := _total + 1;
    _problem_id := _problem->>'id';
    _correct_answer := _problem->>'answer';

    _user_answer := LOWER(TRIM(COALESCE(_student_answers->>_problem_id, '')));

    IF _user_answer = LOWER(TRIM(_correct_answer)) THEN
      _score := _score + 1;
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _problem_id,
        'userAnswer', _student_answers->>_problem_id,
        'correctAnswer', _correct_answer,
        'isCorrect', true,
        'sentence', COALESCE(_problem->>'sentence', '문제 내용 없음'),
        'translation', COALESCE(_problem->>'translation', ''),
        'audioUrl', _problem->>'sentence_audio_url'
      );
    ELSE
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _problem_id,
        'userAnswer', COALESCE(_student_answers->>_problem_id, ''),
        'correctAnswer', _correct_answer,
        'isCorrect', false,
        'sentence', COALESCE(_problem->>'sentence', '문제 내용 없음'),
        'translation', COALESCE(_problem->>'translation', ''),
        'audioUrl', _problem->>'sentence_audio_url'
      );
    END IF;
  END LOOP;

  -- 6. 결과 저장
  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers)
  VALUES (_quiz_id, _student_id, _score, _total, _answers_array)
  RETURNING id INTO _result_id;

  -- 7. 교사 알림 upsert — 기존 알림 삭제 후 새로 INSERT
  DELETE FROM notifications
  WHERE quiz_id      = _quiz_id
    AND from_user_id = _student_id
    AND type         = 'quiz_completed';

  INSERT INTO notifications (user_id, type, title, message, quiz_id, from_user_id)
  SELECT
    q.teacher_id,
    'quiz_completed'::notification_type,
    CASE WHEN _is_redo
      THEN '학생이 퀴즈를 다시 풀기 시작했습니다'
      ELSE '학생이 퀴즈를 완료했습니다!'
    END,
    CASE WHEN _is_redo
      THEN '[재도전] ' || q.title || ' — 빈칸 채우기: ' || _score::text || '/' || _total::text
      ELSE q.title || ' 퀴즈 결과: ' || _score::text || '/' || _total::text || '점'
    END,
    _quiz_id,
    _student_id
  FROM quizzes q WHERE q.id = _quiz_id;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', _result_id,
    'score', _score,
    'total', _total
  );
END;
$$;
