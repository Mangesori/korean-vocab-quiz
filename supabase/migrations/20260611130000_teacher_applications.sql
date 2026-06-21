-- 선생님 신청(승인 워크플로) 테이블
--
-- 공개 가입에서 "선생님"을 선택한 사용자는 우선 student로 가입되고
-- 이 테이블에 pending 신청이 생성된다. 운영자가 승인하면 profiles.role이
-- teacher로 승격된다.
--
-- 핵심: status 컬럼을 권한 게이트로 쓰지 않는다. 미승인 신청자는 실제로
-- role='student'이므로 기존 역할 기반 RLS가 자동으로 선생님 권한(퀴즈 생성·
-- 학생 데이터 열람 등)을 막아준다. 권한의 단일 진실은 role이다.

CREATE TABLE public.teacher_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id)
);

ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

-- 본인은 자신의 신청을 생성할 수 있다 (가입 시 1회)
CREATE POLICY "Users can create their own application"
  ON public.teacher_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 본인은 자신의 신청 상태를 조회할 수 있다 (검토 중 배너용)
CREATE POLICY "Users can view their own application"
  ON public.teacher_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 관리자만 모든 신청을 조회한다
CREATE POLICY "Admins can view all applications"
  ON public.teacher_applications FOR SELECT
  TO authenticated
  USING (is_admin());

-- 관리자만 신청을 승인/거절(수정)한다.
-- 신청자 본인에게는 UPDATE 권한을 주지 않아 스스로 승인할 수 없다.
CREATE POLICY "Admins can update applications"
  ON public.teacher_applications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 대기 중 신청 조회 최적화
CREATE INDEX idx_teacher_applications_pending
  ON public.teacher_applications (status, created_at DESC);
