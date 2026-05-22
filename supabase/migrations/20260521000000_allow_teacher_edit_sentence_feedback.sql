-- Allow teachers to update AI feedback and model answer for student sentence making answers.
-- Teachers identify via quiz ownership (q.teacher_id = auth.uid()).
CREATE POLICY "Teachers can update sentence making answer feedback"
ON public.sentence_making_answers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = sentence_making_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = sentence_making_answers.quiz_id
    AND q.teacher_id = auth.uid()
  )
);
