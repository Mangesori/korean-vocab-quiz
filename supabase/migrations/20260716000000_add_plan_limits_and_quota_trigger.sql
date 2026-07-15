-- 퀴즈 생성 한도를 플랜 기반으로 DB에서 강제한다. 지금까지는 generate-quiz edge function에
-- 월 10개가 하드코딩돼 있었는데, 복제 버튼처럼 AI를 안 거치고 quizzes에 바로 INSERT하는 경로는
-- 그냥 통과해서 사실상 한도가 없었다. 한도를 plan_limits 테이블로 옮기고 BEFORE INSERT 트리거로
-- 모든 INSERT 경로를 막는다. 구독제로 바꿀 땐 코드 배포 없이 plan_limits를 UPDATE 한 줄로 고치면 된다.
-- 예: UPDATE public.plan_limits SET quiz_limit = 1, period = 'week', updated_at = now() WHERE plan = 'free';

-- ============================================================
-- 1) plan_tier enum + profiles.plan
-- ============================================================
-- CREATE TYPE은 IF NOT EXISTS를 지원하지 않아 duplicate_object를 삼킨다(재실행 안전).
DO $$
BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'school');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- profiles는 이미 존재한다. 원격에만 있는 컬럼(role 등)이 있으므로 절대 새로 만들지 말고
-- ADD COLUMN IF NOT EXISTS로만 접근한다.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.plan_tier NOT NULL DEFAULT 'free';

