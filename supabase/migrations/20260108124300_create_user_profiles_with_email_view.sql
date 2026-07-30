-- Create a secure view that joins profiles with auth.users to expose email
-- This view is only accessible to admins for user management purposes
CREATE OR REPLACE VIEW public.user_profiles_with_email AS
SELECT 
  p.user_id,
  p.name,
  p.avatar_url,
  p.role,
  p.created_at,
  p.updated_at,
  au.email
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id;

-- Enable RLS on the view
ALTER VIEW public.user_profiles_with_email SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.user_profiles_with_email TO authenticated;

-- PostgreSQL은 뷰에 RLS 정책(CREATE POLICY)을 걸 수 없다 — 정책은 테이블 전용
-- 기능이라 이 문장은 어떤 Postgres에서도 "... is not a table"(SQLSTATE 42809)로
-- 실패한다. 원래 여기 있던 "관리자만 조회 가능" CREATE POLICY 블록을 제거했다.
-- (참고: 이 뷰 자체가 완전한 admin-only 접근 제어는 아니다 — security_invoker라
-- profiles의 다른 SELECT 정책, 즉 "자기 프로필"·"자기 학생 프로필" 규칙도 그대로
-- 적용된다. 그런데 이 뷰는 다음 마이그레이션 20260122143500_fix_user_profiles_view_
-- security.sql에서 곧바로 DROP되고 SECURITY DEFINER 함수 get_user_profiles_with_email()
-- 로 교체되어, 최종 상태에서는 진짜 관리자 전용으로 올바르게 잠긴다.)
