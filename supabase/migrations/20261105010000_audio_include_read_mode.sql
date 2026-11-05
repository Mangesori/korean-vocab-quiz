-- 보고 말하기(mode='read') 녹음 행도 서버에서 음성을 만든다. 단, 지난 퀴즈를 한꺼번에 채우지 않도록
-- 퀴즈마다 read_mode_audio 표시를 두고, 이 마이그레이션 시점에 이미 있던 퀴즈는 꺼 둔다(새 퀴즈는 기본 켜짐).
-- 듣고 말하기와 빈칸 채우기는 지금처럼 항상 대상이다.

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS read_mode_audio boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.quizzes.read_mode_audio IS
  '보고 말하기 문제도 서버가 음성을 만드는지. 2026-11-05 이전 퀴즈는 false로 시작(일괄 채우기 방지).';

UPDATE public.quizzes SET read_mode_audio = false
WHERE created_at < now() AND read_mode_audio;

-- 녹음 행은 같은 문제의 빈칸 채우기 행이 아직 pending이면 미뤄 둔다.
-- 빈칸 채우기 음성이 먼저 생기면 녹음 문장이 같을 때 TTS 없이 URL을 재사용할 수 있기 때문이다.
-- (빈칸 채우기 행이 최종 실패하면 더 이상 기다리지 않는다.)
CREATE OR REPLACE VIEW public.audio_work_items
WITH (security_invoker = true)
AS
SELECT
  'quiz_problems'::text AS tbl,
  p.id,
  p.quiz_id,
  p.problem_id,
  p.sentence_audio_url,
  p.audio_text_hash,
  p.audio_attempts,
  p.audio_error,
  p.audio_locked_until,
  p.created_at,
  public.audio_row_status(p.sentence_audio_url, p.audio_attempts) AS status,
  public.audio_row_claimable(p.sentence_audio_url, p.audio_attempts, p.audio_locked_until) AS claimable
FROM public.quiz_problems p
UNION ALL
SELECT
  'recording_problems'::text AS tbl,
  r.id,
  r.quiz_id,
  r.problem_id,
  r.sentence_audio_url,
  r.audio_text_hash,
  r.audio_attempts,
  r.audio_error,
  r.audio_locked_until,
  r.created_at,
  public.audio_row_status(r.sentence_audio_url, r.audio_attempts) AS status,
  public.audio_row_claimable(r.sentence_audio_url, r.audio_attempts, r.audio_locked_until)
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_problems qp
      WHERE qp.quiz_id = r.quiz_id
        AND qp.problem_id = r.problem_id
        AND public.audio_row_status(qp.sentence_audio_url, qp.audio_attempts) = 'pending'
    ) AS claimable
FROM public.recording_problems r
WHERE r.mode = 'listen'
   OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = r.quiz_id AND q.read_mode_audio);

REVOKE ALL ON public.audio_work_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audio_work_items TO service_role;

CREATE OR REPLACE FUNCTION public.claim_audio_work(_limit int, _quiz_id uuid DEFAULT NULL)
RETURNS TABLE(tbl text, id uuid, quiz_id uuid, problem_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _remaining int := LEAST(GREATEST(COALESCE(_limit, 0), 0), 100);
  _n int;
BEGIN
  IF _remaining = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT p.id
    FROM public.quiz_problems p
    WHERE public.audio_row_claimable(p.sentence_audio_url, p.audio_attempts, p.audio_locked_until)
      AND (_quiz_id IS NULL OR p.quiz_id = _quiz_id)
    ORDER BY p.created_at DESC, p.id
    LIMIT _remaining
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.quiz_problems p
  SET audio_locked_until = now() + interval '3 minutes',
      audio_attempts = p.audio_attempts + 1
  FROM picked
  WHERE p.id = picked.id
  RETURNING 'quiz_problems'::text, p.id, p.quiz_id, p.problem_id;

  GET DIAGNOSTICS _n = ROW_COUNT;
  _remaining := _remaining - _n;
  IF _remaining <= 0 THEN
    RETURN;
  END IF;

  -- 대상 판정(listen 또는 read_mode_audio 퀴즈)은 audio_work_items 뷰가 맡는다.
  RETURN QUERY
  WITH picked AS (
    SELECT r.id
    FROM public.recording_problems r
    WHERE public.audio_row_claimable(r.sentence_audio_url, r.audio_attempts, r.audio_locked_until)
      AND (_quiz_id IS NULL OR r.quiz_id = _quiz_id)
      AND r.id IN (
        SELECT w.id FROM public.audio_work_items w
        WHERE w.tbl = 'recording_problems' AND w.claimable
      )
    ORDER BY r.created_at DESC, r.id
    LIMIT _remaining
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.recording_problems r
  SET audio_locked_until = now() + interval '3 minutes',
      audio_attempts = r.audio_attempts + 1
  FROM picked
  WHERE r.id = picked.id
  RETURNING 'recording_problems'::text, r.id, r.quiz_id, r.problem_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_audio_work(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_audio_work(int, uuid) TO service_role;