-- ============================================================
-- 2) plan_limits — 한도의 단일 소스
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan public.plan_tier PRIMARY KEY,
  quiz_limit int,                -- NULL = 무제한
  period text NOT NULL CHECK (period IN ('week', 'month')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- free의 (10, 'month')는 체험 기간 값이다. 구독제를 시작하면 (1, 'week')로 UPDATE할 예정.
-- 요금제 페이지도 나중에 이 행을 읽어야 한다(지금은 "월 3개"라고 따로 적혀 있어 코드와 어긋나 있음).
INSERT INTO public.plan_limits (plan, quiz_limit, period) VALUES
  ('free', 10, 'month'),
  ('pro', NULL, 'month'),
  ('school', NULL, 'month')
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- 공개 정보다. 요금제 페이지가 비로그인 상태로도 읽어야 하므로 anon에게도 SELECT를 연다.
DROP POLICY IF EXISTS "Anyone can read plan limits" ON public.plan_limits;
CREATE POLICY "Anyone can read plan limits"
ON public.plan_limits
FOR SELECT
TO anon, authenticated
USING (true);

-- 쓰기 정책은 일부러 만들지 않는다 → RLS가 anon/authenticated의 쓰기를 전부 막고
-- service_role(RLS 우회)만 한도를 고칠 수 있다. GRANT 회수는 방어를 한 겹 더 두는 것.
GRANT SELECT ON public.plan_limits TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.plan_limits FROM anon, authenticated;

-- ============================================================
-- 3) quiz_quota_status — 카운트 로직 단일화
-- ============================================================
-- 트리거와 edge function 사전 체크가 이 함수 하나를 같이 쓴다(카운트 로직이 두 벌 생기는 걸 막는 게 목적).
-- 반환: { plan, quiz_limit, period, used, allowed }
--   quiz_limit IS NULL AND allowed = true  → 무제한
--   quiz_limit IS NULL AND allowed = false → 한도를 알 수 없음(fail-closed). 둘을 allowed로 구분한다.
CREATE OR REPLACE FUNCTION public.quiz_quota_status(_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _role text;
  _plan public.plan_tier;
  _quiz_limit int;
  _period text;
  _boundary timestamptz;
  _used int;
BEGIN
  -- SECURITY DEFINER + 파라미터라서 그냥 두면 남의 플랜·사용량을 훔쳐볼 수 있다.
  -- 최종 사용자 컨텍스트에서는 본인 또는 admin만 허용한다.
  --
  -- auth.uid()가 NULL이면 통과시킨다. 이게 안전한 이유는 아래 REVOKE로 anon/PUBLIC의
  -- EXECUTE를 걷어냈기 때문이다(REVOKE가 없으면 비로그인으로 아무나 남의 사용량을 읽을 수 있다).
  -- 남는 NULL 컨텍스트는 service_role뿐이고 그건 신뢰 대상이다.
  -- 트리거는 SECURITY DEFINER 함수 안에서 부르므로 EXECUTE 검사를 타지 않고,
  -- 앱의 INSERT는 RLS가 teacher_id = auth.uid()를 강제하므로 _caller = _teacher_id로 통과한다.
  IF _caller IS NOT NULL AND _caller <> _teacher_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION '다른 사용자의 퀴즈 사용량은 조회할 수 없어요.'
      USING ERRCODE = '42501';
  END IF;

  -- quizzes.teacher_id는 auth.users(id)를 가리키고 profiles는 user_id로 연결된다.
  -- role은 원격 DB에만 있는 컬럼이라 enum 라벨에 기대지 않도록 text로 캐스팅해 비교한다.
  SELECT p.role::text, p.plan INTO _role, _plan
  FROM public.profiles p
  WHERE p.user_id = _teacher_id;

  -- fail-closed: 프로필이 없으면 어떤 플랜인지 알 수 없으므로 막는다(예전 edge function은 통과시켰음).
  -- NULL은 전부 타입을 명시한다. jsonb_build_object는 variadic "any"라 타입 없는 NULL을 넘기면
  -- 타입 결정에 실패할 수 있다.
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'plan', NULL::text, 'quiz_limit', NULL::int, 'period', NULL::text,
      'used', NULL::int, 'allowed', false
    );
  END IF;

  -- admin 면제: 현행 edge function이 admin을 한도에서 빼주고 있어 동작을 그대로 유지한다.
  IF _role = 'admin' THEN
    RETURN jsonb_build_object(
      'plan', _plan::text, 'quiz_limit', NULL::int, 'period', NULL::text,
      'used', NULL::int, 'allowed', true
    );
  END IF;

  SELECT l.quiz_limit, l.period INTO _quiz_limit, _period
  FROM public.plan_limits l
  WHERE l.plan = _plan;

  -- fail-closed: plan_limits에 행이 없으면 막는다.
  -- ⚠ 경고: plan_tier에 새 플랜을 추가하면서 plan_limits INSERT를 빠뜨리면
  --    그 플랜 사용자 전원이 퀴즈를 못 만든다. 플랜 추가 시 두 곳을 반드시 같이 고칠 것.
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'plan', _plan::text, 'quiz_limit', NULL::int, 'period', NULL::text,
      'used', NULL::int, 'allowed', false
    );
  END IF;

  -- 기간 경계는 KST 기준. 예전 UTC 계산은 한국 시간과 9시간 어긋나서, 매월 1일 00:00~09:00 KST에
  -- 만든 퀴즈가 지난달 몫으로 세어졌다.
  -- now()(timestamptz) → AT TIME ZONE 'Asia/Seoul'로 서울 벽시계 timestamp를 얻고
  -- → date_trunc으로 그 달/주의 0시를 구한 뒤 → 다시 AT TIME ZONE 'Asia/Seoul'로
  -- "서울 기준 그 시각"의 timestamptz로 되돌린다. created_at이 timestamptz라 그대로 비교 가능.
  -- date_trunc('week', ...)는 월요일 시작이라 앱의 주 계산(StudentDashboard의 월요일 기준)과 맞는다.
  _boundary := date_trunc(_period, (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';

  SELECT count(*) INTO _used
  FROM public.quizzes q
  WHERE q.teacher_id = _teacher_id
    AND q.created_at >= _boundary;

  RETURN jsonb_build_object(
    'plan', _plan::text,
    'quiz_limit', _quiz_limit,
    'period', _period,
    'used', _used,
    -- BEFORE INSERT 시점엔 새 행이 아직 안 세어지므로 used < quiz_limit이 곧 "하나 더 만들 수 있나"다.
    'allowed', (_quiz_limit IS NULL OR _used < _quiz_limit)
  );
END;
$$;

-- GRANT만으로는 부족하다. Postgres는 새 함수에 PUBLIC EXECUTE를 기본으로 주므로
-- "authenticated에게만 GRANT"해도 anon은 PUBLIC을 통해 이미 부를 수 있다.
-- 이 함수는 auth.uid()가 NULL이면 소유권 검사를 통과시키므로, REVOKE가 없으면
-- 비로그인 상태로 아무 선생님의 플랜·사용량을 조회할 수 있게 된다.
-- (같은 함정을 20260122143500_fix_user_profiles_view_security.sql에서 이미 겪었다.)
GRANT EXECUTE ON FUNCTION public.quiz_quota_status(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.quiz_quota_status(uuid) FROM PUBLIC, anon;

-- ============================================================
-- 4) 트리거 — 진짜 관문
-- ============================================================
-- RLS INSERT 정책만으로는 한도를 못 막는다. 트리거로 걸어야 DuplicateQuizButton(복제),
-- QuizPreview(생성), WrongAnswerQuizCreate(오답 퀴즈)의 모든 INSERT 경로가 한 번에 막힌다.
CREATE OR REPLACE FUNCTION public.enforce_quiz_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status jsonb;
  _quiz_limit int;
  _period text;
  _period_label text;
BEGIN
  _status := public.quiz_quota_status(NEW.teacher_id);

  -- fail-closed: allowed가 없거나 NULL이면 막는 쪽으로 판단한다.
  IF COALESCE((_status->>'allowed')::boolean, false) THEN
    RETURN NEW;
  END IF;

  _quiz_limit := (_status->>'quiz_limit')::int;
  _period := _status->>'period';

  -- 한도를 알 수 없어서 막힌 경우(프로필 없음 / plan_limits 행 없음). 사용자 잘못이 아니라 설정 문제라
  -- 한도 소진과 다른 문장을 쓴다. SQLSTATE는 기본값(P0001 → PostgREST에서 HTTP 400)으로 둔다.
  IF _quiz_limit IS NULL THEN
    RAISE EXCEPTION '퀴즈 생성 한도를 확인할 수 없어서 퀴즈를 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
  END IF;

  _period_label := CASE _period WHEN 'week' THEN '이번 주' ELSE '이번 달' END;

  -- 이 문장은 PostgREST를 타고 supabase-js의 error.message로 프론트에 그대로 도착한다.
  -- 사용자가 읽는 문장이므로 해요체로 쓴다.
  -- ERRCODE 'PT429': PostgREST는 'PT' + 세 자리 SQLSTATE를 해당 HTTP 상태로 매핑한다.
  -- 기본 P0001은 400이 되는데, 한도 초과는 429가 맞고 기존 edge function도 429를 쓰고 있어 맞춘다.
  -- "요금제를 올리면 더 만들 수 있어요" 같은 안내는 일부러 넣지 않는다.
  -- 지금은 결제 연동이 없고 요금제 페이지도 파킹 상태(체험 기간)라 올릴 방법 자체가 없다.
  -- 구독제를 시작하면 그때 업그레이드 안내를 붙일 것 — src/pages/Pricing.tsx 상단 주석 참조.
  RAISE EXCEPTION '% 퀴즈 생성 한도(%개)를 다 썼어요',
    _period_label, _quiz_limit
    USING ERRCODE = 'PT429';
END;
$$;

DROP TRIGGER IF EXISTS quizzes_enforce_quota ON public.quizzes;
CREATE TRIGGER quizzes_enforce_quota
BEFORE INSERT ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_quiz_quota();

-- 참고(알려진 한계): quiz_quota_status가 STABLE이라 한 INSERT 문이 여러 행을 만들면
-- (supabase-js의 .insert([...]) 배열 형태) 같은 문 안의 앞 행이 카운트에 안 잡혀 한도를 살짝 넘길 수 있다.
-- 현재 앱의 퀴즈 INSERT는 모두 단일 행이라 실제로는 닿지 않는 경로다. 배열 INSERT를 쓰게 되면
-- AFTER STATEMENT 또는 CONSTRAINT 트리거로 바꿔야 한다.

-- ============================================================
-- 5) 인덱스
-- ============================================================
-- quizzes에는 인덱스가 하나도 없었다(FK는 인덱스를 자동으로 만들어주지 않는다).
-- 트리거가 매 INSERT마다 teacher_id + created_at으로 카운트를 돌므로 필요하다.
CREATE INDEX IF NOT EXISTS quizzes_teacher_created_idx
ON public.quizzes (teacher_id, created_at);
