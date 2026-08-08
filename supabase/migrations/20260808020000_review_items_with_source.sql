-- get_due_review_items가 "원본 퀴즈 문장"까지 함께 돌려주도록 확장한다.
--
-- 왜 필요한가:
--   회전의 0번 자리는 선생님이 보낸 원본 문장인데, 학생이 그걸 직접 읽어올 수가
--   없다. quiz_problems는 배정된 퀴즈면 읽히지만 **정답은 quiz_answers에 있고
--   그 테이블은 선생님만 읽도록 막혀 있다**(정답 노출 방지). 빈칸 채우기 연습은
--   정답이 있어야 채점이 되므로 원본을 쓸 방법이 없었다.
--
--   특히 seed_review_schedule로 들어온 "맞힌 단어"는 오답 기록이 아예 없어서
--   get_student_wrong_answers로도 문장을 못 얻는다. 그 단어들은 은행에 없으면
--   복습할 내용 자체가 없어지는 상태였다.
--
--   그래서 이 함수를 SECURITY DEFINER로 바꿔 정답을 함께 돌려준다. 안전한 이유는
--   **이미 제출해서 결과를 본 자기 퀴즈**로만 범위가 좁혀지기 때문이다. 학생이
--   아직 안 푼 퀴즈의 정답은 절대 나오지 않는다.

-- 반환 컬럼이 늘어나(sentence_from 추가) CREATE OR REPLACE로는 못 바꾼다.
-- ("cannot change return type of existing function") 먼저 지우고 다시 만든다.
DROP FUNCTION IF EXISTS public.get_due_review_items(int);

CREATE FUNCTION public.get_due_review_items(_limit int DEFAULT 20)
RETURNS TABLE (
  word text,
  stage smallint,
  due_at timestamptz,
  overdue_days int,
  level text,
  slot int,
  -- 이번 차례에 쓸 문장. 은행 문장이거나(slot >= 1) 원본이거나(slot 0).
  -- 둘 다 없으면 NULL이고, 그런 단어는 호출 쪽이 건너뛴다.
  sentence text,
  answer text,
  hint text,
  translation text,
  meaning text,
  -- 'bank' | 'original' — 화면에서 출처를 구분해야 할 때를 위해 남긴다.
  sentence_from text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
  lvl AS (
    SELECT d.*,
           COALESCE(d.level, (SELECT min(b.level) FROM public.sentence_bank b
                               WHERE b.word = d.word)) AS use_level
      FROM due d
  ),
  cyc AS (
    SELECT l.*,
           (SELECT count(*) FROM public.sentence_bank b
             WHERE b.word = l.word AND b.level = l.use_level)::int AS bank_count
      FROM lvl l
  ),
  -- 원본 = 이 학생이 **이미 제출한** 퀴즈 중 그 단어가 나온 가장 최근 문제.
  -- quiz_problems.sentence에는 빈칸 ( )이 이미 뚫려 있다.
  orig AS (
    SELECT DISTINCT ON (qp.word)
           qp.word,
           qp.sentence,
           qa.correct_answer AS answer,
           qp.hint,
           qp.translation
      FROM public.quiz_results r
      JOIN public.quiz_problems qp ON qp.quiz_id = r.quiz_id
      JOIN public.quiz_answers  qa ON qa.quiz_id = qp.quiz_id
                                  AND qa.problem_id = qp.problem_id
     WHERE r.student_id = auth.uid()
       AND qp.word IN (SELECT c.word FROM cyc c)
     ORDER BY qp.word, r.completed_at DESC
  )
  SELECT c.word, c.stage, c.due_at, c.overdue_days, c.use_level,
         (c.stage % (c.bank_count + 1))::int AS slot,
         -- 0번 자리는 원본, 1번부터는 은행. 원본이 없으면 은행으로, 은행도 없으면 NULL.
         COALESCE(b.sentence, o.sentence)      AS sentence,
         COALESCE(b.answer,   o.answer)        AS answer,
         COALESCE(b.hint,     o.hint)          AS hint,
         COALESCE(b.translation, o.translation) AS translation,
         b.meaning,
         CASE WHEN b.sentence IS NOT NULL THEN 'bank'
              WHEN o.sentence IS NOT NULL THEN 'original'
              ELSE NULL END                    AS sentence_from
    FROM cyc c
    LEFT JOIN orig o ON o.word = c.word
    LEFT JOIN LATERAL (
      SELECT sb.sentence, sb.answer, sb.hint, sb.translation, sb.meaning
        FROM public.sentence_bank sb
       WHERE c.bank_count > 0
         AND sb.word = c.word
         AND sb.level = c.use_level
         -- slot 0이면 원본을 쓴다. 단 원본이 없으면(o.sentence IS NULL) 은행 첫 문장으로
         -- 대신한다 — 그러지 않으면 그 단어는 복습할 내용이 아예 없어진다.
         AND ((c.stage % (c.bank_count + 1)) > 0 OR o.sentence IS NULL)
       -- 검수 문장(import)을 먼저 쓰고 모자랄 때만 AI 수집분(quiz)으로 넘어간다.
       ORDER BY (sb.source = 'import') DESC, sb.seq ASC
       OFFSET GREATEST((c.stage % (c.bank_count + 1)) - 1, 0)
       LIMIT 1
    ) b ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_review_items(int) TO authenticated;

COMMENT ON FUNCTION public.get_due_review_items(int) IS
  '오늘 복습할 단어와 이번 차례 문장(은행 또는 원본). 이미 제출한 자기 퀴즈 범위에서만 정답을 돌려준다.';
