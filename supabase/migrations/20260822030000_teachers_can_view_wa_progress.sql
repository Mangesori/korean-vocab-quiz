-- wrong_answer_progress의 기존 정책("Students manage own wa progress")은
-- student_id = auth.uid()만 허용해서, 선생님이 오답 화면에서 자기 학생들의
-- mastered_at을 조회하면 RLS에 막혀 항상 빈 결과를 받는다.
-- 담당 학생 것만 볼 수 있도록 SELECT 전용 정책을 추가한다(허용적 정책이라 기존
-- 학생 본인 정책과 OR로 합쳐지며, 학생의 쓰기 권한에는 영향이 없다).
CREATE POLICY "Teachers can view their students' wa progress"
  ON public.wrong_answer_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.student_id = wrong_answer_progress.student_id AND c.teacher_id = auth.uid()
    )
  );
