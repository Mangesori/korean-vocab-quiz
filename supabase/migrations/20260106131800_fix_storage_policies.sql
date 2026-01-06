-- Fix storage policies to use profiles table instead of user_roles

-- Drop old policies
DROP POLICY IF EXISTS "Teachers can upload quiz audio" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete quiz audio" ON storage.objects;

-- Allow teachers to upload audio files (using profiles table)
CREATE POLICY "Teachers can upload quiz audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quiz-audio' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers to update audio files
CREATE POLICY "Teachers can update quiz audio"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'quiz-audio'
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers to delete their audio files (using profiles table)
CREATE POLICY "Teachers can delete quiz audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quiz-audio'
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);
