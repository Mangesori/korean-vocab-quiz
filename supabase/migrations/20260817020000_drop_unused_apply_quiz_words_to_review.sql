-- apply_quiz_words_to_review는 seed_review_schedule(20260808010000)과 목적이
-- 완전히 겹쳤고, 이미 진행 중인 단어의 stage/due_at을 함부로 건드리는 설계
-- 차이도 있어 seed_review_schedule 하나로 통일한다. 클라이언트 연동
-- (QuizResult.tsx)도 함께 제거했다. _apply_srs_word_result/update_wa_progress는
-- 오답노트 연습(WrongAnswerPractice.tsx)이 계속 쓰므로 그대로 둔다.
DROP FUNCTION IF EXISTS public.apply_quiz_words_to_review(uuid, jsonb);

ALTER TABLE public.quiz_results DROP COLUMN IF EXISTS srs_applied_at;
