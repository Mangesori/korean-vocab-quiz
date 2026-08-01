-- 빈칸 채우기 서버 채점
--
-- 그동안 학생 화면이 quizzes 테이블을 직접 읽어 정답을 가져와 채점했다. 두 가지가
-- 문제였다.
--   1) 라이브 세션 학생(특히 비회원)은 quizzes를 읽을 권한이 없어 "결과를 계산할
--      수 없습니다"로 막힌다.
--   2) 정답이 통째로 클라이언트에 내려온다. 다른 유형(단어 받아쓰기 등)은 이미
--      서버에서 채점하는데 빈칸만 예외였다.
--
-- grade_type_answers와 같은 방식으로 맞춘다. 쓰기 없이 결과만 돌려준다.

CREATE OR REPLACE FUNCTION public.grade_fill_blank(_quiz_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _problem  jsonb;
  _given    text;
  _correct  text;
  _ok       boolean;
  _results  jsonb := '[]'::jsonb;
  _norm     text := '[.。!?！？,，\s]+$';
BEGIN
  FOR _problem IN
    SELECT * FROM jsonb_array_elements(
      COALESCE((SELECT problems FROM public.quizzes WHERE id = _quiz_id), '[]'::jsonb)
    )
  LOOP
    _given   := LOWER(TRIM(REGEXP_REPLACE(COALESCE(_answers ->> (_problem->>'id'), ''), _norm, '')));
    _correct := LOWER(TRIM(REGEXP_REPLACE(COALESCE(_problem->>'answer', ''), _norm, '')));
    _ok      := (_given = _correct AND _correct <> '');

    _results := _results || jsonb_build_array(jsonb_build_object(
      'problemId',     _problem->>'id',
      'userAnswer',    COALESCE(_answers ->> (_problem->>'id'), ''),
      'correctAnswer', _problem->>'answer',
      'isCorrect',     _ok,
      'sentence',      _problem->>'sentence',
      'word',          _problem->>'word',
      'hint',          _problem->>'hint',
      'translation',   _problem->>'translation'
    ));
  END LOOP;

  RETURN _results;
END;
$$;

-- 라이브 세션 비회원도 채점받아야 하므로 anon에게도 연다.
-- 정답을 통째로 주는 게 아니라 제출한 답에 대한 채점 결과만 돌려준다.
GRANT EXECUTE ON FUNCTION public.grade_fill_blank(uuid, jsonb) TO anon, authenticated;
