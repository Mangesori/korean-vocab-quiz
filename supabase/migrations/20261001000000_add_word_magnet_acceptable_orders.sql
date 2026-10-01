-- 문장 순서 맞추기: 허용 어순(복수 정답) 지원
--
-- 한국어는 조사가 격을 표시해서 어순이 비교적 자유롭다.
-- "저는 어제 영화를 봤어요" / "어제 저는 영화를 봤어요" 둘 다 자연스러운데,
-- 기존 채점은 base_text 하나와의 완전 일치만 봐서 뒤쪽을 오답 처리했다.
--
-- 어느 어순이 자연스러운지는 서술어 위치·관형어 결합 같은 문법 제약을 봐야 해서
-- 채점 시점에 규칙으로 판정하기 어렵다. 그래서 "무엇을 정답으로 인정할지"는
-- 문제를 만드는 시점에 선생님이 정해 두고(acceptable_orders), 채점은 그 집합에
-- 들어있는지만 보는 단순 비교로 유지한다.

ALTER TABLE public.word_magnet_problems
  ADD COLUMN IF NOT EXISTS acceptable_orders jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.word_magnet_problems.acceptable_orders IS
  'base_text 외에 정답으로 인정할 어순 목록(문자열 배열). 채점 시 공백은 무시한다.';

-- 채점: 기본 정답 또는 허용 어순 중 하나와 일치하면 정답(공백 무시).
-- 학생에게 내려보내는 get_word_magnet_problems_for_student는 그대로 둔다 —
-- 허용 어순도 정답이므로 클라이언트로 내보내면 안 된다.
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
  _is_correct boolean;
  _results jsonb := '[]'::jsonb;
BEGIN
  FOR _p IN
    SELECT problem_id, translation, base_text, acceptable_orders
    FROM public.word_magnet_problems
    WHERE quiz_id = _quiz_id
  LOOP
    _user := regexp_replace(COALESCE(_answers->>_p.problem_id, ''), '\s+', '', 'g');

    _is_correct := (_user = regexp_replace(_p.base_text, '\s+', '', 'g'));

    -- 빈 답(미제출·건너뛰기)이 빈 허용 어순과 우연히 일치하는 일이 없도록 길이를 확인한다.
    IF NOT _is_correct AND length(_user) > 0 THEN
      _is_correct := EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(_p.acceptable_orders, '[]'::jsonb)) AS alt
        WHERE regexp_replace(alt, '\s+', '', 'g') = _user
      );
    END IF;

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
