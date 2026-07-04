-- Fix demo quiz title (was "테스트" from existing quiz data)
UPDATE public.quizzes
SET title = '퀴즈 맛보기', updated_at = now()
WHERE id = 'f879fc3d-4d30-4559-ad1b-8e2ea71c29ef';
