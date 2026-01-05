-- quiz_results 테이블에 UPDATE/DELETE 명시적 거부 정책 추가
CREATE POLICY "No one can update quiz results"
ON public.quiz_results
FOR UPDATE
USING (false);

CREATE POLICY "No one can delete quiz results"
ON public.quiz_results
FOR DELETE
USING (false);