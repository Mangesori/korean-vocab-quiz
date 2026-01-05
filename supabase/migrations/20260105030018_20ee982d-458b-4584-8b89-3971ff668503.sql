-- Create storage bucket for quiz audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-audio', 'quiz-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to quiz audio files
CREATE POLICY "Public read access for quiz audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'quiz-audio');

-- Allow teachers to upload audio files
CREATE POLICY "Teachers can upload quiz audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quiz-audio' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers to delete their audio files
CREATE POLICY "Teachers can delete quiz audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quiz-audio'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

-- Create quiz_problems table to store problem data with audio URLs
CREATE TABLE IF NOT EXISTS public.quiz_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  word TEXT NOT NULL,
  sentence TEXT NOT NULL,
  hint TEXT,
  translation TEXT,
  sentence_audio_url TEXT,
  hint_audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quiz_problems ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own quiz problems
CREATE POLICY "Teachers can view their quiz problems"
ON public.quiz_problems FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_problems.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- Students can view problems for quizzes assigned to them
CREATE POLICY "Students can view assigned quiz problems"
ON public.quiz_problems FOR SELECT
USING (
  public.is_quiz_assigned_to_student(quiz_id, auth.uid())
);

-- Teachers can insert problems for their quizzes
CREATE POLICY "Teachers can insert quiz problems"
ON public.quiz_problems FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_problems.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- Teachers can update their quiz problems
CREATE POLICY "Teachers can update quiz problems"
ON public.quiz_problems FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_problems.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- Teachers can delete their quiz problems
CREATE POLICY "Teachers can delete quiz problems"
ON public.quiz_problems FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_problems.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_quiz_problems_quiz_id ON public.quiz_problems(quiz_id);