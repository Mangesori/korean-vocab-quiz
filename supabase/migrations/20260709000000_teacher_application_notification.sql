-- 선생님 신청 시 모든 관리자에게 인앱 알림을 자동 생성하는 트리거.
--
-- teacher_applications에 새 신청(INSERT)이 들어오면, role='admin'인 모든
-- profiles 사용자에게 notifications 행을 하나씩 생성해 검토를 요청한다.
-- student_joined 알림(20260518000002) 선례의 방식을 그대로 본떴다:
--   enum 값 추가 + SECURITY DEFINER 함수 + notifications INSERT.
--
-- 참고: 아래 함수 본문이 'teacher_application' enum 값을 문자열로 참조하지만,
-- 함수 본문은 생성 시점이 아니라 실행 시점에 평가되므로 같은 마이그레이션에서
-- ADD VALUE 직후에 정의해도 안전하다(student_joined 선례가 동일).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'teacher_application';

CREATE OR REPLACE FUNCTION public.notify_admins_on_teacher_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _applicant_name text;
BEGIN
  SELECT name INTO _applicant_name FROM profiles WHERE user_id = NEW.user_id;
  _applicant_name := COALESCE(_applicant_name, '어떤 사용자');

  INSERT INTO notifications (user_id, type, title, message, from_user_id)
  SELECT
    p.user_id,
    'teacher_application',
    '새 선생님 신청',
    _applicant_name || '님이 선생님 신청을 했어요. 검토해주세요.',
    NEW.user_id
  FROM profiles p
  WHERE p.role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_teacher_application ON public.teacher_applications;

CREATE TRIGGER trg_notify_admins_on_teacher_application
  AFTER INSERT ON public.teacher_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_teacher_application();
