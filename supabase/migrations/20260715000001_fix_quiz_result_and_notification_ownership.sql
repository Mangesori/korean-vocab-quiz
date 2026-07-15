-- 빈칸 채우기 RPC의 "결과 행·알림 독점" 제거.
--
-- 레거시 설계에서 submit_quiz_answers는 빈칸이 유일한 퀴즈 유형이라는 전제로
-- (1) quiz_results 행을 무조건 새로 INSERT하고 (2) 기존 알림을 DELETE 후 재INSERT했다.
-- 그런데 STAGE_ORDER상 짝맞추기·받아쓰기가 빈칸보다 먼저 실행되므로:
--   짝맞추기 완료 → ensure_quiz_result가 결과행 A + 알림 생성(점수는 행 A)
--   빈칸 완료   → submit_quiz_answers가 결과행 B를 새로 INSERT(행 A 점수 고아)
--                 + 알림 DELETE→재INSERT(짝맞추기 알림 소멸)
-- 이 마이그레이션이 바꾸는 것: "결과 행 재사용", "알림 보존", "재시도(_is_redo) 판정".
-- 채점·정규화 로직은 20260514000001의 정의를 그대로 유지한다.
--
-- _is_redo도 같은 뿌리에서 깨져 있었다. "알림이 존재하는가"로 판정했는데
-- 같은 시도 안에서 ensure_quiz_result가 먼저 알림을 만들어, 첫 시도인데도
-- submit_quiz_answers가 is_redo=true를 반환 → 이후 모든 스테이지 알림이
-- "다시 풀었습니다."로 표시됐다. 판정 기준을 "이전 시도의 결과 행이 있는가"로 바꾼다.
-- (is_redo는 알림 문구 결정에만 쓰인다.)

-- 1) submit_quiz_answers — _result_id를 받으면 그 행을 UPDATE하고, 알림은 지우지 않는다.
--
-- 기존 3-param 시그니처를 먼저 DROP한다. CREATE OR REPLACE로 파라미터를 추가하면
-- 교체가 아니라 새 오버로드가 되어, 기존 3-인자 호출이 두 후보(3-param과 DEFAULT를
-- 가진 4-param) 모두에 매칭돼 "function is not unique" 에러가 난다.
-- DROP 후 4-param 하나만 남기면 3-인자 호출은 DEFAULT로 그대로 동작한다(하위호환 유지).
DROP FUNCTION IF EXISTS public.submit_quiz_answers(uuid, jsonb, text[]);

CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  _quiz_id uuid,
  _student_answers jsonb,
  _problem_order text[] DEFAULT NULL,
  _result_id uuid DEFAULT NULL
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
  _answers_array jsonb := '[]'::jsonb;
  _quiz_problems jsonb;
  _problem jsonb;
  _problem_id text;
  _temp_answers jsonb := '{}'::jsonb;
  _is_redo boolean := false;
  _notification_exists boolean := false;
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

  -- 재시도 판정 — "이전 시도의 결과 행이 있는가"로 본다.
  -- 예전엔 알림 존재 여부로 판정했으나, 같은 시도 안에서 ensure_quiz_result가 먼저
  -- 알림을 만들어버려 첫 시도에도 항상 true가 됐다. _result_id가 있으면 그 행은
  -- 이번 시도가 만든 것이므로 제외한다.
  -- ※ 반드시 아래 INSERT보다 먼저 계산해야 한다(_result_id가 NULL인 경로에서
  --    INSERT 후에 세면 방금 만든 행을 이전 시도로 오인한다).
  SELECT EXISTS (
    SELECT 1 FROM quiz_results
    WHERE quiz_id = _quiz_id
      AND student_id = _student_id
      AND (_result_id IS NULL OR id <> _result_id)
  ) INTO _is_redo;

  -- 결과 행: 앞선 스테이지가 만든 행이 있으면 재사용(UPDATE), 없을 때만 새로 INSERT.
  -- 집계 score/total_questions는 이후 finalize_quiz_result가 모든 유형을 합산해 확정한다.
  IF _result_id IS NOT NULL THEN
    UPDATE quiz_results
    SET
      answers = _answers_array,
      score = _score,
      total_questions = _total,
      fill_blank_score = _score,
      fill_blank_total = _total
    WHERE id = _result_id;
  ELSE
    INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers, fill_blank_score, fill_blank_total)
    VALUES (_quiz_id, _student_id, _score, _total, _answers_array, _score, _total)
    RETURNING id INTO _result_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE quiz_id = _quiz_id AND from_user_id = _student_id AND type = 'quiz_completed'
  ) INTO _notification_exists;

  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  -- 알림: 이미 있으면 건드리지 않는다(뒤이어 프론트의 update_quiz_progress_notification이 갱신).
  -- 없을 때만 INSERT하며, 문구는 ensure_quiz_result와 동일한 중립형을 쓴다
  -- ("빈칸 채우기" 하드코딩 제거 — 빈칸은 여러 스테이지 중 하나일 뿐이다).
  -- 가드는 _is_redo가 아니라 알림 존재 여부여야 한다. _is_redo는 이제 "이전 결과 행 존재"라
  -- 뜻이 달라서, 앞선 스테이지가 만든 알림이 있어도 false가 되어 중복 INSERT를 낸다.
  IF NOT _notification_exists THEN
    -- CASE는 죽은 코드가 아니다: 알림이 없으면서(_notification_exists=false)
    -- 이전 시도 행은 있는(_is_redo=true) 경우가 있다(예: 선생님이 알림을 읽고 지운 뒤 재시도).
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
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', _result_id,
    'score', _score,
    'total', _total,
    'is_redo', _is_redo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answers(uuid, jsonb, text[], uuid) TO authenticated;

