-- 1. 선생님이 자신의 클래스에서 학생을 삭제할 수 있는 정책 추가
CREATE POLICY "Teachers can remove students from their classes"
  ON public.class_members FOR DELETE
  TO authenticated
  USING (is_class_teacher(class_id, auth.uid()));

-- 2. 관리자가 모든 프로필을 볼 수 있는 정책 추가
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. 관리자가 모든 역할을 볼 수 있는 정책 추가
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. 관리자가 역할을 업데이트할 수 있는 정책 추가 (기존 false 정책 수정)
DROP POLICY IF EXISTS "Users cannot update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 5. 관리자가 모든 클래스를 볼 수 있는 정책 추가
CREATE POLICY "Admins can view all classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 6. 관리자가 모든 퀴즈를 볼 수 있는 정책 추가
CREATE POLICY "Admins can view all quizzes"
  ON public.quizzes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));