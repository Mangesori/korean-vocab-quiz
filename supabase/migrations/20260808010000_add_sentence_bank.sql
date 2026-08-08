-- 문장 은행 — 복습 때 같은 단어를 매번 다른 문장으로 물어보기 위한 재료 창고.
--
-- 왜 필요한가:
--   복습은 단어 단위(wrong_answer_progress의 PK가 student_id+word)인데, 지금은
--   학생이 실제로 틀린 퀴즈 문제에서 문장을 하나 골라 쓴다
--   (WrongAnswerNotebook.tsx practicePlans). 그래서 매번 같은 문장이 나오고,
--   결국 "단어를 안다"가 아니라 "그 문장을 외웠다"가 된다.
--
-- 회전 규칙 (원본 → 은행1 → 은행2 → 원본 → ... 순환):
--   0번 자리는 선생님이 보낸 원본 퀴즈 문장이다. 은행에 그 단어가 없어도 복습이
--   되어야 하고, 처음 복습은 배운 그대로 확인하는 게 자연스럽기 때문이다.
--   1번부터가 은행 문장이다. 주기 = 1 + (그 단어·레벨의 은행 문장 수).
--
-- ★ 레벨은 올리지 않는다.
--   처음에는 단계가 오를수록 레벨도 올리려 했는데(35일=B1), 그러면 A1 학생이
--   "-는데도" 같은 B1 문법 문장에서 틀린다. 단어를 잊어서가 아니라 문법을 몰라서
--   틀리는 것이라 복습이 재려던 것(그 단어를 기억하나)이 오염된다.
--   난이도는 복습 단계가 아니라 학생이 실제로 진급할 때 올라가야 한다.
--
--   그 "진급"은 선생님이 이미 정하는 퀴즈 난이도를 그대로 따른다. A1 퀴즈에 나온
--   단어는 A1으로 복습하고, 나중에 선생님이 같은 단어를 A2 퀴즈에 넣으면 그때
--   A2로 갱신된다(seed_review_schedule). 학생별 레벨을 따로 관리할 필요가 없다.

CREATE TABLE IF NOT EXISTS public.sentence_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  meaning text,
  level text NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  -- 같은 word+level 안에서의 순서. 1부터. (A1 문장이 둘이면 1, 2)
  seq smallint NOT NULL CHECK (seq >= 1),
  -- 빈칸이 뚫리지 않은 완성형 문장. 빈칸은 answer 위치를 찾아 그때그때 만든다.
  -- 6종 퀴즈 중 넷이 같은 문장을 서로 다른 형태로 쓰기 때문에 완성형으로 둔다.
  sentence text NOT NULL,
  answer text NOT NULL,
  hint text,
  translation text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word, level, seq)
);

-- 복습이 "이 단어의 이 레벨 문장들"을 순서대로 훑는 게 유일한 조회 패턴이다.
CREATE INDEX IF NOT EXISTS sentence_bank_word_level_idx
  ON public.sentence_bank (word, level, seq);

ALTER TABLE public.sentence_bank ENABLE ROW LEVEL SECURITY;

-- 읽기는 로그인한 모두. 학생도 복습할 때 직접 읽어야 한다.
DROP POLICY IF EXISTS "Anyone signed in can read sentence bank" ON public.sentence_bank;
CREATE POLICY "Anyone signed in can read sentence bank"
  ON public.sentence_bank FOR SELECT
  TO authenticated
  USING (true);

-- 쓰기는 관리자만. 은행은 전체가 공유하는 자산이라 아무나 채우면 품질이 무너진다.
DROP POLICY IF EXISTS "Admins manage sentence bank" ON public.sentence_bank;
CREATE POLICY "Admins manage sentence bank"
  ON public.sentence_bank FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 단어별 복습 레벨 ───────────────────────────────────────────
-- 그 단어를 어느 레벨 문장으로 복습할지. 선생님이 마지막으로 그 단어를 낸 퀴즈의
-- 난이도가 들어간다. 아직 모르면 NULL이고, 그때는 은행에서 가장 쉬운 레벨을 쓴다.
ALTER TABLE public.wrong_answer_progress
  ADD COLUMN IF NOT EXISTS level text;

