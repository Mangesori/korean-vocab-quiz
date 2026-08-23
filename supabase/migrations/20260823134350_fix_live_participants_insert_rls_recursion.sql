-- "학생은 열린 세션에 입장한다" 정책이 live_sessions를 직접 서브쿼리로 조회해서,
-- live_sessions의 SELECT 정책(선생님 본인 또는 "이미 참가자인 사람"만 조회 가능,
-- is_live_participant() 참고)에 걸린다. 처음 입장하려는 학생은 아직 참가자가
-- 아니므로 live_sessions 행이 안 보이고, EXISTS(...)가 거짓이 되어 WITH CHECK를
-- 통과하지 못한다 — 로그인 학생의 첫 입장이 구조적으로 막혀 있었다.
--
-- is_live_participant()와 같은 패턴(SECURITY DEFINER로 RLS 우회)의 헬퍼를 만들어
-- 세션 상태 체크에 쓴다.
CREATE OR REPLACE FUNCTION public.live_session_is_open(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = p_session_id AND status <> 'ended'
  );
$$;

DROP POLICY IF EXISTS "학생은 열린 세션에 입장한다" ON public.live_participants;
CREATE POLICY "학생은 열린 세션에 입장한다"
  ON public.live_participants
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND is_guest = false
    AND public.live_session_is_open(session_id)
  );
