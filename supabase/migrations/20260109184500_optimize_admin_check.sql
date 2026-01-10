-- Create a secure function to check if the current user is an admin
-- SECURITY DEFINER means it runs with the privileges of the creator (postgres/superuser), bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin()
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
      AND role = 'admin'
  );
$$;

-- Update the quizzes update policy to use the simplified is_admin() check
DROP POLICY IF EXISTS "Teachers and Admins can update quizzes" ON public.quizzes;

CREATE POLICY "Teachers and Admins can update quizzes"
ON public.quizzes
FOR UPDATE
USING (
  auth.uid() = teacher_id 
  OR 
  is_admin()
)
WITH CHECK (
  auth.uid() = teacher_id
  OR
  is_admin()
);
