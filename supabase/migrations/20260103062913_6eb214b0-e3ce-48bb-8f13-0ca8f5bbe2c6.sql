-- 1. app_role enum에 'admin' 추가
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. user_roles 테이블에 명시적인 UPDATE/DELETE 거부 정책 추가
CREATE POLICY "Users cannot update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Users cannot delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);