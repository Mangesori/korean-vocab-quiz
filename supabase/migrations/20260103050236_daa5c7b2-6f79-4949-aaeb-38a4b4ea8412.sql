-- 1. Fix classes table public exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view class by invite code" ON public.classes;

-- Create a new policy that requires authentication to view classes by invite code
CREATE POLICY "Authenticated users can view class by invite code" 
ON public.classes 
FOR SELECT 
TO authenticated
USING (true);

-- 2. Fix notifications insert policy
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create proper policies for notification creation
-- Teachers can create notifications for students (quiz assigned)
CREATE POLICY "Teachers can create quiz assignment notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (
  type = 'quiz_assigned' 
  AND from_user_id = auth.uid() 
  AND public.has_role(auth.uid(), 'teacher')
);

-- Students can create notifications for teachers (quiz completed)
CREATE POLICY "Students can create quiz completion notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (
  type = 'quiz_completed' 
  AND from_user_id = auth.uid() 
  AND public.has_role(auth.uid(), 'student')
);