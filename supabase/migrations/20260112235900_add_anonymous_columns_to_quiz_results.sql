-- 스키마 드리프트 수정: quiz_results.is_anonymous/share_token/anonymous_name/viewed_at는
-- 실제 운영 DB(src/integrations/supabase/types.ts)에는 있지만 이 마이그레이션 이력에는
-- 만들어진 적이 없다. 바로 다음 마이그레이션(20260113000000_allow_anonymous_quiz_results.sql)이
-- is_anonymous/share_token을 참조해서 로컬 `supabase db reset`이 여기서 막힌다.
-- (scripts/help-shots/README.md의 "스키마 드리프트" 트러블슈팅 절차를 따른 것.)
ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token text REFERENCES public.quiz_shares(share_token),
  ADD COLUMN IF NOT EXISTS anonymous_name text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- 비회원 제출은 student_id가 NIL UUID로 들어오므로 FK를 만족시켜야 한다(원래
-- student_id는 auth.users(id) NOT NULL이었다 — 이 시점 스키마 그대로 nullable로 완화).
ALTER TABLE public.quiz_results
  ALTER COLUMN student_id DROP NOT NULL;
