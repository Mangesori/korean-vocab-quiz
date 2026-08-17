-- 보통 퀴즈를 완료하면(정답/오답 무관) 그 퀴즈에 등장한 모든 단어를
-- SRS 복습 큐(wrong_answer_progress)에 반영한다.
--
-- 배경: 지금까지는 "오답노트에서 연습한 단어"만 wrong_answer_progress에 들어갔다.
-- 하지만 스페이스드 리피티션 원리상 퀴즈에서 처음 맞힌 단어라도 "확실히 외웠다"고
-- 볼 수 없다 — 정답도 계속 간격을 늘려가며 재검증해야 한다. 그래서 퀴즈 결과 화면이
-- 열릴 때 그 퀴즈에 등장한 모든 단어(정답/오답 모두)를 SRS 큐에 넣는다.
--
-- 이 파일은 단어 하나를 SRS에 반영하는 로직(20260808000000의 update_wa_progress
-- 루프 본문)을 재사용 가능한 private 헬퍼로 추출하고, update_wa_progress는 그
-- 헬퍼를 호출하도록 순수 리팩터링한다(동작 변화 없음). 그 위에 새 RPC
-- apply_quiz_words_to_review를 추가한다.

-- ── 1. quiz_results에 중복 반영 방지 가드 컬럼 추가 ─────────────
-- 학생이 결과 화면을 새로고침/재방문해도 SRS가 매번 다시 반영되지 않게 막는다.
-- 이 가드가 없으면 update_wa_progress의 "틀림" 브랜치가 호출마다 무조건 단계를
-- 1씩 후퇴시키므로, 결과 화면을 열 때마다 단계가 깎이는 버그가 생긴다.
ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS srs_applied_at timestamptz;

COMMENT ON COLUMN public.quiz_results.srs_applied_at IS
  '이 퀴즈 결과의 단어들이 SRS 복습 큐(wrong_answer_progress)에 반영된 시각. '
  'NULL이면 아직 미반영. apply_quiz_words_to_review가 중복 실행 가드로 쓴다.';

-- ── 2. 단어 1개 SRS 반영 로직을 private 헬퍼로 추출 ─────────────
-- 20260808000000_add_spaced_repetition.sql의 update_wa_progress FOR 루프
-- 본문을 글자 그대로 옮긴 것. 신규/기존 분기, 정답/오답 분기, 이른 복습 가드,
-- 단계 후퇴/전진, 졸업 처리까지 로직 변경 없음.
--
-- 반환값: 이 호출로 단어가 "새로 졸업"했으면 true, 아니면 false.
-- (INOUT 배열 대신 boolean 반환 + 호출부에서 array_append하는 방식을 택했다 —
-- plpgsql에서 INOUT 배열 파라미터를 FOR 루프 안에서 누적하는 것보다 다루기 쉽고,
-- update_wa_progress·apply_quiz_words_to_review 양쪽 호출부에서 동일하게 쓰기 편하다.)
CREATE OR REPLACE FUNCTION public._apply_srs_word_result(_uid uuid, _word text, _correct boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- stage N을 통과한 뒤 기다리는 날수 = _intervals[N + 1] (배열은 1-based).
  _intervals CONSTANT int[] := ARRAY[1, 3, 7, 16, 35, 90];
  _max_stage CONSTANT int := 6;  -- 이 단계에 도달하면 졸업

  _stage int;
  _due timestamptz;
  _mastered timestamptz;
  _found boolean;
  _new_stage int;
BEGIN
  IF _word IS NULL OR _word = '' THEN
    RETURN false;
  END IF;

  SELECT stage, due_at, mastered_at, true
    INTO _stage, _due, _mastered, _found
    FROM public.wrong_answer_progress
   WHERE student_id = _uid AND word = _word;

  IF NOT COALESCE(_found, false) THEN
    -- 처음 보는 단어. 오답 연습에서 왔으므로 틀린 쪽이 기본이다.
    INSERT INTO public.wrong_answer_progress
           (student_id, word, correct_streak, last_practiced_at, stage, due_at)
    VALUES (_uid, _word,
            CASE WHEN _correct THEN 1 ELSE 0 END,
            now(),
            CASE WHEN _correct THEN 1 ELSE 0 END,
            public.wa_due_after(_intervals[CASE WHEN _correct THEN 2 ELSE 1 END]));
    RETURN false;
  END IF;

  IF _correct THEN
    -- ★ 이른 복습은 단계를 올리지 않는다.
    -- 이 가드가 없으면 하루에 세 번 연습해서 1일·3일·7일을 오후 한나절에
    -- 통과해 버린다. 그러면 간격 반복이 아무 의미가 없다.
    IF _due IS NOT NULL AND now() < _due THEN
      UPDATE public.wrong_answer_progress
         SET correct_streak = correct_streak + 1,
             last_practiced_at = now()
       WHERE student_id = _uid AND word = _word;
      RETURN false;
    END IF;

    _new_stage := LEAST(_stage + 1, _max_stage);

    IF _new_stage >= _max_stage THEN
      UPDATE public.wrong_answer_progress
         SET stage = _max_stage,
             due_at = NULL,
             correct_streak = correct_streak + 1,
             last_practiced_at = now(),
             mastered_at = COALESCE(mastered_at, now())
       WHERE student_id = _uid AND word = _word;

      IF _mastered IS NULL THEN
        RETURN true;
      END IF;
      RETURN false;
    ELSE
      UPDATE public.wrong_answer_progress
         SET stage = _new_stage,
             due_at = public.wa_due_after(_intervals[_new_stage + 1]),
             correct_streak = correct_streak + 1,
             last_practiced_at = now(),
             mastered_at = NULL
       WHERE student_id = _uid AND word = _word;
      RETURN false;
    END IF;
  ELSE
    -- 틀림: 한 단계만 후퇴하고 내일 다시 묻는다.
    -- 단계는 한 칸만 내려 그동안의 진도를 보존하되, 방금 틀린 단어를 곧바로
    -- 긴 간격으로 돌려보내지 않도록 다음 복습은 항상 1일 뒤로 잡는다.
    UPDATE public.wrong_answer_progress
       SET stage = GREATEST(_stage - 1, 0),
           due_at = public.wa_due_after(1),
           correct_streak = 0,
           last_practiced_at = now(),
           mastered_at = NULL
     WHERE student_id = _uid AND word = _word;
    RETURN false;
  END IF;
END;
$$;

-- ── 3. update_wa_progress를 헬퍼 호출로 리팩터링 (동작 동일) ────
CREATE OR REPLACE FUNCTION public.update_wa_progress(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _item jsonb;
  _word text;
  _correct boolean;
  _newly text[] := '{}';
BEGIN
  IF _uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb))
  LOOP
    _word := _item->>'word';
    _correct := COALESCE((_item->>'correct')::boolean, false);
    CONTINUE WHEN _word IS NULL OR _word = '';

    IF public._apply_srs_word_result(_uid, _word, _correct) THEN
      _newly := array_append(_newly, _word);
    END IF;
  END LOOP;

  RETURN to_jsonb(_newly);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_wa_progress(jsonb) TO authenticated;

