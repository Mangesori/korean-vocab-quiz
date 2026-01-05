-- Add authentication requirement policy for profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add authentication requirement policy for quiz_results table  
CREATE POLICY "Require authentication for quiz_results"
ON public.quiz_results
FOR SELECT
USING (auth.uid() IS NOT NULL);