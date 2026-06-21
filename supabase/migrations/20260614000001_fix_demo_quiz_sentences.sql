-- Fix demo quiz sentence format: use empty () for blanks instead of (answer)
-- FillBlankStage splits on empty parentheses only.

UPDATE public.quizzes
SET problems = jsonb_build_array(
  jsonb_build_object(
    'id', 'demo-p0', 'word', '학생',
    'sentence', '저는 () 돈이 많지 않아요.',
    'answer', '학생이라서', 'hint', '-(이)라서',
    'translation', 'Because I''m [a student], I don''t have much money.',
    'sentence_audio_url', 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-0_sentence.mp3'
  ),
  jsonb_build_object(
    'id', 'demo-p1', 'word', '마음에 들다',
    'sentence', '그 옷이 () 바로 살 거예요.',
    'answer', '마음에 들면', 'hint', '-(으)면',
    'translation', 'If I [like] that outfit, I''ll buy it right away.',
    'sentence_audio_url', 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-1_sentence.mp3'
  ),
  jsonb_build_object(
    'id', 'demo-p2', 'word', '예쁘다',
    'sentence', '저는 () 가방을 하나 사고 싶어요.',
    'answer', '예쁜', 'hint', '(으)ㄴ',
    'translation', 'I want to buy a [pretty] bag.',
    'sentence_audio_url', 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-2_1767707790032.mp3'
  ),
  jsonb_build_object(
    'id', 'demo-p3', 'word', '무료',
    'sentence', '오늘은 공휴일이어서 박물관에 () 들어갈 수 있어요.',
    'answer', '무료로', 'hint', '(으)로',
    'translation', 'You can get into the museum [for free] today since it''s a public holiday.',
    'sentence_audio_url', 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-3_1767704747952.mp3'
  ),
  jsonb_build_object(
    'id', 'demo-p4', 'word', '알리다',
    'sentence', '친구에게 대학교 합격 소식을 () 부모님께 먼저 말했어요.',
    'answer', '알리기 전에', 'hint', '-기 전에',
    'translation', 'I told my parents about my college acceptance before [telling] my friends.',
    'sentence_audio_url', 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-4_1767704767454.mp3'
  )
),
updated_at = now()
WHERE id = 'f879fc3d-4d30-4559-ad1b-8e2ea71c29ef';
