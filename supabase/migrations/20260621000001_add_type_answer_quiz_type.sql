-- 답 입력(Type the Answer) 퀴즈 유형 추가
-- 뜻(프롬프트)을 보고 한국어 단어를 직접 타이핑. 정답은 노출되면 안 되므로(빈칸 채우기처럼)
-- 학생에게는 프롬프트만 내려보내고 채점은 서버(SECURITY DEFINER RPC)에서 수행한다.

-- 1. quizzes / quiz_results 확장
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS type_answer_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS type_answer_score INTEGER,
ADD COLUMN IF NOT EXISTS type_answer_total INTEGER;

-- 2. type_answer_problems (prompt=뜻, answer=한국어 단어) — 정답 포함, 학생 직접 SELECT 불가
CREATE TABLE IF NOT EXISTS public.type_answer_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_type_answer_problems_quiz ON public.type_answer_problems(quiz_id);

-- 3. type_answer_answers (학생 제출 + 정오)
CREATE TABLE IF NOT EXISTS public.type_answer_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  student_answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_type_answer_answers_quiz ON public.type_answer_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_type_answer_answers_result ON public.type_answer_answers(result_id);
CREATE INDEX IF NOT EXISTS idx_type_answer_answers_student ON public.type_answer_answers(student_id);

-- 4. RLS
ALTER TABLE public.type_answer_problems ENABLE ROW LEVEL SECURITY;

-- 정답이 들어있으므로 학생 직접 SELECT 정책은 두지 않는다 (RPC로만 프롬프트 제공).
CREATE POLICY "Teachers can manage type answer problems"
ON public.type_answer_problems FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = type_answer_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = type_answer_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

ALTER TABLE public.type_answer_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own type answer answers"
ON public.type_answer_answers FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student type answer answers"
ON public.type_answer_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = type_answer_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

CREATE POLICY "Shared quiz type answer answers insert"
ON public.type_answer_answers FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = type_answer_answers.quiz_id
  )
);

-- 5. 학생용 프롬프트 조회 RPC (정답 제외)
CREATE OR REPLACE FUNCTION public.get_type_answer_problems_for_student(_quiz_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('problem_id', problem_id, 'prompt', prompt)),
    '[]'::jsonb
  )
  FROM public.type_answer_problems
  WHERE quiz_id = _quiz_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_type_answer_problems_for_student(uuid) TO authenticated, anon;

-- 6. 서버 채점 RPC — 정규화 비교(빈칸 채우기와 동일 규칙). 쓰기 없음, 결과만 반환.
-- _answers = { problem_id: studentAnswer }
CREATE OR REPLACE FUNCTION public.grade_type_answers(_quiz_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p RECORD;
  _user_answer text;
  _is_correct boolean;
  _results jsonb := '[]'::jsonb;
BEGIN
  FOR _p IN SELECT problem_id, prompt, answer FROM public.type_answer_problems WHERE quiz_id = _quiz_id
  LOOP
    _user_answer := LOWER(TRIM(REGEXP_REPLACE(COALESCE(_answers->>_p.problem_id, ''), '[.。!?！？,，\s]+$', '')));
    _is_correct := (_user_answer = LOWER(TRIM(REGEXP_REPLACE(_p.answer, '[.。!?！？,，\s]+$', ''))));
    _results := _results || jsonb_build_array(jsonb_build_object(
      'problemId', _p.problem_id,
      'prompt', _p.prompt,
      'correctAnswer', _p.answer,
      'userAnswer', COALESCE(_answers->>_p.problem_id, ''),
      'isCorrect', _is_correct
    ));
  END LOOP;
  RETURN _results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_type_answers(uuid, jsonb) TO authenticated, anon;

-- 7. 답 입력 점수 중간 저장 RPC
CREATE OR REPLACE FUNCTION public.update_quiz_result_type_answer_score(
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
    type_answer_score = _score,
    type_answer_total = _total
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_type_answer_score(UUID, INTEGER, INTEGER) TO authenticated, anon;

-- 8. get_quiz_for_student RPC에 matchup_enabled + type_answer_enabled 포함하여 재정의
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
    'matchup_enabled', matchup_enabled,
    'type_answer_enabled', type_answer_enabled
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
