-- 문장 은행 관리자 화면의 커버리지 위젯용 RPC. 레벨별로 단어 수와, 문장이 2개 이상 쌓여
-- 회전이 가능한(원본↔은행 순환이 의미 있는) 단어 수를 함께 세어 채움 상태를 보여준다.
CREATE OR REPLACE FUNCTION public.get_sentence_bank_coverage()
RETURNS TABLE (level text, total_words int, words_with_2plus int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT b.level,
         count(DISTINCT b.word)::int,
         count(DISTINCT b.word) FILTER (
           WHERE b.word IN (
             SELECT word FROM public.sentence_bank b2
              WHERE b2.level = b.level GROUP BY word HAVING count(*) >= 2
           )
         )::int
    FROM public.sentence_bank b
   GROUP BY b.level;
$$;

GRANT EXECUTE ON FUNCTION public.get_sentence_bank_coverage() TO authenticated;
