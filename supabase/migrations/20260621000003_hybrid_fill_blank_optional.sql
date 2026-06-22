-- 하이브리드 backbone: 빈칸 채우기를 학생 스테이지로 보일지 선택 가능하게.
-- 빈칸 문제(quizzes.problems)는 콘텐츠 소스로 항상 생성·저장되지만, 학생에게 빈칸 스테이지를
-- 노출할지는 fill_blank_enabled로 제어한다. 빈칸이 꺼지면 결과 행을 빈칸 제출이 아닌
-- ensure_quiz_result로 생성한다. 모든 유형 점수를 합산하는 finalize_quiz_result도 추가한다.

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS fill_blank_enabled BOOLEAN NOT NULL DEFAULT true;

-- 1. 결과 행 생성 RPC (빈칸 미사용 퀴즈용). 빈칸 점수는 NULL로 둔다.
CREATE OR REPLACE FUNCTION public.ensure_quiz_result(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _result_id uuid;
  _is_redo boolean := false;
  _student_name text;
BEGIN
  _student_id := auth.uid();
  IF _student_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT has_role(_student_id, 'student') THEN RAISE EXCEPTION 'Only students can take quizzes'; END IF;
  IF NOT is_quiz_assigned_to_student(_quiz_id, _student_id) THEN RAISE EXCEPTION 'Quiz not assigned to student'; END IF;

  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers)
  VALUES (_quiz_id, _student_id, 0, 0, '[]'::jsonb)
  RETURNING id INTO _result_id;

  -- 교사 알림 (빈칸 제출 RPC와 동일 패턴). 이후 단계별 진행 알림이 이 메시지를 덮어쓴다.
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
    _student_name || korean_subject_postfix(_student_name) || ' 퀴즈를 ' ||
      CASE WHEN _is_redo THEN '다시 풀고 있습니다.' ELSE '완료했습니다.' END,
    q.title,
    _quiz_id,
    _student_id
  FROM quizzes q WHERE q.id = _quiz_id;

  RETURN jsonb_build_object('result_id', _result_id, 'is_redo', _is_redo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_quiz_result(uuid) TO authenticated;

-- 2. 모든 유형의 per-type 점수를 합산해 집계 score/total_questions를 확정한다.
-- (매치업·답입력·워드마그넷도 총점에 포함 — 기존 누락 해결)
CREATE OR REPLACE FUNCTION public.finalize_quiz_result(_result_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_results
  SET
    score =
      COALESCE(fill_blank_score, 0) +
      COALESCE(matchup_score, 0) +
      COALESCE(type_answer_score, 0) +
      COALESCE(word_magnet_score, 0) +
      COALESCE(sentence_making_score, 0) +
      COALESCE(recording_score, 0),
    total_questions =
      COALESCE(fill_blank_total, 0) +
      COALESCE(matchup_total, 0) +
      COALESCE(type_answer_total, 0) +
      COALESCE(word_magnet_total, 0) +
      COALESCE(sentence_making_total, 0) +
      COALESCE(recording_total, 0)
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_quiz_result(uuid) TO authenticated, anon;

-- 3. get_quiz_for_student RPC에 fill_blank_enabled 포함
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
    'word_magnet_enabled', word_magnet_enabled
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
