-- quizzes.source — 문제 내용이 어디서 왔는지.
--
-- 왜 필요한가:
--   generate-quiz(AI 생성), QuizImport(선생님이 문장 붙여넣기), 문장 은행에서
--   조립하는 두 화면(VocabPracticeQuizCreate·WrongAnswerQuizCreate)이 전부
--   같은 quizzes 테이블에 같은 모양으로 저장된다. 구분할 컬럼이 없어서,
--   생성 프롬프트(DIFFICULTY_GUIDES·A1 어휘 목록)의 등급 통제 효과를 측정할 때
--   그 프롬프트를 아예 거치지 않은 문제까지 같은 모집단으로 섞여 들어갔다
--   (실측 사례: "서울대 1B-1과 part 1"이라는 가져오기 퀴즈의 문장이 AI 등급
--   위반으로 오판됨).
--
-- 'ai_generated' = generate-quiz Edge Function 산출물(QuizPreview에서 저장)
-- 'imported'     = 사람이 붙여넣거나 문장 은행에서 조립한 것
--                  (QuizImport, VocabPracticeQuizCreate, WrongAnswerQuizCreate)
--
-- 기존 행은 NULL(미분류)로 둔다 — 소급 분류할 근거가 없다. 측정 스크립트는
-- NULL을 별도 집계하거나 제외해야 한다.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS source text
    CHECK (source IN ('ai_generated', 'imported'));

COMMENT ON COLUMN public.quizzes.source IS
  '문제 출처. ai_generated=generate-quiz 산출물, imported=사람이 붙여넣거나 문장은행에서 조립. '
  'NULL=이 컬럼 도입 전에 만들어져 미분류.';
