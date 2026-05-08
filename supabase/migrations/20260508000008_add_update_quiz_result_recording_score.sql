-- Intermediate save for recording stage score (SECURITY DEFINER bypasses RLS)
-- Called right after recording completes so checkProgress can detect it on re-entry
CREATE OR REPLACE FUNCTION public.update_quiz_result_recording_score(
  _result_id UUID,
  _score INTEGER,
  _total INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_results
  SET
    recording_score = _score,
    recording_total = _total
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_recording_score(UUID, INTEGER, INTEGER) TO authenticated;
