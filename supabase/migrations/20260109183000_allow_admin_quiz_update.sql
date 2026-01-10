-- Drop previous update policy
DROP POLICY IF EXISTS "Teachers can update their own quizzes" ON public.quizzes;

-- Re-create policy to include Admin permissions
-- Admins can update any quiz
-- Teachers can only update their own quizzes
CREATE POLICY "Teachers and Admins can update quizzes"
ON public.quizzes
FOR UPDATE
USING (
  auth.uid() = teacher_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.user_id = auth.uid()
    AND public.profiles.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = teacher_id
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.user_id = auth.uid()
    AND public.profiles.role = 'admin'
  )
);
