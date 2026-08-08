-- 문장 은행 — 복습 때 같은 단어를 매번 다른 문장으로 물어보기 위한 재료 창고.
--
-- 왜 필요한가:
--   복습은 단어 단위(wrong_answer_progress의 PK가 student_id+word)인데, 지금은
--   학생이 실제로 틀린 퀴즈 문제에서 문장을 하나 골라 쓴다
--   (WrongAnswerNotebook.tsx practicePlans). 그래서 매번 같은 문장이 나오고,
--   결국 "단어를 안다"가 아니라 "그 문장을 외웠다"가 된다.
--
--   여기에 단어별로 여러 문장을 쌓아 두면 단계(stage)마다 다른 문장을 낼 수 있다.
--   간격이 길어질수록 문법도 어려워지도록 레벨 순서로 배치한다:
--
--     stage 0(1일)  → A1 첫째    stage 1(3일)  → A1 둘째
--     stage 2(7일)  → A2 첫째    stage 3(16일) → A2 둘째
--     stage 4(35일) → B1         stage 5(90일) → B1 (마지막 확인)
--
--   35일 뒤에 B1 문법 안에 들어 있는 그 단어를 만나야 하므로 문장 암기로는 통과가 안 된다.

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

-- 복습이 "이 단어의 문장들"을 레벨·순서대로 훑는 게 유일한 조회 패턴이다.
CREATE INDEX IF NOT EXISTS sentence_bank_word_idx
  ON public.sentence_bank (word, level, seq);

ALTER TABLE public.sentence_bank ENABLE ROW LEVEL SECURITY;

-- 읽기는 로그인한 모두. 학생도 복습할 때 직접 읽어야 한다.
-- (정답이 노출되지만 빈칸 채우기 정답은 이미 quiz_problems에도 평문으로 있고,
--  문장 은행은 교재 성격이라 숨길 실익이 없다.)
CREATE POLICY "Anyone signed in can read sentence bank"
  ON public.sentence_bank FOR SELECT
  TO authenticated
  USING (true);

-- 쓰기는 관리자만. 은행은 전체가 공유하는 자산이라 아무나 채우면 품질이 무너진다.
-- (UI에서도 붙여넣기 페이지 자체가 최고 관리자 전용이지만, DB에서도 막아 둔다.)
CREATE POLICY "Admins manage sentence bank"
  ON public.sentence_bank FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 오늘 복습할 항목 (단어 + 그 단계에 보여줄 문장) ────────────────
