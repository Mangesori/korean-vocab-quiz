-- Change demo quiz second speaking problem from listen → read (보고 말하기)
UPDATE public.recording_problems
SET mode = 'read', sentence_audio_url = NULL
WHERE quiz_id = 'f879fc3d-4d30-4559-ad1b-8e2ea71c29ef'
  AND problem_id = 'demo-p1';
