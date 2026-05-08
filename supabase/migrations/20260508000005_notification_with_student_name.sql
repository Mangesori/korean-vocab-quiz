-- Update submit_quiz_answers: include student name and stage in notification
-- Update update_quiz_progress_notification: accept _stage param, fetch name, build title
-- Both functions handle Korean 이/가 postposition based on 받침 of last character

-- Helper: returns '이' or '가' based on the last character's 받침
CREATE OR REPLACE FUNCTION public.korean_subject_postfix(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _cp integer;
BEGIN
  IF name IS NULL OR name = '' THEN RETURN '이(가)'; END IF;
  _cp := ascii(right(name, 1));
  -- Korean syllable range: U+AC00–U+D7A3
  IF _cp >= 44032 AND _cp <= 55203 THEN
    IF (_cp - 44032) % 28 = 0 THEN
      RETURN '가';   -- ends with vowel (받침 없음)
    ELSE
      RETURN '이';   -- ends with consonant (받침 있음)
    END IF;
  END IF;
  RETURN '이(가)';   -- non-Korean fallback
END;
$$;

GRANT EXECUTE ON FUNCTION public.korean_subject_postfix(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- submit_quiz_answers: formats initial notification with student name
-- ─────────────────────────────────────────────────────────────────────────────
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
  _student_name text;
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

  FOR _problem IN SELECT * FROM jsonb_array_elements(_quiz_problems)
  LOOP
    _total := _total + 1;
    _problem_id := _problem->>'id';
    _correct_answer := _problem->>'answer';
    _user_answer := LOWER(TRIM(COALESCE(_student_answers->>_problem_id, '')));

    IF _user_answer = LOWER(TRIM(_correct_answer)) THEN
      _score := _score + 1;
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _problem_id, 'userAnswer', _student_answers->>_problem_id,
        'correctAnswer', _correct_answer, 'isCorrect', true,
        'sentence', COALESCE(_problem->>'sentence', '문제 내용 없음'),
        'translation', COALESCE(_problem->>'translation', ''),
        'audioUrl', _problem->>'sentence_audio_url'
      );
    ELSE
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _problem_id, 'userAnswer', COALESCE(_student_answers->>_problem_id, ''),
        'correctAnswer', _correct_answer, 'isCorrect', false,
        'sentence', COALESCE(_problem->>'sentence', '문제 내용 없음'),
        'translation', COALESCE(_problem->>'translation', ''),
        'audioUrl', _problem->>'sentence_audio_url'
      );
    END IF;
  END LOOP;

  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers)
  VALUES (_quiz_id, _student_id, _score, _total, _answers_array)
  RETURNING id INTO _result_id;

  -- 재도전 여부 확인
  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE quiz_id = _quiz_id AND from_user_id = _student_id AND type = 'quiz_completed'
  ) INTO _is_redo;

  -- 학생 이름 조회
  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  -- 기존 알림 삭제 후 새로 생성 (upsert)
  DELETE FROM notifications
  WHERE quiz_id = _quiz_id AND from_user_id = _student_id AND type = 'quiz_completed';

  INSERT INTO notifications (user_id, type, title, message, quiz_id, from_user_id)
  SELECT
    q.teacher_id,
    'quiz_completed'::notification_type,
    CASE WHEN _is_redo
      THEN _student_name || korean_subject_postfix(_student_name) || ' 빈칸 채우기를 다시 풀었습니다.'
      ELSE _student_name || korean_subject_postfix(_student_name) || ' 빈칸 채우기를 완료했습니다.'
    END,
    q.title || ' — 빈칸 채우기: ' || _score::text || '/' || _total::text,
    _quiz_id,
    _student_id
  FROM quizzes q WHERE q.id = _quiz_id;

  RETURN jsonb_build_object('success', true, 'result_id', _result_id, 'score', _score, 'total', _total);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- update_quiz_progress_notification: overwrites the latest notification
-- _stage: '문장 만들기' | '말하기 연습' | '퀴즈'
-- _message: accumulated score string built by client
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_quiz_progress_notification(
  _quiz_id UUID,
  _student_id UUID,
  _stage TEXT,
  _message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_name text;
  _stage_phrase text;
BEGIN
  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  _stage_phrase := CASE _stage
    WHEN '문장 만들기' THEN '문장 만들기를'
    WHEN '말하기 연습' THEN '말하기 연습을'
    WHEN '퀴즈'       THEN '퀴즈를'
    ELSE _stage || '을(를)'
  END;

  UPDATE public.notifications
  SET
    title      = _student_name || korean_subject_postfix(_student_name) || ' ' || _stage_phrase || ' 완료했습니다.',
    message    = _message,
    is_read    = false,
    created_at = now()
  WHERE id = (
    SELECT id FROM public.notifications
    WHERE quiz_id      = _quiz_id
      AND from_user_id = _student_id
      AND type         = 'quiz_completed'
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(UUID, UUID, TEXT, TEXT) TO authenticated;
