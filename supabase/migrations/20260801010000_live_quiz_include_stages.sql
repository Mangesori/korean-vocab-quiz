-- get_quiz_for_live_session 이 세션에서 고른 유형(stages)도 함께 내려주도록 한다.
--
-- 그동안 학생 화면은 "퀴즈에 켜져 있는 유형"만 보고 단계를 구성했다. 그래서
-- 선생님이 라이브 세션 준비 화면에서 빈칸 채우기만 골라도 학생에게는 말하기
-- 연습까지 전부 나왔다. 세션의 선택을 학생 화면이 알아야 그대로 따를 수 있다.

CREATE OR REPLACE FUNCTION public.get_quiz_for_live_session(
  _session_id     uuid,
  _participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_id            uuid;
  _stages             text[];
  _quiz_data          jsonb;
  _problems           jsonb;
  _sanitized_problems jsonb := '[]'::jsonb;
  _problem            jsonb;
BEGIN
  -- 참가자가 실제로 이 세션에 들어와 있고, 세션이 아직 안 끝났는지 확인한다.
  SELECT s.quiz_id, s.stages INTO _quiz_id, _stages
  FROM public.live_sessions s
  JOIN public.live_participants p
    ON p.session_id = s.id
   AND p.id = _participant_id
   AND p.left_at IS NULL
  WHERE s.id = _session_id
    AND s.status <> 'ended';

  IF _quiz_id IS NULL THEN
    RAISE EXCEPTION '세션에 참여하고 있지 않거나 이미 끝난 수업이에요.';
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
    'fill_blank_enabled', fill_blank_enabled,
    'sentence_making_enabled', sentence_making_enabled,
    'recording_enabled', recording_enabled,
    'matchup_enabled', matchup_enabled,
    'type_answer_enabled', type_answer_enabled,
    'word_magnet_enabled', word_magnet_enabled,
    -- 이 세션에서 선생님이 고른 유형. 학생 화면은 이 목록만 진행한다.
    'live_stages', to_jsonb(_stages)
  ) INTO _quiz_data
  FROM public.quizzes
  WHERE id = _quiz_id;

  IF _quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  -- 정답 제거 (학생 화면에 내려가면 안 된다)
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

GRANT EXECUTE ON FUNCTION public.get_quiz_for_live_session(uuid, uuid) TO anon, authenticated;
