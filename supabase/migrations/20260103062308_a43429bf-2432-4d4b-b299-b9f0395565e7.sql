-- 1. 과도하게 허용된 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can view class by invite code" ON public.classes;

-- 2. 초대 코드로 클래스 조회하는 보안 함수 생성
CREATE OR REPLACE FUNCTION public.get_class_by_invite_code(_invite_code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description
  FROM public.classes
  WHERE invite_code = _invite_code
  LIMIT 1
$$;