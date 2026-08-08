-- 오답 복습을 간격 반복(SRS)으로 전환한다.
--
-- 기존: 연속 2회 정답이면 졸업. 시간 개념이 없어 오늘 오후에 두 번 맞히면 끝났다.
--       그건 단기 기억일 뿐이고, 게다가 단어마다 문장을 하나만 골라 연습시켜서
--       (WrongAnswerNotebook.tsx practicePlans) "단어를 안다"가 아니라
--       "그 문장을 외웠다"가 되기 쉬웠다.
--
-- 변경: 단계(stage)마다 다시 물어볼 날짜(due_at)를 잡는다.
--
--   stage 0 --1일--> 1 --3일--> 2 --7일--> 3 --16일--> 4 --35일--> 5 --90일--> 6(졸업)
--   총 152일. stage는 "통과한 복습 횟수"이고 due_at은 다음 복습 예정일이다.
--
-- 설계 결정 네 가지(2026-08 확정):
--   1) 틀리면 한 단계만 후퇴(Anki식). 전체 초기화는 그동안 쌓은 진도를 너무 크게 버린다.
--      단 다음 복습은 그 단계의 긴 간격이 아니라 **1일 뒤**로 잡는다 — 방금 틀린 단어를
--      16일 뒤에 다시 보는 건 말이 안 되기 때문이다.
--   2) 하루 복습 상한 20개. 오답이 쌓인 채로 도입하면 한 번에 수백 개가 due가 된다.
--   3) 날짜 경계는 한국 시간 자정. now() + 1일로 하면 밤 11시에 복습한 학생이
--      다음날 밤 11시까지 못 하게 된다. 자정 기준이면 "그날 아무 때나" 가능하다.
--   4) 35일 뒤 한 번 더(90일) 확인하고 졸업.

-- ── 1. 컬럼 추가 ────────────────────────────────────────────────
ALTER TABLE public.wrong_answer_progress
  ADD COLUMN IF NOT EXISTS stage smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

COMMENT ON COLUMN public.wrong_answer_progress.stage IS
  '통과한 복습 단계 수(0~6). 6이면 졸업. 연습 화면의 문장 회전 인덱스로도 쓴다.';
COMMENT ON COLUMN public.wrong_answer_progress.due_at IS
  '다음 복습 예정 시각(한국 시간 자정 기준). NULL이면 졸업했거나 아직 미배정.';

-- correct_streak은 남기되 졸업 판정에서는 뺀다. 통계·표시용으로만 쓴다.
COMMENT ON COLUMN public.wrong_answer_progress.correct_streak IS
  '연속 정답 횟수(표시용). 졸업 판정은 stage/mastered_at으로 한다.';

-- "오늘 복습할 것" 조회 전용. 졸업한 행은 인덱스에서 빼 크기를 줄인다.
CREATE INDEX IF NOT EXISTS wrong_answer_progress_due_idx
  ON public.wrong_answer_progress (student_id, due_at)
  WHERE mastered_at IS NULL;

-- ── 2. 한국 시간 자정 헬퍼 ──────────────────────────────────────
-- now()를 쓰므로 IMMUTABLE이 아니라 STABLE이어야 한다.
CREATE OR REPLACE FUNCTION public.wa_due_after(_days int)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (((now() AT TIME ZONE 'Asia/Seoul')::date + _days)::timestamp
          AT TIME ZONE 'Asia/Seoul');
$$;

COMMENT ON FUNCTION public.wa_due_after(int) IS
  'N일 뒤 한국 시간 자정을 timestamptz로. 그날 0시부터 복습 가능해진다.';

-- ── 3. 기존 데이터 이관 ────────────────────────────────────────
-- 이미 졸업한 단어는 그대로 졸업 상태로 둔다(stage 6).
UPDATE public.wrong_answer_progress
   SET stage = 6, due_at = NULL
 WHERE mastered_at IS NOT NULL;

-- 아직 진행 중인 단어는 기존 streak을 단계로 옮기고 오늘부터 복습 대상으로 만든다.
-- streak은 졸업 임계값이 2였으므로 실제로는 0 또는 1이다. 상한을 5로 걸어 둔다.
UPDATE public.wrong_answer_progress
   SET stage = LEAST(correct_streak, 5),
       due_at = public.wa_due_after(0)
 WHERE mastered_at IS NULL
   AND due_at IS NULL;

-- ── 4. 진행도 갱신 RPC 교체 ────────────────────────────────────
-- _items = [{ "word": "...", "correct": true|false }, ...]
-- 반환: 이번 호출에서 새로 졸업한 단어 text 배열 (기존과 동일한 계약).
CREATE OR REPLACE FUNCTION public.update_wa_progress(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- stage N을 통과한 뒤 기다리는 날수 = _intervals[N + 1] (배열은 1-based).
  _intervals CONSTANT int[] := ARRAY[1, 3, 7, 16, 35, 90];
  _max_stage CONSTANT int := 6;  -- 이 단계에 도달하면 졸업

  _uid uuid := auth.uid();
  _item jsonb;
  _word text;
  _correct boolean;
  _stage int;
  _due timestamptz;
  _mastered timestamptz;
  _found boolean;
  _new_stage int;
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
      CONTINUE;
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
        CONTINUE;
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
          _newly := array_append(_newly, _word);
        END IF;
      ELSE
        UPDATE public.wrong_answer_progress
           SET stage = _new_stage,
               due_at = public.wa_due_after(_intervals[_new_stage + 1]),
               correct_streak = correct_streak + 1,
               last_practiced_at = now(),
               mastered_at = NULL
         WHERE student_id = _uid AND word = _word;
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
    END IF;
  END LOOP;

  RETURN to_jsonb(_newly);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_wa_progress(jsonb) TO authenticated;

-- ── 5. 오늘 복습할 단어 조회 ───────────────────────────────────
-- 기존 get_student_wrong_answers는 quiz_results.answers jsonb를 통째로 펼치고
-- 4개 답안 테이블을 UNION해서 매번 오답을 다시 계산한다. 복습 목록은 그럴 필요가
-- 없다 — 이미 wrong_answer_progress에 단어와 단계가 있다.
--
-- stage를 함께 돌려주는 이유: 연습 화면이 이 값으로 몇 번째 문장을 보여줄지 고른다
-- (0→A1 첫 문장, 1→A1 둘째, 2→A2 첫째, 3→A2 둘째, 4 이상→B1).
CREATE OR REPLACE FUNCTION public.get_due_review_words(_limit int DEFAULT 20)
RETURNS TABLE (word text, stage smallint, due_at timestamptz, overdue_days int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.word,
         p.stage,
         p.due_at,
         GREATEST(0, (((now() AT TIME ZONE 'Asia/Seoul')::date
                       - (p.due_at AT TIME ZONE 'Asia/Seoul')::date))::int) AS overdue_days
    FROM public.wrong_answer_progress p
   WHERE p.student_id = auth.uid()
     AND p.mastered_at IS NULL
     AND p.due_at IS NOT NULL
     AND p.due_at <= now()
   -- 오래 밀린 것부터. 상한(기본 20)을 넘으면 나머지는 내일로 미뤄진다.
   ORDER BY p.due_at ASC, p.word ASC
   LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_due_review_words(int) TO authenticated;

COMMENT ON FUNCTION public.get_due_review_words(int) IS
  '오늘 복습할 단어. 밀린 순으로 최대 _limit개(기본 20).';
