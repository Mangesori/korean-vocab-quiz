-- 학생이 처음 입장할 때 INSERT는 WITH CHECK를 통과하는데, 그 뒤 RETURNING(및 클라이언트의
-- .select())이 또 SELECT 정책을 거친다. 기존 SELECT 정책 "같은 세션 참가자끼리 보인다"는
-- is_live_participant(session_id) 함수로 "이미 참가자인지"를 다시 조회하는 자기참조 구조라,
-- 방금 막 INSERT된 바로 그 행을 같은 커맨드 안에서 RETURNING으로 돌려줄 때 안정적으로
-- 보이지 않아 "new row violates row-level security policy" 42501 에러가 났다(실측: DB에서
-- 직접 INSERT ... RETURNING을 시뮬레이션해 재현·검증함).
--
-- 학생이 자기 자신의 참가 행은 (다른 조건 없이) 항상 볼 수 있게 하는 정책을 추가해
-- RETURNING 시점에도 안정적으로 보이게 한다. 보안상 문제없음 — 자기 행만 보는 정책이다.
CREATE POLICY "학생은 자기 참가 기록을 본다"
  ON public.live_participants
  FOR SELECT
  USING (student_id = auth.uid());
