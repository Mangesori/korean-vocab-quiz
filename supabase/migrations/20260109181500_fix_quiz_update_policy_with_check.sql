-- Drop previous update policy
DROP POLICY IF EXISTS "Teachers can update their own quizzes" ON public.quizzes;

-- Re-create policy with both USING and WITH CHECK
-- USING: Checks if the OLD row is allowed to be updated (must own the quiz)
-- WITH CHECK: Checks if the NEW row is valid (must still own the quiz)
CREATE POLICY "Teachers can update their own quizzes"
ON public.quizzes
FOR UPDATE
USING (
  auth.uid() = teacher_id
)
WITH CHECK (
  auth.uid() = teacher_id
);
