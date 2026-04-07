-- Allow anonymous users to view their own inserted results via share link
-- This is necessary because INSERT statements with RETURNING clauses require SELECT permissions
-- on the newly inserted row to return its data back to the client.

CREATE POLICY "Anonymous users can view their own inserted results via share token"
ON public.quiz_results
FOR SELECT
TO anon, public
USING (
  is_anonymous = true AND
  share_token IS NOT NULL AND
  student_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE quiz_shares.share_token = quiz_results.share_token
  )
);
