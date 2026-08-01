-- 라이브 세션 참가자용 퀴즈 조회
--
-- get_quiz_for_student는 auth.uid() + 클래스 배정을 요구한다. 라이브 세션은
-- 비회원도 들어올 수 있고, 로그인 학생이라도 그 클래스 소속이 아닐 수 있어서
-- 그 함수로는 퀴즈를 못 읽는다. 그래서 "이 세션의 참가자인가"만 확인하는
-- 별도 경로를 둔다.
--
-- 참가자 id는 입장할 때 서버가 발급한 uuid이므로 사실상 추측 불가능한 토큰
-- 역할을 한다. 세션이 살아 있는 동안, 그 세션의 퀴즈만 열린다.
-- 정답(answer)은 get_quiz_for_student와 동일하게 제거해서 내려준다.

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
  _quiz_data          jsonb;
  _problems           jsonb;
  _sanitized_problems jsonb := '[]'::jsonb;
  _problem            jsonb;
BEGIN
  -- 참가자가 실제로 이 세션에 들어와 있고, 세션이 아직 안 끝났는지 확인한다.
  SELECT s.quiz_id INTO _quiz_id
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
    'word_magnet_enabled', word_magnet_enabled
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

-- 비회원도 호출해야 하므로 anon에게도 실행 권한을 준다.
-- (함수 안에서 참가자 확인을 하므로 아무나 아무 퀴즈나 볼 수는 없다.)
GRANT EXECUTE ON FUNCTION public.get_quiz_for_live_session(uuid, uuid) TO anon, authenticated;
