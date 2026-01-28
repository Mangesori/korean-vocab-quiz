-- quiz_problems 테이블을 Realtime Publication에 등록
-- 이를 통해 오디오 생성 시 클라이언트에서 실시간으로 업데이트를 받을 수 있음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'quiz_problems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_problems;
  END IF;
END $$;
