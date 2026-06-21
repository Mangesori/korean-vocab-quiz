-- Demo quiz for /quiz/example (퀴즈 맛보기)
-- Audio files already exist in storage under this quiz UUID.
-- Creates a perpetual share token so QuizExample can redirect directly to QuizTake.

DO $$
DECLARE
  v_teacher_id uuid;
  v_quiz_id    uuid := 'f879fc3d-4d30-4559-ad1b-8e2ea71c29ef';
  v_base_url   text := 'https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/';
BEGIN
  SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'vaporware01@gmail.com' LIMIT 1;
  IF v_teacher_id IS NULL THEN
    RAISE NOTICE 'Demo quiz migration skipped: teacher account not found';
    RETURN;
  END IF;

  -- 1. Upsert demo quiz
  INSERT INTO public.quizzes (
    id, teacher_id, title, difficulty, words, problems,
    sentence_making_enabled, recording_enabled, timer_enabled,
    words_per_set, translation_language
  ) VALUES (
    v_quiz_id,
    v_teacher_id,
    '한국어 기초 단어 (맛보기)',
    'A1',
    ARRAY['학생', '마음에 들다', '예쁘다', '무료', '알리다'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'demo-p0', 'word', '학생',
        'sentence', '저는 () 돈이 많지 않아요.',
        'answer', '학생이라서', 'hint', '-(이)라서',
        'translation', 'Because I''m [a student], I don''t have much money.',
        'sentence_audio_url', v_base_url || 'problem-1767682692118-0_sentence.mp3'
      ),
      jsonb_build_object(
        'id', 'demo-p1', 'word', '마음에 들다',
        'sentence', '그 옷이 () 바로 살 거예요.',
        'answer', '마음에 들면', 'hint', '-(으)면',
        'translation', 'If I [like] that outfit, I''ll buy it right away.',
        'sentence_audio_url', v_base_url || 'problem-1767682692118-1_sentence.mp3'
      ),
      jsonb_build_object(
        'id', 'demo-p2', 'word', '예쁘다',
        'sentence', '저는 () 가방을 하나 사고 싶어요.',
        'answer', '예쁜', 'hint', '(으)ㄴ',
        'translation', 'I want to buy a [pretty] bag.',
        'sentence_audio_url', v_base_url || 'problem-1767682692118-2_1767707790032.mp3'
      ),
      jsonb_build_object(
        'id', 'demo-p3', 'word', '무료',
        'sentence', '오늘은 공휴일이어서 박물관에 () 들어갈 수 있어요.',
        'answer', '무료로', 'hint', '(으)로',
        'translation', 'You can get into the museum [for free] today since it''s a public holiday.',
        'sentence_audio_url', v_base_url || 'problem-1767682692118-3_1767704747952.mp3'
      ),
      jsonb_build_object(
        'id', 'demo-p4', 'word', '알리다',
        'sentence', '친구에게 대학교 합격 소식을 () 부모님께 먼저 말했어요.',
        'answer', '알리기 전에', 'hint', '-기 전에',
        'translation', 'I told my parents about my college acceptance before [telling] my friends.',
        'sentence_audio_url', v_base_url || 'problem-1767682692118-4_1767704767454.mp3'
      )
    ),
    true, true, false, 5, 'en'
  )
  ON CONFLICT (id) DO UPDATE SET
    title                   = EXCLUDED.title,
    problems                = EXCLUDED.problems,
    sentence_making_enabled = true,
    recording_enabled       = true,
    words                   = EXCLUDED.words,
    words_per_set           = EXCLUDED.words_per_set,
    updated_at              = now();

  -- 2. Replace sentence_making_problems for demo quiz
  DELETE FROM public.sentence_making_problems WHERE quiz_id = v_quiz_id;
  INSERT INTO public.sentence_making_problems (quiz_id, problem_id, word, word_meaning, model_answer, grading_criteria)
  VALUES
    (v_quiz_id, 'demo-p0', '학생',        'student',                 '저는 한국어를 열심히 공부하는 학생이에요.',  '{}'::jsonb),
    (v_quiz_id, 'demo-p2', '예쁘다',       'to be pretty',            '오늘 새로 산 가방이 정말 예쁘네요.',        '{}'::jsonb),
    (v_quiz_id, 'demo-p1', '마음에 들다',  'to like / to be pleased', '이 카페 분위기가 너무 마음에 들어요.',      '{}'::jsonb);

  -- 3. Replace recording_problems for demo quiz
  DELETE FROM public.recording_problems WHERE quiz_id = v_quiz_id;
  INSERT INTO public.recording_problems (quiz_id, problem_id, sentence, sentence_audio_url, translation, mode, source_type)
  VALUES
    (v_quiz_id, 'demo-p0',
     '저는 학생이라서 돈이 많지 않아요.',
     v_base_url || 'problem-1767682692118-0_sentence.mp3',
     'Because I''m a student, I don''t have much money.',
     'listen', 'teacher_input'),
    (v_quiz_id, 'demo-p1',
     '그 옷이 마음에 들면 바로 살 거예요.',
     NULL,
     'If I like that outfit, I''ll buy it right away.',
     'read', 'teacher_input');

  -- 4. Create perpetual share token (skip if already exists)
  INSERT INTO public.quiz_shares (quiz_id, share_token, created_by, allow_anonymous, max_attempts, expires_at, view_count, completion_count)
  VALUES (v_quiz_id, 'namu-korean-demo', v_teacher_id, true, 999999, NULL, 0, 0)
  ON CONFLICT (share_token) DO NOTHING;

END $$;
