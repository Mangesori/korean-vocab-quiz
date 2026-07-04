-- 사용자 피드백 수집 테이블
--
-- 퀴즈 종료 화면·푸터·요금 페이지 등에서 누구나(익명 게스트 포함) 피드백을 남길 수 있다.
-- 검증 단계의 최저비용 수요 센서. 읽기는 관리자만(관리자 대시보드에서 확인).
-- 권한 게이트는 기존 is_admin() SECURITY DEFINER 함수를 재사용한다.

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  email text,
  rating int CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  context text,                                                  -- 보낸 위치: quiz_result / share_result / footer / pricing 등
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,     -- 로그인 상태면 기록
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 누구나(익명 포함) 피드백을 보낼 수 있다. 공유 링크로 들어온 게스트도 제출 가능해야 한다.
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 읽기는 관리자만.
CREATE POLICY "Admins can read feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (is_admin());

-- 최신순 조회 최적화
CREATE INDEX idx_feedback_created_at
  ON public.feedback (created_at DESC);
