-- 새로운 퀴즈 유형 추가 마이그레이션
-- 문장 만들기 퀴즈 및 녹음 퀴즈 지원

-- 1. 새 ENUM 타입 생성
CREATE TYPE public.recording_mode AS ENUM ('read', 'listen');
CREATE TYPE public.sentence_source AS ENUM ('reuse', 'ai_generated', 'teacher_input');

-- 2. quizzes 테이블 확장
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS sentence_making_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT false;

-- 3. sentence_making_problems 테이블 생성
CREATE TABLE IF NOT EXISTS public.sentence_making_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  word TEXT NOT NULL,
  word_meaning TEXT,
  model_answer TEXT NOT NULL,
  grading_criteria JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id)
);

CREATE INDEX idx_sentence_making_problems_quiz ON public.sentence_making_problems(quiz_id);

-- 4. sentence_making_answers 테이블 생성 (학생 답안 + AI 채점 결과)
CREATE TABLE IF NOT EXISTS public.sentence_making_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  student_sentence TEXT NOT NULL,

  -- AI 채점 결과
  word_usage_score INTEGER CHECK (word_usage_score BETWEEN 0 AND 100),
  grammar_score INTEGER CHECK (grammar_score BETWEEN 0 AND 100),
  naturalness_score INTEGER CHECK (naturalness_score BETWEEN 0 AND 100),
  total_score INTEGER CHECK (total_score BETWEEN 0 AND 100),

  ai_feedback TEXT,
  model_answer TEXT,
  is_passed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(quiz_id, problem_id, student_id, attempt_number)
);

CREATE INDEX idx_sentence_making_answers_quiz ON public.sentence_making_answers(quiz_id);
CREATE INDEX idx_sentence_making_answers_result ON public.sentence_making_answers(result_id);
CREATE INDEX idx_sentence_making_answers_student ON public.sentence_making_answers(student_id);

-- 5. recording_problems 테이블 생성
CREATE TABLE IF NOT EXISTS public.recording_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  sentence TEXT NOT NULL,
  mode recording_mode NOT NULL DEFAULT 'read',
  sentence_audio_url TEXT,
  translation TEXT,
  source_type sentence_source NOT NULL DEFAULT 'reuse',
  source_problem_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id)
);

CREATE INDEX idx_recording_problems_quiz ON public.recording_problems(quiz_id);

-- 6. recording_answers 테이블 생성 (녹음 파일 + Azure 평가 결과)
CREATE TABLE IF NOT EXISTS public.recording_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,

  -- 녹음 파일 정보
  recording_url TEXT NOT NULL,
  recording_duration_seconds NUMERIC(6,2),

  -- Azure Speech 발음 평가 결과
  pronunciation_score NUMERIC(5,2),
  accuracy_score NUMERIC(5,2),
  fluency_score NUMERIC(5,2),
  completeness_score NUMERIC(5,2),
  prosody_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),

  -- 단어별 상세 피드백
  word_level_feedback JSONB DEFAULT '[]'::jsonb,

  is_passed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(quiz_id, problem_id, student_id, attempt_number)
);

CREATE INDEX idx_recording_answers_quiz ON public.recording_answers(quiz_id);
CREATE INDEX idx_recording_answers_result ON public.recording_answers(result_id);
CREATE INDEX idx_recording_answers_student ON public.recording_answers(student_id);

-- 7. quiz_results 테이블 확장
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS fill_blank_score INTEGER,
ADD COLUMN IF NOT EXISTS fill_blank_total INTEGER,
ADD COLUMN IF NOT EXISTS sentence_making_score INTEGER,
ADD COLUMN IF NOT EXISTS sentence_making_total INTEGER,
ADD COLUMN IF NOT EXISTS recording_score INTEGER,
ADD COLUMN IF NOT EXISTS recording_total INTEGER;

-- 8. RLS 정책 설정

-- sentence_making_problems RLS
ALTER TABLE public.sentence_making_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage sentence making problems"
ON public.sentence_making_problems FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = sentence_making_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = sentence_making_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view assigned sentence making problems"
ON public.sentence_making_problems FOR SELECT
TO authenticated
USING (
  is_quiz_assigned_to_student(quiz_id, auth.uid())
);

-- sentence_making_answers RLS
ALTER TABLE public.sentence_making_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own sentence making answers"
ON public.sentence_making_answers FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student sentence making answers"
ON public.sentence_making_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = sentence_making_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- recording_problems RLS
ALTER TABLE public.recording_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage recording problems"
ON public.recording_problems FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = recording_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = recording_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view assigned recording problems"
ON public.recording_problems FOR SELECT
TO authenticated
USING (
  is_quiz_assigned_to_student(quiz_id, auth.uid())
);

-- recording_answers RLS
ALTER TABLE public.recording_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own recording answers"
ON public.recording_answers FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student recording answers"
ON public.recording_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = recording_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- 9. 공유 퀴즈용 RLS 정책 추가

CREATE POLICY "Shared quiz sentence making problems access"
ON public.sentence_making_problems FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = sentence_making_problems.quiz_id
  )
);

CREATE POLICY "Shared quiz recording problems access"
ON public.recording_problems FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = recording_problems.quiz_id
  )
);
