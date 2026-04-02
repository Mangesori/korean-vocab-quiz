-- Allow anonymous users to save sentence_making_answers and recording_answers
-- Same pattern as quiz_results which already supports anonymous inserts

-- 1. Make student_id nullable (quiz_results already did this)
ALTER TABLE public.sentence_making_answers ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.recording_answers ALTER COLUMN student_id DROP NOT NULL;

-- 2. Replace UNIQUE constraint: student_id can be NULL for anonymous users,
--    so switch to result_id-based uniqueness which is more correct anyway
ALTER TABLE public.sentence_making_answers
  DROP CONSTRAINT IF EXISTS sentence_making_answers_quiz_id_problem_id_student_id_attempt_number_key;
ALTER TABLE public.sentence_making_answers
  ADD CONSTRAINT sentence_making_answers_result_problem_attempt_key
  UNIQUE (result_id, problem_id, attempt_number);

ALTER TABLE public.recording_answers
  DROP CONSTRAINT IF EXISTS recording_answers_quiz_id_problem_id_student_id_attempt_number_key;
ALTER TABLE public.recording_answers
  ADD CONSTRAINT recording_answers_result_problem_attempt_key
  UNIQUE (result_id, problem_id, attempt_number);

-- 3. Grant INSERT permission to anon role
GRANT INSERT ON public.sentence_making_answers TO anon;
GRANT INSERT ON public.recording_answers TO anon;

-- 4. RLS: anonymous users can insert when result_id references a valid anonymous quiz_result
CREATE POLICY "Anonymous users can insert sentence making answers"
ON public.sentence_making_answers FOR INSERT
TO anon, public
WITH CHECK (
  student_id IS NULL AND
  result_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_results qr
    WHERE qr.id = sentence_making_answers.result_id
    AND qr.is_anonymous = true
  )
);

CREATE POLICY "Anonymous users can insert recording answers"
ON public.recording_answers FOR INSERT
TO anon, public
WITH CHECK (
  student_id IS NULL AND
  result_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_results qr
    WHERE qr.id = recording_answers.result_id
    AND qr.is_anonymous = true
  )
);

-- 5. Teachers can also view anonymous answers (result_id -> quiz_results -> quiz -> teacher)
--    Existing teacher SELECT policies check quiz_id directly, which still works.
--    No additional policy needed.