-- 2) ensure_quiz_result — _is_redo를 submit_quiz_answers와 같은 기준으로 맞춘다.
-- 베이스는 20260621000003의 정의. 시그니처가 같아 DROP 불필요.
-- 알림 DELETE 후 INSERT는 그대로 둔다 — 이 함수는 시도의 시작점이라
-- 이전 시도의 알림을 지우고 새로 만드는 게 맞다.
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

  -- 재시도 판정 — 알림 존재가 아니라 이전 시도의 결과 행 존재로 본다.
  -- ※ 반드시 아래 INSERT보다 먼저 계산해야 한다(뒤에 세면 방금 만든 행을 이전 시도로 오인).
  SELECT EXISTS (
    SELECT 1 FROM quiz_results
    WHERE quiz_id = _quiz_id AND student_id = _student_id
  ) INTO _is_redo;

  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers)
  VALUES (_quiz_id, _student_id, 0, 0, '[]'::jsonb)
  RETURNING id INTO _result_id;

  -- 교사 알림. 이후 단계별 진행 알림이 이 메시지를 덮어쓴다.
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

-- 3) update_quiz_progress_notification (5-param) — UPSERT로.
-- 알림이 없으면 기존에는 0행 UPDATE로 조용히 사라졌다. 이제 INSERT로 폴백한다.
-- ※ 3-param/4-param 오버로드는 이번 범위 밖(불필요한 위험 회피).
CREATE OR REPLACE FUNCTION public.update_quiz_progress_notification(_quiz_id uuid, _student_id uuid, _stage text, _message text, _is_redo boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _student_name text;
  _stage_phrase text;
  _verb text;
  _title text;
  _updated integer;
BEGIN
  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  _stage_phrase := CASE _stage
    WHEN '문장 만들기' THEN '문장 만들기 퀴즈를'
    WHEN '말하기 연습' THEN '말하기 연습 퀴즈를'
    ELSE _stage || ' 퀴즈를'
  END;

  _verb := CASE WHEN _is_redo THEN '다시 풀었습니다.' ELSE '완료했습니다.' END;

  _title := _student_name || korean_subject_postfix(_student_name) || ' ' || _stage_phrase || ' ' || _verb;

  UPDATE public.notifications
  SET
    title      = _title,
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

  GET DIAGNOSTICS _updated = ROW_COUNT;

  -- 갱신할 알림이 없으면(레거시 데이터·알림 유실 등) 새로 만든다.
  IF _updated = 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, quiz_id, from_user_id)
    SELECT
      q.teacher_id,
      'quiz_completed'::notification_type,
      _title,
      _message,
      _quiz_id,
      _student_id
    FROM quizzes q WHERE q.id = _quiz_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(uuid, uuid, text, text, boolean) TO authenticated;
