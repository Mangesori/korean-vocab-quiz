-- 오답 복습/어휘 보강 퀴즈를 제목 문자열이 아니라 이 컬럼으로 식별한다.
-- 지금까지는 VocabPracticeQuizCreate.tsx가 ilike('quizzes.title', '%어휘 보강%')로
-- "이미 보낸 단어"를 찾았는데, 6단계에서 제목을 자유 입력으로 열면 제목을 바꾸는 순간
-- 이 필터가 깨져 같은 단어가 반복 출제된다.
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS kind text;
