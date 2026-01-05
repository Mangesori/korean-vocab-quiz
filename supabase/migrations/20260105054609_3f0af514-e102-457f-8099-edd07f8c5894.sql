-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Teachers can view their quiz answers" ON public.quiz_answers;

-- Create a PERMISSIVE policy that explicitly allows only teachers to view quiz answers
CREATE POLICY "Teachers can view their quiz answers"
ON public.quiz_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_answers.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);