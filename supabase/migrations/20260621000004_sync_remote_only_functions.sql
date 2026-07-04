-- 원격 DB에만 존재하던 함수들을 리포지토리에 박제(버전 관리)한다.
-- 이미 원격에 존재하므로 db push 시 CREATE OR REPLACE는 사실상 no-op이며,
-- 새 환경 재구축 및 가독성/관리성을 위해 정의를 명시한다.
-- (실제 운영 DB에서 pg_get_functiondef로 추출한 정의 그대로)

-- update_quiz_progress_notification (4-param: _stage 포함) — 단계별 진행 알림 갱신
CREATE OR REPLACE FUNCTION public.update_quiz_progress_notification(_quiz_id uuid, _student_id uuid, _stage text, _message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(uuid, uuid, text, text) TO authenticated;

-- update_quiz_progress_notification (5-param: _stage + _is_redo) — QuizTake가 실제로 호출하는 버전
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
BEGIN
  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  _stage_phrase := CASE _stage
    WHEN '문장 만들기' THEN '문장 만들기 퀴즈를'
    WHEN '말하기 연습' THEN '말하기 연습 퀴즈를'
    ELSE _stage || ' 퀴즈를'
  END;

  _verb := CASE WHEN _is_redo THEN '다시 풀었습니다.' ELSE '완료했습니다.' END;

  UPDATE public.notifications
  SET
    title      = _student_name || korean_subject_postfix(_student_name) || ' ' || _stage_phrase || ' ' || _verb,
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
$function$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(uuid, uuid, text, text, boolean) TO authenticated;

-- update_quiz_result_scores — 유형별 점수 컬럼만 COALESCE 갱신 (집계 score는 건드리지 않음).
-- 집계 score/total_questions 확정은 finalize_quiz_result(20260621000003)가 담당한다.
CREATE OR REPLACE FUNCTION public.update_quiz_result_scores(_result_id uuid, _fill_blank_score integer DEFAULT NULL::integer, _fill_blank_total integer DEFAULT NULL::integer, _sentence_making_score integer DEFAULT NULL::integer, _sentence_making_total integer DEFAULT NULL::integer, _recording_score integer DEFAULT NULL::integer, _recording_total integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _student_id uuid;
  _result_owner uuid;
BEGIN
  _student_id := auth.uid();
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT student_id INTO _result_owner
  FROM quiz_results
  WHERE id = _result_id;

  IF _result_owner IS NULL THEN
    RAISE EXCEPTION 'Result not found';
  END IF;

  IF _result_owner != _student_id THEN
    RAISE EXCEPTION 'Not authorized to update this result';
  END IF;

  UPDATE quiz_results
  SET
    fill_blank_score = COALESCE(_fill_blank_score, fill_blank_score),
    fill_blank_total = COALESCE(_fill_blank_total, fill_blank_total),
    sentence_making_score = COALESCE(_sentence_making_score, sentence_making_score),
    sentence_making_total = COALESCE(_sentence_making_total, sentence_making_total),
    recording_score = COALESCE(_recording_score, recording_score),
    recording_total = COALESCE(_recording_total, recording_total)
  WHERE id = _result_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_scores(uuid, integer, integer, integer, integer, integer, integer) TO authenticated;
