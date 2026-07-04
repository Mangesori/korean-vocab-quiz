ALTER TABLE public.recording_problems
ADD COLUMN IF NOT EXISTS sort_order INTEGER,
ADD COLUMN IF NOT EXISTS label TEXT;

-- 기존 행: quiz_id별 created_at 순서로 0,1,2... 백필
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at) - 1 AS rn
  FROM public.recording_problems
)
UPDATE public.recording_problems r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;
