-- Function to update quiz progress notification (SECURITY DEFINER bypasses RLS)
-- Called by students after completing each stage; overwrites the teacher's notification
-- so the teacher sees one notification per student per quiz (not one per stage).
CREATE OR REPLACE FUNCTION public.update_quiz_progress_notification(
  _quiz_id UUID,
  _student_id UUID,
  _message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET
    message    = _message,
    is_read    = false,
    created_at = now()
  WHERE quiz_id      = _quiz_id
    AND from_user_id = _student_id
    AND type         = 'quiz_completed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(UUID, UUID, TEXT) TO authenticated;
