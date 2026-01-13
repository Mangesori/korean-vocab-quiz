-- Allow anonymous users to insert quiz results via share link
-- Only allow if:
-- 1. is_anonymous is true
-- 2. share_token is present and valid (exists in quiz_shares)
-- 3. student_id is set to the NIL UUID (00000000-0000-0000-0000-000000000000)

CREATE POLICY "Anonymous users can insert results with valid share token"
ON public.quiz_results
FOR INSERT
TO public
WITH CHECK (
  is_anonymous = true AND
  share_token IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE share_token = quiz_results.share_token
  ) AND
  student_id = '00000000-0000-0000-0000-000000000000'::uuid
);
