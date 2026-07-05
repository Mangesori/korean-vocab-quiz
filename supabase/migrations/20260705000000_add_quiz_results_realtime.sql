-- quiz_results 테이블을 Realtime Publication에 등록
-- 재채점(sentence_making_score 등) 후 클라이언트가 UPDATE 이벤트를 받아 목록을 재조회할 수 있도록 함
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'quiz_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_results;
  END IF;
END $$;
