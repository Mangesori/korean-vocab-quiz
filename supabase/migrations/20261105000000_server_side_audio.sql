-- 퀴즈 음성(TTS) 생성을 서버로 옮긴다.
--
-- 지금까지는 선생님 브라우저가 퀴즈 저장 후 화면 뒤에서 음성을 하나씩 만들었다. 탭을 닫으면
-- 거기서 멈춰서 운영 데이터에 음성이 빠진 행이 많이 쌓였다. 이제는
--   - 엣지 함수 process-audio가 "음성이 필요한 행"을 점유(claim)해서 만들고,
--   - pg_cron이 1분마다(처리할 행이 있을 때만) 그 함수를 깨워 남은 것을 끝까지 채운다.
--
-- 이 파일은 여러 번 실행해도 안전하다(IF NOT EXISTS / CREATE OR REPLACE / 존재 확인 후 생성).
-- 비밀 값(함수 URL, cron 비밀)은 여기 넣지 않는다 — Vault에 이름으로 따로 만든다
-- (supabase/functions/process-audio/DEPLOY.md 참고).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 퀴즈별 음성 엔진
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS tts_provider text NOT NULL DEFAULT 'elevenlabs';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quizzes_tts_provider_check'
      AND conrelid = 'public.quizzes'::regclass
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_tts_provider_check CHECK (tts_provider IN ('elevenlabs', 'azure'));
  END IF;
END $$;

COMMENT ON COLUMN public.quizzes.tts_provider IS
  '음성 엔진. elevenlabs가 크레딧 소진(402)이면 서버가 azure로 대신 만든다.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 음성 작업 상태 컬럼
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_problems
  ADD COLUMN IF NOT EXISTS audio_text_hash text,
  ADD COLUMN IF NOT EXISTS audio_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_error text,
  ADD COLUMN IF NOT EXISTS audio_locked_until timestamptz;

ALTER TABLE public.recording_problems
  ADD COLUMN IF NOT EXISTS audio_text_hash text,
  ADD COLUMN IF NOT EXISTS audio_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_error text,
  ADD COLUMN IF NOT EXISTS audio_locked_until timestamptz;

-- 읽은 텍스트 자체는 저장하지 않는다: quiz_problems의 음성 텍스트는 빈칸에 정답을 채운 문장이라
-- 학생 화면이 이 표를 SELECT할 때 정답이 문자로 새어 나간다. 그래서 md5 해시만 남긴다.
COMMENT ON COLUMN public.quiz_problems.audio_text_hash IS
  'sentence_audio_url을 만들 때 읽은 (정리된) 텍스트의 md5 hex(소문자, UTF-8). NULL이고 URL이 있으면 서버 이전에 만든 음성(정상으로 취급).';
COMMENT ON COLUMN public.recording_problems.audio_text_hash IS
  'sentence_audio_url을 만들 때 읽은 (정리된) 텍스트의 md5 hex(소문자, UTF-8). NULL이고 URL이 있으면 서버 이전에 만든 음성(정상으로 취급).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 문장이 바뀌면 음성 무효화
--    같은 UPDATE에서 URL도 함께 바꾸면(서버가 새 음성을 넣는 경우 등) 건드리지 않는다.
--    recording_problems.mode만 바뀌는 건 문장 변경이 아니므로 아무것도 지우지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_audio_on_sentence_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sentence IS DISTINCT FROM OLD.sentence
     AND NEW.sentence_audio_url IS NOT DISTINCT FROM OLD.sentence_audio_url THEN
    NEW.sentence_audio_url := NULL;
    NEW.audio_text_hash := NULL;
    NEW.audio_error := NULL;
    NEW.audio_locked_until := NULL;
    NEW.audio_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_problems_reset_audio ON public.quiz_problems;
CREATE TRIGGER quiz_problems_reset_audio
  BEFORE UPDATE ON public.quiz_problems
  FOR EACH ROW EXECUTE FUNCTION public.reset_audio_on_sentence_change();

DROP TRIGGER IF EXISTS recording_problems_reset_audio ON public.recording_problems;
CREATE TRIGGER recording_problems_reset_audio
  BEFORE UPDATE ON public.recording_problems
  FOR EACH ROW EXECUTE FUNCTION public.reset_audio_on_sentence_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. "음성이 필요한 행"의 단일 정의
