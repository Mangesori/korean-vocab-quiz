-- update_quiz_result_sentence_score / update_quiz_result_recording_score도
-- QuizTake.tsx에서 "중간 저장"(다른 유형이 끝나기 전에 이 유형만 먼저 저장)
-- 경로로 독립 호출된다 — matchup/type_answer/word_magnet와 같은 이유로
-- finalize_quiz_result를 안 부르면 집계 점수가 갱신되지 않는다.

CREATE OR REPLACE FUNCTION public.update_quiz_result_sentence_score(_result_id uuid, _score integer, _total integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quiz_results
  SET
    sentence_making_score = _score,
    sentence_making_total = _total
  WHERE id = _result_id;

  PERFORM public.finalize_quiz_result(_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quiz_result_recording_score(_result_id uuid, _score integer, _total integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quiz_results
  SET
    recording_score = _score,
    recording_total = _total
  WHERE id = _result_id;

  PERFORM public.finalize_quiz_result(_result_id);
END;
$function$;
