-- 매치업(Match-up) 퀴즈 유형 추가
-- 단어 ↔ 뜻 연결 퀴즈. 정답이 정해져 있어 AI 채점 불필요(규칙 기반).
-- 기존 sentence_making / recording 유형과 동일한 패턴을 따른다.

-- 1. quizzes 테이블 확장
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS matchup_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. quiz_results 테이블 확장
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS matchup_score INTEGER,
ADD COLUMN IF NOT EXISTS matchup_total INTEGER;

-- 3. matchup_problems 테이블 생성 (단어 ↔ 뜻 쌍)
CREATE TABLE IF NOT EXISTS public.matchup_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  korean_text TEXT NOT NULL,
  meaning_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_matchup_problems_quiz ON public.matchup_problems(quiz_id);

-- 4. matchup_answers 테이블 생성 (학생이 선택한 매칭 + 정오)
CREATE TABLE IF NOT EXISTS public.matchup_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  selected_meaning TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_matchup_answers_quiz ON public.matchup_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_matchup_answers_result ON public.matchup_answers(result_id);
CREATE INDEX IF NOT EXISTS idx_matchup_answers_student ON public.matchup_answers(student_id);

-- 5. RLS 정책

ALTER TABLE public.matchup_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage matchup problems"
ON public.matchup_problems FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = matchup_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = matchup_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view assigned matchup problems"
ON public.matchup_problems FOR SELECT
TO authenticated
USING (
  is_quiz_assigned_to_student(quiz_id, auth.uid())
);

CREATE POLICY "Shared quiz matchup problems access"
ON public.matchup_problems FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = matchup_problems.quiz_id
  )
);

ALTER TABLE public.matchup_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own matchup answers"
ON public.matchup_answers FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student matchup answers"
ON public.matchup_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = matchup_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

-- 공유(익명) 퀴즈에서 매치업 답안 저장 허용
CREATE POLICY "Shared quiz matchup answers insert"
ON public.matchup_answers FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = matchup_answers.quiz_id
  )
);

-- 6. 매치업 점수 중간 저장 RPC (SECURITY DEFINER로 RLS 우회)
-- sentence_making / recording 점수 저장 RPC와 동일한 패턴.
-- 자기 컬럼(matchup_score/total)만 갱신하며, 집계 score는 건드리지 않는다.
CREATE OR REPLACE FUNCTION public.update_quiz_result_matchup_score(
  _result_id UUID,
  _score INTEGER,
  _total INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_results
  SET
    matchup_score = _score,
    matchup_total = _total
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_matchup_score(UUID, INTEGER, INTEGER) TO authenticated, anon;

-- 7. get_quiz_for_student RPC에 matchup_enabled 추가
CREATE OR REPLACE FUNCTION public.get_quiz_for_student(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _quiz_data jsonb;
  _problems jsonb;
  _sanitized_problems jsonb := '[]'::jsonb;
  _problem jsonb;
BEGIN
  _student_id := auth.uid();

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT is_quiz_assigned_to_student(_quiz_id, _student_id) THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'difficulty', difficulty,
    'timer_enabled', timer_enabled,
    'timer_seconds', timer_seconds,
    'words', words,
    'words_per_set', words_per_set,
    'translation_language', translation_language,
    'teacher_id', teacher_id,
    'problems', problems,
    'sentence_making_enabled', sentence_making_enabled,
    'recording_enabled', recording_enabled,
    'matchup_enabled', matchup_enabled
  ) INTO _quiz_data
  FROM quizzes
  WHERE id = _quiz_id;

  IF _quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  _problems := _quiz_data->'problems';

  FOR _problem IN SELECT * FROM jsonb_array_elements(_problems)
  LOOP
    _sanitized_problems := _sanitized_problems || jsonb_build_object(
      'id', _problem->>'id',
      'word', _problem->>'word',
      'sentence', _problem->>'sentence',
      'hint', _problem->>'hint',
      'translation', _problem->>'translation'
    );
  END LOOP;

  RETURN jsonb_set(_quiz_data, '{problems}', _sanitized_problems);
END;
$$;
