-- 유형별 채점 RPC가 자기 스테이지 점수만 갱신하고 집계 score/total_questions는
-- 건드리지 않아, "이어서 풀기"로 여러 세션에 걸쳐 유형을 깨는 학생은 최종 통합
-- 제출(finalize_quiz_result 호출) 전까지 총점이 예전 값에 멈춰 있었다.
-- (예: fill_blank만 반영된 14/20이 이후 matchup 20/20, word_magnet 8/20을 더
-- 풀어도 그대로 14/20으로 남음.) 세 함수 끝에 finalize_quiz_result 호출을
-- 추가해, 어느 유형을 완료하든 즉시 총점이 맞게 갱신되도록 한다.

CREATE OR REPLACE FUNCTION public.update_quiz_result_matchup_score(_result_id uuid, _score integer, _total integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quiz_results
  SET
    matchup_score = _score,
    matchup_total = _total
  WHERE id = _result_id;

  PERFORM public.finalize_quiz_result(_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quiz_result_type_answer_score(_result_id uuid, _score integer, _total integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quiz_results
  SET
    type_answer_score = _score,
    type_answer_total = _total
  WHERE id = _result_id;

  PERFORM public.finalize_quiz_result(_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quiz_result_word_magnet_score(_result_id uuid, _score integer, _total integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quiz_results
  SET
    word_magnet_score = _score,
    word_magnet_total = _total
  WHERE id = _result_id;

  PERFORM public.finalize_quiz_result(_result_id);
END;
$function$;

-- 기존에 잘못 저장된 집계 점수를 일괄 재계산(백필).
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
    COALESCE(recording_total, 0);
