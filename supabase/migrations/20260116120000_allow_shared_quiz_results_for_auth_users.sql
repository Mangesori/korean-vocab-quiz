-- Allow authenticated users to insert quiz results if they have a valid share token
-- This covers the case where a logged-in user takes a quiz via a shared link

CREATE POLICY "Authenticated users can insert results with valid share token"
ON public.quiz_results
FOR INSERT
TO authenticated
WITH CHECK (
  share_token IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE share_token = quiz_results.share_token
  ) AND
  student_id = auth.uid()
);
