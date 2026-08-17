-- get_due_review_items의 문장 회전 slot이 wrong_answer_progress.stage(0~5) 값을
-- 그대로 나머지 연산에 썼는데, 6개 유형 중 실제로 문장을 쓰는 건 3개뿐이다
-- (stage 2=빈칸 채우기, stage 3=문장 순서 맞추기, stage 5=말하기 — 나머지
-- 0 짝맞추기·1 단어받아쓰기·4 문장만들기는 단어/뜻만 쓰고 문장 자체를 안 보여준다).
--
-- 그 결과 은행 문장이 2개인 흔한 경우, slot 1(은행 1번째)이 배정되는 stage가
-- 하필 1·4(둘 다 문장 안 씀)라 은행 1번째 문장은 화면에 영영 안 뜨고, slot 2
-- (은행 2번째)만 stage 2·5에서 두 번 반복해서 보여지는 문제가 있었다.
--
-- 수정: stage 번호 대신 "문장을 쓰는 스테이지(2·3·5) 안에서의 순번(0·1·2)"으로
-- 회전시킨다. src/lib/korean/reviewSchedule.ts의 pickRotatedSentence와 반드시
-- 같은 규칙을 유지해야 한다(그쪽도 같이 고쳤다).

DROP FUNCTION IF EXISTS public.get_due_review_items(int);

CREATE FUNCTION public.get_due_review_items(_limit int DEFAULT 20)
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
  meaning text,
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
             WHERE b.word = l.word AND b.level = l.use_level)::int AS bank_count,
           -- 문장을 쓰는 stage(2·3·5)에서의 순번. 문장을 안 쓰는 stage(0·1·4)는
           -- 결과가 어차피 화면에 안 쓰이니 0으로 둔다.
           (CASE l.stage WHEN 2 THEN 0 WHEN 3 THEN 1 WHEN 5 THEN 2 ELSE 0 END)::int AS exposure_index
      FROM lvl l
  ),
  -- 원본 = 이 학생이 **이미 제출한** 퀴즈 중 그 단어가 나온 가장 최근 문제.
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
         (c.exposure_index % (c.bank_count + 1))::int AS slot,
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
         AND ((c.exposure_index % (c.bank_count + 1)) > 0 OR o.sentence IS NULL)
       ORDER BY (sb.source = 'import') DESC, sb.seq ASC
       OFFSET GREATEST((c.exposure_index % (c.bank_count + 1)) - 1, 0)
       LIMIT 1
    ) b ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_review_items(int) TO authenticated;

COMMENT ON FUNCTION public.get_due_review_items(int) IS
  '오늘 복습할 단어와 이번 차례 문장(은행 또는 원본). 문장을 쓰는 stage(2·3·5) 순번으로 회전한다. 이미 제출한 자기 퀴즈 범위에서만 정답을 돌려준다.';
