-- Make student_id nullable to support anonymous users
ALTER TABLE public.quiz_results ALTER COLUMN student_id DROP NOT NULL;

-- Update the policy to check for NULL student_id instead of dummy UUID
DROP POLICY IF EXISTS "Anonymous users can insert results with valid share token" ON public.quiz_results;

CREATE POLICY "Anonymous users can insert results with valid share token"
ON public.quiz_results
FOR INSERT
TO anon, public
WITH CHECK (
  is_anonymous = true AND
  share_token IS NOT NULL AND
  student_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE quiz_shares.share_token = quiz_results.share_token
  )
);
