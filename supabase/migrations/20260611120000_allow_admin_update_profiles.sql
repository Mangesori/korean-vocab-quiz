-- Fix: 관리자가 다른 사용자의 프로필(역할)을 변경할 수 없던 문제
--
-- 기존 profiles UPDATE 정책은 "Users can update their own profile"
-- (USING auth.uid() = user_id) 하나뿐이라, 관리자가 다른 사용자의 role을
-- UPDATE하면 RLS가 해당 행을 걸러내 0행만 갱신되고 에러는 발생하지 않았다.
-- 그 결과 화면(낙관적 캐시)에서는 변경된 것처럼 보이지만 DB에는 반영되지
-- 않아 새로고침 시 원래 역할로 되돌아갔다.
--
-- is_admin()은 profiles.role = 'admin'을 확인하는 SECURITY DEFINER 함수로,
-- profiles 정책 안에서 사용해도 RLS 재귀가 발생하지 않는다.

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
