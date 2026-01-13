-- Explicitly grant usage on public schema to anon and authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Explicitly grant select on necessary tables to anon and authenticated
GRANT SELECT ON public.quizzes TO anon, authenticated;
GRANT SELECT ON public.quiz_shares TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.quiz_problems TO anon, authenticated;

-- Re-create "Public can view shared quizzes" policy to ensure it's correct
DROP POLICY IF EXISTS "Public can view shared quizzes" ON public.quizzes;

CREATE POLICY "Public can view shared quizzes"
ON public.quizzes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE quiz_shares.quiz_id = quizzes.id
  )
);

-- Ensure quiz_shares policy is permissive for select
DROP POLICY IF EXISTS "Public can view quiz shares" ON public.quiz_shares;

CREATE POLICY "Public can view quiz shares"
ON public.quiz_shares
FOR SELECT
TO public
USING ( true );

-- Ensure profiles policy is permissive for public read (needed for teacher name)
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;

CREATE POLICY "Public can view profiles"
ON public.profiles
FOR SELECT
TO public
USING ( true );

-- Also ensure quiz_problems are visible if the quiz is shared
DROP POLICY IF EXISTS "Public can view problems of shared quizzes" ON public.quiz_problems;

CREATE POLICY "Public can view problems of shared quizzes"
ON public.quiz_problems
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_shares
    WHERE quiz_shares.quiz_id = quiz_problems.quiz_id
  )
);
