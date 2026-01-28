-- 7가지 새 기능을 위한 DB 스키마 변경

-- 1. profiles 테이블 확장 (프로필 커스터마이징)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS preferred_language translation_language DEFAULT 'en',
ADD COLUMN IF NOT EXISTS study_goal TEXT,
ADD COLUMN IF NOT EXISTS daily_word_count INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system'));

-- 2. notification_type enum 확장 (공지사항용)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'announcement';

-- 3. 오답 노트 테이블
CREATE TABLE IF NOT EXISTS public.wrong_answer_notebook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  quiz_result_id UUID NOT NULL REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  word TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  sentence TEXT NOT NULL,
  translation TEXT,
  review_count INTEGER DEFAULT 0,
  is_mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE(student_id, quiz_result_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_wrong_answer_notebook_student ON public.wrong_answer_notebook(student_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answer_notebook_mastered ON public.wrong_answer_notebook(student_id, is_mastered);

ALTER TABLE public.wrong_answer_notebook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students own their wrong answers"
ON public.wrong_answer_notebook
FOR ALL
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Teachers can view wrong answers for their class students
CREATE POLICY "Teachers can view student wrong answers"
ON public.wrong_answer_notebook
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = wrong_answer_notebook.student_id
    AND c.teacher_id = auth.uid()
  )
);

-- 4. 나만의 단어장 테이블
CREATE TABLE IF NOT EXISTS public.vocabulary_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning TEXT,
  example_sentence TEXT,
  notes TEXT,
  source_quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, word)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_lists_student ON public.vocabulary_lists(student_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_lists_favorite ON public.vocabulary_lists(student_id, is_favorite);

ALTER TABLE public.vocabulary_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students own their vocabulary"
ON public.vocabulary_lists
FOR ALL
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- 5. 공지사항 테이블
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_class ON public.announcements(class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their announcements"
ON public.announcements
FOR ALL
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students view class announcements"
ON public.announcements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_members.class_id = announcements.class_id
    AND class_members.student_id = auth.uid()
  )
);

-- notifications 테이블에 announcement_id 컬럼 추가
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE;