-- ── 4. 새 RPC: 퀴즈 결과의 모든 단어를 SRS 큐에 반영 ────────────
-- _items = [{ "word": "...", "correct": true|false }, ...] (update_wa_progress와 동일 포맷)
-- 반환: { "applied": true|false, "newly_mastered": [...] }
--   - applied=false: 소유자가 아니거나, 이미 반영된 결과(중복 호출)라 아무 것도 안 함.
CREATE OR REPLACE FUNCTION public.apply_quiz_words_to_review(_result_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _applied_at timestamptz;
  _item jsonb;
  _word text;
  _correct boolean;
  _newly text[] := '{}';
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'newly_mastered', '[]'::jsonb);
  END IF;

  -- 행을 잠그면서 소유자와 기존 반영 여부를 함께 확인한다.
  SELECT student_id, srs_applied_at
    INTO _owner, _applied_at
    FROM public.quiz_results
   WHERE id = _result_id
   FOR UPDATE;

  IF _owner IS NULL OR _owner <> _uid THEN
    -- 존재하지 않거나 내 결과가 아니면 조용히 무시(다른 RPC 관례와 동일).
    RETURN jsonb_build_object('applied', false, 'newly_mastered', '[]'::jsonb);
  END IF;

  IF _applied_at IS NOT NULL THEN
    -- 이미 반영됨. 중복 실행 방지.
    RETURN jsonb_build_object('applied', false, 'newly_mastered', '[]'::jsonb);
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb))
  LOOP
    _word := _item->>'word';
    _correct := COALESCE((_item->>'correct')::boolean, false);
    CONTINUE WHEN _word IS NULL OR _word = '';

    IF public._apply_srs_word_result(_uid, _word, _correct) THEN
      _newly := array_append(_newly, _word);
    END IF;
  END LOOP;

  UPDATE public.quiz_results
     SET srs_applied_at = now()
   WHERE id = _result_id;

  RETURN jsonb_build_object('applied', true, 'newly_mastered', to_jsonb(_newly));
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_quiz_words_to_review(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.apply_quiz_words_to_review(uuid, jsonb) IS
  '퀴즈 완료 시 등장한 모든 단어(정답/오답 무관)를 SRS 복습 큐에 반영한다. '
  'quiz_results.srs_applied_at으로 중복 실행을 막는다.';
