-- Intermediate save for sentence-making stage score (SECURITY DEFINER bypasses RLS)
-- Called right after sentence-making completes so checkProgress can detect it on re-entry
CREATE OR REPLACE FUNCTION public.update_quiz_result_sentence_score(
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
    sentence_making_score = _score,
    sentence_making_total = _total
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_sentence_score(UUID, INTEGER, INTEGER) TO authenticated;