COMMENT ON COLUMN public.wrong_answer_progress.level IS
  '복습에 쓸 문장 레벨. 그 단어가 마지막으로 출제된 퀴즈의 난이도를 따른다.';

-- ── 오늘 복습할 항목 (단어 + 이번 차례에 보여줄 문장) ──────────────
--
-- sentence가 NULL로 오면 "원본 퀴즈 문장을 쓰라"는 뜻이다. 회전의 0번 자리이거나
-- 은행에 그 단어가 없는 경우다. 호출 쪽은 이미 갖고 있는 원래 문항을 그대로 쓴다.
CREATE OR REPLACE FUNCTION public.get_due_review_items(_limit int DEFAULT 20)
RETURNS TABLE (
  word text,
  stage smallint,
  due_at timestamptz,
  overdue_days int,
  level text,
  slot int,
  sentence text,
  answer text,
  hint text,
  translation text,
  meaning text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH due AS (
    SELECT p.word, p.stage, p.due_at, p.level,
           GREATEST(0, (((now() AT TIME ZONE 'Asia/Seoul')::date
                         - (p.due_at AT TIME ZONE 'Asia/Seoul')::date))::int) AS overdue_days
      FROM public.wrong_answer_progress p
     WHERE p.student_id = auth.uid()
       AND p.mastered_at IS NULL
       AND p.due_at IS NOT NULL
       AND p.due_at <= now()
     ORDER BY p.due_at ASC, p.word ASC
     LIMIT GREATEST(_limit, 1)
  ),
  -- 레벨이 아직 없으면 은행에 있는 가장 쉬운 레벨로 대신한다.
  lvl AS (
    SELECT d.*,
           COALESCE(d.level, (SELECT min(b.level) FROM public.sentence_bank b
                               WHERE b.word = d.word)) AS use_level
      FROM due d
  ),
  -- 그 단어·레벨의 은행 문장 수. 주기는 여기에 원본 몫 1을 더한 값이다.
  cyc AS (
    SELECT l.*,
           (SELECT count(*) FROM public.sentence_bank b
             WHERE b.word = l.word AND b.level = l.use_level)::int AS bank_count
      FROM lvl l
  )
  SELECT c.word, c.stage, c.due_at, c.overdue_days, c.use_level,
         -- slot 0 = 원본, 1..n = 은행 seq
         (c.stage % (c.bank_count + 1))::int AS slot,
         s.sentence, s.answer, s.hint, s.translation, s.meaning
    FROM cyc c
    LEFT JOIN LATERAL (
      SELECT b.sentence, b.answer, b.hint, b.translation, b.meaning
        FROM public.sentence_bank b
       WHERE c.bank_count > 0
         AND (c.stage % (c.bank_count + 1)) > 0
         AND b.word = c.word
         AND b.level = c.use_level
         AND b.seq = (c.stage % (c.bank_count + 1))
       LIMIT 1
    ) s ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_review_items(int) TO authenticated;

COMMENT ON FUNCTION public.get_due_review_items(int) IS
  '오늘 복습할 단어와 이번 차례 문장. sentence가 NULL이면 원본 퀴즈 문장을 쓴다.';

-- ── 퀴즈를 푼 단어 전체를 복습 스케줄에 올린다 ─────────────────────
--
-- 지금까지는 학생이 오답노트에서 "연습하기"를 눌러야만 진행도 행이 생겼다
-- (update_wa_progress를 부르는 곳이 WrongAnswerPractice 한 곳뿐이다).
-- 그래서 (1) 연습을 안 누르면 아무 일도 안 일어나고 (2) 맞힌 단어는 어디에도
-- 남지 않아 다시는 복습되지 않았다. 한 번 맞혔다고 석 달 뒤에도 안다는 보장이
-- 없는데, 간격 반복의 핵심은 원래 아는 것도 잊기 직전에 다시 보는 것이다.
--
--   틀린 단어 → stage 0, 내일     (빨리 다시)
--   맞힌 단어 → stage 2, 7일 뒤   (이미 아니까 천천히)
--
-- 결과 ID만 받는다. 단어별 정오 판정은 서버가 이미 채점해 둔 답안에서 직접 읽는다.
-- (클라이언트가 단어 목록을 만들어 보내는 방식은 두 가지가 위험했다: 빈칸 채점이
--  submit_quiz_answers 안에서만 이뤄져 클라이언트에 단어별 정오가 남지 않는다는 것,
--  그리고 auth.uid() 기반이라 선생님이 학생 결과 화면을 열면 선생님 스케줄에
--  등록돼 버린다는 것이다. 여기서는 결과의 주인을 먼저 확인해 원천 차단한다.)
CREATE OR REPLACE FUNCTION public.seed_review_schedule(_result_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _quiz_id uuid;
  _level text;
  _inserted int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN 0;
  END IF;

  -- 본인 결과일 때만. 선생님이 학생 결과를 열람해도 아무 일도 일어나지 않는다.
  SELECT quiz_id INTO _quiz_id
    FROM public.quiz_results
   WHERE id = _result_id AND student_id = _uid;

  IF _quiz_id IS NULL THEN
    RETURN 0;
  END IF;

  -- C안: 복습 레벨 = 이 퀴즈의 난이도. 선생님이 이미 정하고 있는 값을 그대로 쓴다.
  SELECT difficulty::text INTO _level FROM public.quizzes WHERE id = _quiz_id;

  WITH
  all_words AS (
    SELECT DISTINCT trim(w) AS word
      FROM public.quizzes q, unnest(q.words) w
     WHERE q.id = _quiz_id AND trim(w) <> ''
  ),
  -- 이번 결과에서 틀린 단어. 문장 순서 맞추기는 단위가 문장이라 제외한다
  -- (그 단어는 어차피 다른 유형에서 같이 다뤄진다).
  wrong_words AS (
    SELECT COALESCE(NULLIF(elem->>'word',''), elem->>'correctAnswer') AS word
      FROM public.quiz_results r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.answers, '[]'::jsonb)) elem
     WHERE r.id = _result_id
       AND COALESCE((elem->>'isCorrect')::boolean, false) = false
    UNION
    SELECT p.korean_text
      FROM public.matchup_answers a
      JOIN public.matchup_problems p
        ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
     WHERE a.result_id = _result_id AND a.is_correct = false
    UNION
    SELECT p.answer
      FROM public.type_answer_answers a
      JOIN public.type_answer_problems p
        ON p.quiz_id = a.quiz_id AND p.problem_id = a.problem_id
     WHERE a.result_id = _result_id AND a.is_correct = false
  ),
  ins AS (
    INSERT INTO public.wrong_answer_progress
           (student_id, word, correct_streak, last_practiced_at, stage, due_at, level)
    SELECT _uid, a.word, 0, now(),
           CASE WHEN w.word IS NULL THEN 2 ELSE 0 END,
           public.wa_due_after(CASE WHEN w.word IS NULL THEN 7 ELSE 1 END),
           _level
      FROM all_words a
      LEFT JOIN wrong_words w ON w.word = a.word
    -- 진행 중인 단어는 단계·예정일을 건드리지 않는다. 35일까지 올라간 단어가
    -- 퀴즈에 한 번 나왔다고 7일로 되돌아가면 그동안의 진도가 무너진다.
    -- 다만 레벨은 갱신한다 — 선생님이 같은 단어를 더 높은 난이도 퀴즈에 넣었다면
    -- 그게 곧 "이 학생은 이제 그 수준"이라는 판단이고, 다음 복습부터 반영돼야 한다.
    ON CONFLICT (student_id, word) DO UPDATE
      SET level = COALESCE(EXCLUDED.level, public.wrong_answer_progress.level)
    RETURNING 1
  )
  SELECT count(*)::int INTO _inserted FROM ins;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_review_schedule(uuid) TO authenticated;

COMMENT ON FUNCTION public.seed_review_schedule(uuid) IS
  '퀴즈 결과의 단어를 복습 스케줄에 올린다. 틀림=내일, 맞음=7일 뒤. 레벨은 퀴즈 난이도를 따른다.';
