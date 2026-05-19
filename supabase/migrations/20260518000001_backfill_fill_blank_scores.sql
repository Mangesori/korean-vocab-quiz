-- Retroactively re-grade fill-blank answers submitted before the punctuation
-- normalization migration (20260514000001). Strips trailing punctuation from
-- userAnswer/correctAnswer before comparing, then updates isCorrect in the
-- answers JSONB, fill_blank_score, and score accordingly.

UPDATE public.quiz_results qr
SET
  answers = (
    SELECT jsonb_agg(
      t.elem || jsonb_build_object(
        'isCorrect',
        LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'userAnswer', ''), '[.。!?！？,，\s]+$', '')))
        = LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'correctAnswer', ''), '[.。!?！？,，\s]+$', '')))
      )
      ORDER BY t.ord
    )
    FROM jsonb_array_elements(qr.answers) WITH ORDINALITY AS t(elem, ord)
  ),
  fill_blank_score = (
    SELECT COUNT(*)::integer
    FROM jsonb_array_elements(qr.answers) AS t(elem)
    WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'userAnswer', ''), '[.。!?！？,，\s]+$', '')))
        = LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'correctAnswer', ''), '[.。!?！？,，\s]+$', '')))
  ),
  score = (
    SELECT COUNT(*)::integer
    FROM jsonb_array_elements(qr.answers) AS t(elem)
    WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'userAnswer', ''), '[.。!?！？,，\s]+$', '')))
        = LOWER(TRIM(REGEXP_REPLACE(COALESCE(t.elem->>'correctAnswer', ''), '[.。!?！？,，\s]+$', '')))
  )
WHERE qr.answers IS NOT NULL
  AND jsonb_array_length(qr.answers) > 0;
