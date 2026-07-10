-- 오답 연습 진행도/졸업 저장. 단어 단위로 연속 정답(correct_streak)을 누적하고,
-- 2회 연속 정답 시 mastered_at을 기록해 오답노트에서 기본 숨김 처리한다.

CREATE TABLE IF NOT EXISTS public.wrong_answer_progress (
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word text NOT NULL,
  correct_streak int NOT NULL DEFAULT 0,
  last_practiced_at timestamptz NOT NULL DEFAULT now(),
  mastered_at timestamptz,
  PRIMARY KEY (student_id, word)
);

ALTER TABLE public.wrong_answer_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own wa progress"
ON public.wrong_answer_progress
FOR ALL
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- 연습 결과 반영. _items = [{ "word": "...", "correct": true|false }, ...]
-- 맞으면 streak+1(2 도달 시 mastered_at 기록), 틀리면 streak=0 + mastered_at 해제(재출현).
-- 반환: 이번 호출에서 새로 졸업(streak 2 최초 도달)한 단어 text 배열.
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
  _new_streak int;
  _was_mastered boolean;
  _newly text[] := '{}';
BEGIN
  IF _uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb))
  LOOP
    _word := _item->>'word';
    _correct := COALESCE((_item->>'correct')::boolean, false);
    IF _word IS NULL OR _word = '' THEN
      CONTINUE;
    END IF;

    SELECT (mastered_at IS NOT NULL) INTO _was_mastered
    FROM public.wrong_answer_progress
    WHERE student_id = _uid AND word = _word;

    IF _correct THEN
      INSERT INTO public.wrong_answer_progress (student_id, word, correct_streak, last_practiced_at)
      VALUES (_uid, _word, 1, now())
      ON CONFLICT (student_id, word) DO UPDATE
        SET correct_streak = public.wrong_answer_progress.correct_streak + 1,
            last_practiced_at = now()
      RETURNING correct_streak INTO _new_streak;

      IF _new_streak >= 2 THEN
        UPDATE public.wrong_answer_progress
          SET mastered_at = COALESCE(mastered_at, now())
          WHERE student_id = _uid AND word = _word;
        IF NOT COALESCE(_was_mastered, false) THEN
          _newly := array_append(_newly, _word);
        END IF;
      END IF;
    ELSE
      INSERT INTO public.wrong_answer_progress (student_id, word, correct_streak, last_practiced_at, mastered_at)
      VALUES (_uid, _word, 0, now(), NULL)
      ON CONFLICT (student_id, word) DO UPDATE
        SET correct_streak = 0, last_practiced_at = now(), mastered_at = NULL;
    END IF;
  END LOOP;

  RETURN to_jsonb(_newly);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_wa_progress(jsonb) TO authenticated;
