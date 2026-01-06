-- Create quiz_shares table for sharing quizzes via link
CREATE TABLE IF NOT EXISTS public.quiz_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  allow_anonymous BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  completion_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.quiz_shares ENABLE ROW LEVEL SECURITY;

-- Anyone can view quiz shares (for anonymous access)
CREATE POLICY "Anyone can view quiz shares"
ON public.quiz_shares FOR SELECT
USING (true);

-- Teachers can create shares for their own quizzes
CREATE POLICY "Teachers can create quiz shares"
ON public.quiz_shares FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_shares.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Teachers can update their own quiz shares
CREATE POLICY "Teachers can update quiz shares"
ON public.quiz_shares FOR UPDATE
USING (created_by = auth.uid());

-- Teachers can delete their own quiz shares
CREATE POLICY "Teachers can delete quiz shares"
ON public.quiz_shares FOR DELETE
USING (created_by = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quiz_shares_token ON public.quiz_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_quiz_shares_quiz_id ON public.quiz_shares(quiz_id);
