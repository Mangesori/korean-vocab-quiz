-- Helper function to check if user is a teacher (using profiles table)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'teacher'
  );
$$;

-- Allow Teachers AND Admins to insert quizzes
DROP POLICY IF EXISTS "Teachers can create quizzes" ON public.quizzes;

CREATE POLICY "Teachers and Admins can create quizzes"
ON public.quizzes
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid() 
  AND 
  (is_teacher() OR is_admin())
);

-- Allow Teachers AND Admins to delete quizzes
DROP POLICY IF EXISTS "Teachers can delete their own quizzes" ON public.quizzes;

CREATE POLICY "Teachers and Admins can delete quizzes"
ON public.quizzes
FOR DELETE
TO authenticated
USING (
  (teacher_id = auth.uid()) -- Teachers can only delete their own
  OR 
  is_admin() -- Admins can delete any
);
