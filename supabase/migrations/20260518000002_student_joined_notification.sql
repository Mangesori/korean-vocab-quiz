-- Notify the class teacher when a student joins their class.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'student_joined';

CREATE OR REPLACE FUNCTION public.notify_class_teacher_on_join(_class_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _student_name text;
  _teacher_id uuid;
  _class_name text;
BEGIN
  _student_id := auth.uid();
  IF _student_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT name INTO _student_name FROM profiles WHERE user_id = _student_id;
  IF _student_name IS NULL THEN _student_name := '학생'; END IF;

  SELECT teacher_id, name INTO _teacher_id, _class_name FROM classes WHERE id = _class_id;
  IF _teacher_id IS NULL THEN RETURN; END IF;

  INSERT INTO notifications (user_id, type, title, message, from_user_id)
  VALUES (
    _teacher_id,
    'student_joined'::notification_type,
    _student_name || korean_subject_postfix(_student_name) || ' ' || _class_name || ' 클래스에 가입했습니다.',
    _class_name,
    _student_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_class_teacher_on_join(UUID) TO authenticated;