--
-- get_due_review_words가 단어만 돌려주던 것을 문장까지 붙여 확장한 판이다.
-- 앞의 것도 남겨 둔다(문장 은행이 비어 있어도 동작해야 하므로).
--
-- 문장 고르기: 단계에 대응하는 (레벨, 순서)를 1순위로 하되, 은행에 그 칸이
-- 비어 있으면 같은 단어의 다른 문장으로 대체한다. 은행에 그 단어가 아예 없으면
-- 행 자체를 돌려주되 sentence를 NULL로 두어, 호출 쪽이 기존 방식(학생이 틀린
-- 문제에서 문장 가져오기)으로 폴백할 수 있게 한다.
CREATE OR REPLACE FUNCTION public.get_due_review_items(_limit int DEFAULT 20)
RETURNS TABLE (
  word text,
  stage smallint,
  due_at timestamptz,
  overdue_days int,
  sentence text,
  answer text,
  hint text,
  translation text,
  meaning text,
  level text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH due AS (
    SELECT p.word, p.stage, p.due_at,
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
  -- 단계 → 원하는 (레벨, 순서). stage 4 이상은 전부 B1 1번.
  want AS (
    SELECT d.*,
           CASE WHEN d.stage <= 1 THEN 'A1' WHEN d.stage <= 3 THEN 'A2' ELSE 'B1' END AS want_level,
           CASE WHEN d.stage IN (0, 2) THEN 1 WHEN d.stage IN (1, 3) THEN 2 ELSE 1 END AS want_seq
      FROM due d
  )
  SELECT w.word, w.stage, w.due_at, w.overdue_days,
         s.sentence, s.answer, s.hint, s.translation, s.meaning, s.level
    FROM want w
    LEFT JOIN LATERAL (
      SELECT b.sentence, b.answer, b.hint, b.translation, b.meaning, b.level
        FROM public.sentence_bank b
       WHERE b.word = w.word
       -- 원하는 칸이 있으면 그것, 없으면 레벨·순서가 가장 가까운 문장.
       ORDER BY (b.level = w.want_level AND b.seq = w.want_seq) DESC,
                (b.level = w.want_level) DESC,
                b.level ASC, b.seq ASC
       LIMIT 1
    ) s ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_review_items(int) TO authenticated;

COMMENT ON FUNCTION public.get_due_review_items(int) IS
  '오늘 복습할 단어와 그 단계에 보여줄 문장. 은행에 없으면 sentence가 NULL로 온다.';

-- ── 퀴즈를 푼 단어 전체를 복습 스케줄에 올린다 ─────────────────────
--
-- 지금까지는 학생이 오답노트에서 "연습하기"를 눌러야만 진행도 행이 생겼다
-- (update_wa_progress를 부르는 곳이 WrongAnswerPractice 한 곳뿐이다).
-- 그래서 (1) 연습을 안 누르면 아무 일도 안 일어나고 (2) 맞힌 단어는 어디에도
-- 남지 않아 다시는 복습되지 않았다. 한 번 맞혔다고 석 달 뒤에도 안다는 보장이
-- 없는데, 간격 반복의 핵심은 원래 아는 것도 잊기 직전에 다시 보는 것이다.
--
-- 그래서 퀴즈를 제출하는 순간 그 퀴즈의 모든 단어를 스케줄에 올린다.
--   틀린 단어 → stage 0, 내일     (빨리 다시)
--   맞힌 단어 → stage 2, 7일 뒤   (이미 아니까 천천히)
--
-- 이미 진행 중인 단어는 건드리지 않는다(ON CONFLICT DO NOTHING). 35일 단계까지
-- 올라간 단어가 퀴즈에 한 번 나왔다고 7일로 되돌아가면 진도가 무너진다.
-- 진행 중인 단어의 단계 조정은 복습 화면의 update_wa_progress가 담당한다.
-- 결과 ID만 받는다. 단어별 정오 판정은 서버가 이미 채점해 둔 답안에서 직접 읽는다.
-- (클라이언트가 단어 목록을 만들어 보내는 방식은 두 가지가 위험했다:
--  하나는 빈칸 채우기 채점이 submit_quiz_answers 안에서만 이뤄져 클라이언트에
--  단어별 정오가 남지 않는다는 것, 다른 하나는 auth.uid() 기반이라 선생님이
--  학생 결과 화면을 열면 선생님 스케줄에 등록돼 버린다는 것이다.
--  여기서는 결과의 주인이 호출자인지 먼저 확인하므로 그 사고가 원천 차단된다.)
CREATE OR REPLACE FUNCTION public.seed_review_schedule(_result_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _quiz_id uuid;
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

  WITH
  -- 이 퀴즈가 다룬 단어 전체. 맞힌 단어까지 스케줄에 올려야 "한 번 맞혔다고
  -- 석 달 뒤에도 안다"는 가정을 하지 않게 된다.
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
           (student_id, word, correct_streak, last_practiced_at, stage, due_at)
    SELECT _uid, a.word, 0, now(),
           CASE WHEN w.word IS NULL THEN 2 ELSE 0 END,
           public.wa_due_after(CASE WHEN w.word IS NULL THEN 7 ELSE 1 END)
      FROM all_words a
      LEFT JOIN wrong_words w ON w.word = a.word
    -- 이미 진행 중인 단어는 건드리지 않는다. 35일 단계까지 올라간 단어가 퀴즈에
    -- 한 번 나왔다고 7일로 되돌아가면 그동안의 진도가 무너진다. 진행 중인 단어의
    -- 단계 조정은 복습 화면의 update_wa_progress가 담당한다.
    ON CONFLICT (student_id, word) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO _inserted FROM ins;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_review_schedule(uuid) TO authenticated;

COMMENT ON FUNCTION public.seed_review_schedule(uuid) IS
  '퀴즈 결과의 단어를 복습 스케줄에 올린다. 틀림=내일, 맞음=7일 뒤. 기존 행은 유지. 본인 결과만.';
