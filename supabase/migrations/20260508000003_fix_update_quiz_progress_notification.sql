-- Fix: only update the single most recent notification for this student+quiz
-- Previously it updated ALL matching rows, causing stale notifications to reappear as unread
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
  WHERE id = (
    SELECT id FROM public.notifications
    WHERE quiz_id      = _quiz_id
      AND from_user_id = _student_id
      AND type         = 'quiz_completed'
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_progress_notification(UUID, UUID, TEXT) TO authenticated;
