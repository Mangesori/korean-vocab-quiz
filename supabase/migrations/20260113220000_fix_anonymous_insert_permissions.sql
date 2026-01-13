-- Grant necessary permissions to anon role for anonymous quiz submissions
GRANT INSERT ON public.quiz_results TO anon;
GRANT UPDATE ON public.quiz_shares TO anon;

-- Remove duplicate/conflicting policy
DROP POLICY IF EXISTS "Anonymous users can save results via share link" ON public.quiz_results;

-- Drop and recreate the correct policy with proper constraints
DROP POLICY IF EXISTS "Anonymous users can insert results with valid share token" ON public.quiz_results;

CREATE POLICY "Anonymous users can insert results with valid share token"
ON public.quiz_results
FOR INSERT
TO anon, public
WITH CHECK (
  is_anonymous = true AND
  share_token IS NOT NULL AND
  student_id = '00000000-0000-0000-0000-000000000000'::uuid AND
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE quiz_shares.share_token = quiz_results.share_token
  )
);
