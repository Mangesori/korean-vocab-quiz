ALTER TABLE public.matchup_problems ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE public.type_answer_problems ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE public.word_magnet_problems ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE public.sentence_making_problems ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at) - 1 AS rn
  FROM public.matchup_problems
)
UPDATE public.matchup_problems r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at) - 1 AS rn
  FROM public.type_answer_problems
)
UPDATE public.type_answer_problems r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at) - 1 AS rn
  FROM public.word_magnet_problems
)
UPDATE public.word_magnet_problems r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at) - 1 AS rn
  FROM public.sentence_making_problems
)
UPDATE public.sentence_making_problems r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;
