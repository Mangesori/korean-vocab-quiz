-- "새 단어로 짝맞추기부터 시작" 보너스 연습용. get_due_review_items와 반환 컬럼 구성은
-- 동일하되, 아직 예정일이 안 된(due_at이 미래이거나 NULL인) 단어를 예정일이 가까운 순으로
-- 돌려준다.
--
-- 이 목록으로 정답을 맞혀도 update_wa_progress의 "이른 복습은 단계를 안 올린다" 가드가
-- 그대로 걸려서 실제 stage/due_at은 안 바뀐다(의도된 동작 — 당겨풀기는 진도를 앞당기지
-- 않는 보너스 연습일 뿐이다). 그래서 여기 필요한 문장 회전은 실제 stage를 그대로 쓴다.
CREATE OR REPLACE FUNCTION public.get_upcoming_review_items(_limit int DEFAULT 20)
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
    SELECT p.word, p.stage, p.due_at, p.level, 0 AS overdue_days
      FROM public.wrong_answer_progress p
     WHERE p.student_id = auth.uid()
       AND p.mastered_at IS NULL
       AND (p.due_at IS NULL OR p.due_at > now())
     ORDER BY p.due_at ASC NULLS LAST, p.word ASC
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
         AND ((c.stage % (c.bank_count + 1)) > 0 OR o.sentence IS NULL)
       ORDER BY (sb.source = 'import') DESC, sb.seq ASC
       OFFSET GREATEST((c.stage % (c.bank_count + 1)) - 1, 0)
       LIMIT 1
    ) b ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_review_items(int) TO authenticated;

COMMENT ON FUNCTION public.get_upcoming_review_items(int) IS
  '아직 예정일 안 된 단어를 예정일이 가까운 순으로 돌려준다(당겨풀기 보너스 연습용). 정답을 맞혀도 실제 SRS 진도는 바뀌지 않는다.';
