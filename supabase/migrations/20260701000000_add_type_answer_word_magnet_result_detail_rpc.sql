-- 답 입력 / 워드마그넷 결과 상세 조회 RPC
-- type_answer_problems / word_magnet_problems에는 정답이 들어있어 학생 직접 SELECT를
-- 막아뒀는데(퀴즈 풀이 중 정답 노출 방지), 이 잠금이 "결과를 다시 볼 때"도 그대로 걸려서
-- 로그인 학생 본인이 자기 결과를 봐도 문제·정답 텍스트를 가져올 방법이 없었다.
-- 본인 결과(student_id = auth.uid()) 또는 해당 퀴즈의 담당 교사에 한해서만
-- 문제·정답·학생 답안을 함께 내려주는 조회 전용 RPC를 추가한다.

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
        'isCorrect', COALESCE(a.is_correct, false)
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

GRANT EXECUTE ON FUNCTION public.get_type_answer_result_detail(uuid) TO authenticated;

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
        'isCorrect', COALESCE(a.is_correct, false)
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

GRANT EXECUTE ON FUNCTION public.get_word_magnet_result_detail(uuid) TO authenticated;
