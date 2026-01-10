-- Enable RLS on quizzes table (if not already enabled)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (optional, but safer to be explicit)
DROP POLICY IF EXISTS "Teachers can update their own quizzes" ON public.quizzes;

-- Create policy to allow teachers to update their own quizzes
CREATE POLICY "Teachers can update their own quizzes"
ON public.quizzes
FOR UPDATE
USING (
  auth.uid() = teacher_id
);

-- Ensure teachers can also select their own quizzes (usually covered by a public select policy, but adding for completeness)
DROP POLICY IF EXISTS "Teachers can view their own quizzes" ON public.quizzes;
CREATE POLICY "Teachers can view their own quizzes"
ON public.quizzes
FOR SELECT
USING (
  auth.uid() = teacher_id OR auth.role() = 'service_role'
);
