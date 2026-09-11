-- 스키마 드리프트 수정: profiles.role은 실제 운영 DB에는 있지만 이 마이그레이션 이력에는
-- 한 번도 만들어진 적이 없다(user_roles 테이블 방식에서 profiles.role 방식으로 넘어갈 때
-- Supabase Studio에서 컬럼을 직접 추가하고 마이그레이션 파일로 옮기는 걸 빠뜨린 것으로 보인다).
-- 로컬 `supabase db reset` 재현이 바로 다음 마이그레이션(20260106131800_fix_storage_policies.sql,
-- profiles.role을 참조)에서 "column role does not exist"로 막히므로, 그 앞에 끼워 넣는다.
-- (scripts/help-shots/README.md의 "스키마 드리프트" 트러블슈팅 절차를 따른 것.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'student';

-- user_roles에 이미 데이터가 있으면(로컬 신규 DB는 보통 비어 있다) profiles.role로 반영한다.
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE ur.user_id = p.user_id;
