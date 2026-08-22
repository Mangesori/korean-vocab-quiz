-- 선생님 대시보드 "확인할 결과" 히어로용 — 선생님이 결과 화면을 연 시점을 기록한다.
-- null이면 아직 아무도 확인하지 않은 제출.
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- 기존에는 quiz_results에 UPDATE 정책이 없었다(학생은 제출 시 INSERT만).
-- 선생님이 자기 퀴즈의 결과를 열 때 viewed_at을 채울 수 있어야 한다.
CREATE POLICY "Teachers can mark results as viewed"
  ON public.quiz_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_results.quiz_id AND teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_results.quiz_id AND teacher_id = auth.uid()
    )
  );