--    대상: quiz_problems 전부 + recording_problems 중 mode='listen'
--    필요: sentence_audio_url IS NULL
--      (URL이 있고 audio_text_hash가 NULL인 기존 행은 멀쩡한 것으로 본다 — 다시 만들지 않음)
--    처리 가능: 필요 AND audio_attempts < 5 AND 점유 만료(또는 점유 없음)
--    상태: ready(URL 있음) / failed(URL 없음, 5회 이상 실패) / pending(나머지)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audio_row_status(_url text, _attempts int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _url IS NOT NULL THEN 'ready'
    WHEN _attempts >= 5 THEN 'failed'
    ELSE 'pending'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audio_row_claimable(_url text, _attempts int, _locked_until timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.audio_row_status(_url, _attempts) = 'pending'
     AND (_locked_until IS NULL OR _locked_until < now());
$$;

-- 녹음(listen) 행은 같은 문제의 빈칸 채우기 행이 아직 pending이면 미뤄 둔다.
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
WHERE r.mode = 'listen';

-- PostgREST에 노출되지 않게(내부 작업용) 일반 역할 권한을 걷는다.
REVOKE ALL ON public.audio_work_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audio_work_items TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. audio_status: 화면에서 진행 상황 표시용
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audio_status(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  -- 소유 선생님 또는 관리자만. 아니면 조용히 NULL(관례: 권한 없을 때 예외 대신 빈 결과).
  IF NOT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = _quiz_id AND q.teacher_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'total',   count(*),
    'ready',   count(*) FILTER (WHERE w.status = 'ready'),
    'pending', count(*) FILTER (WHERE w.status = 'pending'),
    'failed',  count(*) FILTER (WHERE w.status = 'failed')
  )
  INTO _result
  FROM public.audio_work_items w
  WHERE w.quiz_id = _quiz_id;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audio_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audio_status(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. claim_audio_work: 엣지 함수(service_role) 전용 작업 점유
--    빈칸 채우기 행을 먼저, 남은 자리에 녹음 행. 최근 만든 퀴즈 행부터.
--    바깥 WHERE에 audio_row_claimable을 다시 두는 이유: FOR UPDATE가 잠금을 기다린 뒤
--    최신 행 버전으로 이 조건을 재평가하므로 동시 호출이 같은 행을 두 번 가져가지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
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

  RETURN QUERY
  WITH picked AS (
    SELECT r.id
    FROM public.recording_problems r
    WHERE r.mode = 'listen'
      AND public.audio_row_claimable(r.sentence_audio_url, r.audio_attempts, r.audio_locked_until)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. quiz_problems 행이 하나도 없는 퀴즈 보정
--    옛 화면은 음성을 전부 만든 뒤에야 quiz_problems를 넣었기 때문에 탭을 닫으면 행 자체가 없다.
--    방금 저장되어 옛 화면이 아직 음성을 만들고 있을 수 있는 퀴즈(1시간 이내)는 건드리지 않는다.
--    (2026-11-05 운영 확인: 3개 퀴즈, 65행 — DEPLOY.md 참고)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.quiz_problems (quiz_id, problem_id, word, sentence, hint, translation)
SELECT q.id, e->>'id', e->>'word', e->>'sentence', e->>'hint', e->>'translation'
FROM public.quizzes q
CROSS JOIN LATERAL jsonb_array_elements(q.problems) AS e
WHERE jsonb_typeof(q.problems) = 'array'
  AND q.created_at < now() - interval '1 hour'
  AND NOT EXISTS (SELECT 1 FROM public.quiz_problems p WHERE p.quiz_id = q.id)
  AND COALESCE(e->>'id', '') <> ''
  AND e->>'word' IS NOT NULL
  AND e->>'sentence' IS NOT NULL
ON CONFLICT (quiz_id, problem_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. pg_cron + pg_net: 1분마다 처리할 행이 있을 때만 process-audio 호출
--    함수 URL·cron 비밀은 Vault에서 이름으로 읽는다:
--      process_audio_url          예) https://<project-ref>.supabase.co/functions/v1/process-audio
--      process_audio_cron_secret  엣지 함수 비밀 AUDIO_CRON_SECRET과 같은 값
--    cron 작업은 "꺼진 상태"로만 등록한다. 켜는 건 DEPLOY.md ⑥단계(cron.alter_job).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.kick_process_audio()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.audio_work_items WHERE claimable) THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO _url
  FROM vault.decrypted_secrets WHERE name = 'process_audio_url' LIMIT 1;
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets WHERE name = 'process_audio_cron_secret' LIMIT 1;

  IF _url IS NULL OR _secret IS NULL THEN
    RAISE WARNING 'kick_process_audio: Vault 비밀(process_audio_url / process_audio_cron_secret)이 없어 건너뜀';
    RETURN NULL;
  END IF;

  RETURN net.http_post(
    url := _url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', _secret
    ),
    timeout_milliseconds := 10000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kick_process_audio() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-audio') THEN
    PERFORM cron.schedule('process-audio', '* * * * *', 'SELECT public.kick_process_audio();');
    PERFORM cron.alter_job(
      (SELECT jobid FROM cron.job WHERE jobname = 'process-audio'),
      active := false
    );
  END IF;
END $$;
