-- Remove duplicate rows (keep the one with audio URL if exists, otherwise latest)
DELETE FROM public.quiz_problems
WHERE id NOT IN (
  SELECT DISTINCT ON (quiz_id, problem_id) id
  FROM public.quiz_problems
  ORDER BY quiz_id, problem_id, sentence_audio_url DESC NULLS LAST, created_at DESC
);

-- Add unique constraint on (quiz_id, problem_id)
ALTER TABLE public.quiz_problems
ADD CONSTRAINT quiz_problems_quiz_id_problem_id_key UNIQUE (quiz_id, problem_id);
