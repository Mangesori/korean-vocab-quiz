-- "모르겠어요" 기능: 답 입력 / 워드마그넷 / 문장 만들기에서 학생이 답을 모른다고
-- 명시적으로 표시하고 넘어갈 수 있게 한다. 점수는 오답과 동일하게 0점 처리하되,
-- 오답노트·결과 화면에서 "틀림"과 "모름"을 구분해서 보여줄 수 있도록 컬럼을 추가한다.

ALTER TABLE public.type_answer_answers
ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.word_magnet_answers
ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.sentence_making_answers
ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false;

-- 결과 상세 RPC에도 is_skipped를 포함해서 반환하도록 갱신
CREATE OR REPLACE FUNCTION public.get_type_answer_result_detail(_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_id uuid;
  _student_id uuid;
  _is_owner boolean;
BEGIN
  SELECT quiz_id, student_id INTO _quiz_id, _student_id
  FROM public.quiz_results WHERE id = _result_id;

  IF _quiz_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  _is_owner := (_student_id IS NOT NULL AND _student_id = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quizzes WHERE id = _quiz_id AND teacher_id = auth.uid()
  );

  IF NOT _is_owner THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'problemId', p.problem_id,
        'prompt', p.prompt,
        'correctAnswer', p.answer,
        'userAnswer', COALESCE(a.student_answer, ''),
        'isCorrect', COALESCE(a.is_correct, false),
        'skipped', COALESCE(a.is_skipped, false)
      ) ORDER BY p.problem_id)
      FROM public.type_answer_problems p
      LEFT JOIN public.type_answer_answers a
        ON a.problem_id = p.problem_id AND a.result_id = _result_id
      WHERE p.quiz_id = _quiz_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_word_magnet_result_detail(_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_id uuid;
  _student_id uuid;
  _is_owner boolean;
BEGIN
  SELECT quiz_id, student_id INTO _quiz_id, _student_id
  FROM public.quiz_results WHERE id = _result_id;

  IF _quiz_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  _is_owner := (_student_id IS NOT NULL AND _student_id = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quizzes WHERE id = _quiz_id AND teacher_id = auth.uid()
  );

  IF NOT _is_owner THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'problemId', p.problem_id,
        'translation', COALESCE(p.translation, ''),
        'correctSentence', p.base_text,
        'userSentence', COALESCE(a.student_sentence, ''),
        'isCorrect', COALESCE(a.is_correct, false),
        'skipped', COALESCE(a.is_skipped, false)
      ) ORDER BY p.problem_id)
      FROM public.word_magnet_problems p
      LEFT JOIN public.word_magnet_answers a
        ON a.problem_id = p.problem_id AND a.result_id = _result_id
      WHERE p.quiz_id = _quiz_id
    ),
    '[]'::jsonb
  );
END;
$$;
