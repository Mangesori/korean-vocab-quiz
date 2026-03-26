-- 녹음 파일 저장용 Storage 버킷 생성

-- 1. quiz-recordings 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quiz-recordings',
  'quiz-recordings',
  true,
  10485760, -- 10MB 제한
  ARRAY['audio/wav', 'audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- 2. 버킷 정책: 인증된 사용자는 업로드 가능
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quiz-recordings');

-- 3. 버킷 정책: 모든 사용자가 녹음 파일 읽기 가능 (public 버킷)
CREATE POLICY "Anyone can view recordings"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'quiz-recordings');

-- 4. 버킷 정책: 본인이 업로드한 파일 삭제 가능
CREATE POLICY "Users can delete their own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quiz-recordings' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 5. 버킷 정책: 교사는 자신의 퀴즈 녹음 파일 관리 가능
CREATE POLICY "Teachers can manage quiz recordings"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'quiz-recordings' AND
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id::text = (storage.foldername(name))[1]
    AND q.teacher_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'quiz-recordings' AND
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id::text = (storage.foldername(name))[1]
    AND q.teacher_id = auth.uid()
  )
);
