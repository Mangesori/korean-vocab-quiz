-- 말하기 답안에 CLOVA가 실제 인식한 문장(전사문)을 저장하기 위한 컬럼 추가
ALTER TABLE public.recording_answers ADD COLUMN IF NOT EXISTS recognized_text TEXT;
