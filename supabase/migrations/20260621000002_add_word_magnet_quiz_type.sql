-- 워드 마그넷(Word Magnets) 퀴즈 유형 추가
-- 단어/조사 타일을 끌어 문장 조립. 정답 어순이 노출되면 안 되므로(답 입력처럼)
-- 학생에게는 타일(셔플)만 내려보내고 채점은 서버에서 어순(공백 무시) 비교로 수행한다.

-- 1. quizzes / quiz_results 확장
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS word_magnet_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS word_magnet_score INTEGER,
ADD COLUMN IF NOT EXISTS word_magnet_total INTEGER;

-- 2. word_magnet_problems — base_text(정답 어순) 포함, 학생 직접 SELECT 불가
CREATE TABLE IF NOT EXISTS public.word_magnet_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  base_text TEXT NOT NULL,
  translation TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_word_magnet_problems_quiz ON public.word_magnet_problems(quiz_id);

-- 3. word_magnet_answers
CREATE TABLE IF NOT EXISTS public.word_magnet_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  student_sentence TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, problem_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_word_magnet_answers_quiz ON public.word_magnet_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_word_magnet_answers_result ON public.word_magnet_answers(result_id);
CREATE INDEX IF NOT EXISTS idx_word_magnet_answers_student ON public.word_magnet_answers(student_id);

-- 4. RLS
ALTER TABLE public.word_magnet_problems ENABLE ROW LEVEL SECURITY;

-- base_text(정답)이 들어있으므로 학생 직접 SELECT 정책은 두지 않는다 (RPC로만 타일 제공).
CREATE POLICY "Teachers can manage word magnet problems"
ON public.word_magnet_problems FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = word_magnet_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = word_magnet_problems.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

ALTER TABLE public.word_magnet_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own word magnet answers"
ON public.word_magnet_answers FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student word magnet answers"
ON public.word_magnet_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = word_magnet_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);

CREATE POLICY "Shared quiz word magnet answers insert"
ON public.word_magnet_answers FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_shares qs
    WHERE qs.quiz_id = word_magnet_answers.quiz_id
  )
);

-- 5. 학생용 타일 조회 RPC (정답 base_text 제외, items는 문제마다 셔플)
CREATE OR REPLACE FUNCTION public.get_word_magnet_problems_for_student(_quiz_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'problem_id', problem_id,
      'translation', translation,
      'items', (
        SELECT COALESCE(jsonb_agg(e ORDER BY random()), '[]'::jsonb)
        FROM jsonb_array_elements(items) e
      )
    )),
    '[]'::jsonb
  )
  FROM public.word_magnet_problems
  WHERE quiz_id = _quiz_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_word_magnet_problems_for_student(uuid) TO authenticated, anon;

-- 6. 서버 채점 RPC — 어순(공백 무시) 비교. 쓰기 없음, 결과만 반환.
-- _answers = { problem_id: assembledSentence }
CREATE OR REPLACE FUNCTION public.grade_word_magnets(_quiz_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p RECORD;
  _user text;
  _correct text;
  _is_correct boolean;
  _results jsonb := '[]'::jsonb;
BEGIN
  FOR _p IN SELECT problem_id, translation, base_text FROM public.word_magnet_problems WHERE quiz_id = _quiz_id
  LOOP
    _user := regexp_replace(COALESCE(_answers->>_p.problem_id, ''), '\s+', '', 'g');
    _correct := regexp_replace(_p.base_text, '\s+', '', 'g');
    _is_correct := (_user = _correct);
    _results := _results || jsonb_build_array(jsonb_build_object(
      'problemId', _p.problem_id,
      'translation', _p.translation,
      'correctSentence', _p.base_text,
      'userSentence', COALESCE(_answers->>_p.problem_id, ''),
      'isCorrect', _is_correct
    ));
  END LOOP;
  RETURN _results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_word_magnets(uuid, jsonb) TO authenticated, anon;

-- 7. 워드 마그넷 점수 중간 저장 RPC
CREATE OR REPLACE FUNCTION public.update_quiz_result_word_magnet_score(
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
    word_magnet_score = _score,
    word_magnet_total = _total
  WHERE id = _result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_result_word_magnet_score(UUID, INTEGER, INTEGER) TO authenticated, anon;

-- 8. get_quiz_for_student RPC에 matchup_enabled + type_answer_enabled + word_magnet_enabled 포함
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
    'type_answer_enabled', type_answer_enabled,
    'word_magnet_enabled', word_magnet_enabled
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
