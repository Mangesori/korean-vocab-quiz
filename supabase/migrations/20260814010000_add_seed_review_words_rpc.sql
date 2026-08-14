-- Anki식 신규 단어 드립: 선생님이 학생에게 배정한 신규 단어를 wrong_answer_progress에
-- 직접 시딩해 due_at을 오늘부터 하루 _per_day개씩 분산시킨다. 그러면 학생은 기존
-- "오늘의 복습"(get_due_review_items, 하루 상한 20개)에서 자연스럽게 하루 N개씩 받는다.
--
-- 권한 검증은 get_class_srs_summary와 동일 패턴: _student_id가 속한 반의 담임 교사이거나
-- is_admin()인 경우만 허용. 그 외에는 get_class_wrong_answers 관례를 따라 예외를 던지지
-- 않고 조용히 "전부 skipped"로 반환한다(호출자가 학생 미보유 등으로 실수 호출해도 안전).
--
-- 기존 진행 보존: 이미 wrong_answer_progress에 있는 단어는 절대 건드리지 않는다
-- (ON CONFLICT DO NOTHING) — 이미 쌓은 SRS 단계/일정을 리셋하면 안 되므로.
CREATE OR REPLACE FUNCTION public.seed_review_words(
  _student_id uuid,
  _words jsonb,      -- [{"word": "...", "level": "A1"}, ...] 배열 순서가 곧 노출 순서
  _per_day int DEFAULT 20
)
RETURNS jsonb  -- {"seeded": ["단어1", ...], "skipped": ["단어2", ...]}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean;
  _per_day_safe int := GREATEST(COALESCE(_per_day, 20), 1);
  _item jsonb;
  _idx int := 0;
  _word text;
  _level text;
  _day_offset int;
  _seeded text[] := '{}';
  _skipped text[] := '{}';
  _already_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = _student_id AND c.teacher_id = auth.uid()
  ) INTO _allowed;

  IF NOT _allowed AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('seeded', '[]'::jsonb, 'skipped', '[]'::jsonb);
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_words, '[]'::jsonb))
  LOOP
    _word := _item->>'word';
    _level := _item->>'level';

    IF _word IS NULL OR _word = '' THEN
      _idx := _idx + 1;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.wrong_answer_progress
      WHERE student_id = _student_id AND word = _word
    ) INTO _already_exists;

    IF _already_exists THEN
      _skipped := array_append(_skipped, _word);
      _idx := _idx + 1;
      CONTINUE;
    END IF;

    _day_offset := _idx / _per_day_safe;

    INSERT INTO public.wrong_answer_progress
      (student_id, word, level, stage, correct_streak, last_practiced_at, mastered_at, due_at)
    VALUES
      (_student_id, _word, _level, 0, 0, now(), NULL, public.wa_due_after(_day_offset))
    ON CONFLICT (student_id, word) DO NOTHING;

    IF FOUND THEN
      _seeded := array_append(_seeded, _word);
    ELSE
      _skipped := array_append(_skipped, _word);
    END IF;

    _idx := _idx + 1;
  END LOOP;

  RETURN jsonb_build_object('seeded', to_jsonb(_seeded), 'skipped', to_jsonb(_skipped));
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_review_words(uuid, jsonb, int) TO authenticated;

COMMENT ON FUNCTION public.seed_review_words(uuid, jsonb, int) IS
  '신규 단어를 wrong_answer_progress에 시딩해 하루 _per_day개씩 due_at을 분산시킨다(Anki식 신규 카드 드립). 이미 진행 중인 단어는 건드리지 않는다.';
