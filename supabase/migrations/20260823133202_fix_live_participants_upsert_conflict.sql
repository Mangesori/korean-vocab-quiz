-- live_participants_session_student_idx가 부분 인덱스(WHERE student_id IS NOT NULL)라서
-- 로그인 학생이 라이브 세션에 입장할 때 쓰는 클라이언트 upsert(onConflict:
-- "session_id,student_id", src/hooks/useJoinLiveSession.ts)가 400으로 실패했다.
-- PostgreSQL의 ON CONFLICT (컬럼들)은 그 컬럼 조합에 대한 "일반" 유니크 제약/인덱스만
-- 대상으로 삼을 수 있다 — 부분 인덱스는 INSERT 쪽에서도 같은 WHERE절을 명시해야 쓸 수
-- 있는데, PostgREST의 onConflict 옵션은 컬럼 이름만 받고 조건절은 못 넘긴다.
--
-- WHERE student_id IS NOT NULL 조건은 애초에 불필요했다 — Postgres 유니크 제약에서
-- NULL끼리는 서로 다른 값으로 취급되므로, 조건절 없는 일반 유니크 인덱스로 바꿔도
-- 게스트(student_id NULL) 행들은 원래처럼 서로 충돌하지 않는다.
DROP INDEX IF EXISTS public.live_participants_session_student_idx;

CREATE UNIQUE INDEX IF NOT EXISTS live_participants_session_student_idx
  ON public.live_participants (session_id, student_id);
