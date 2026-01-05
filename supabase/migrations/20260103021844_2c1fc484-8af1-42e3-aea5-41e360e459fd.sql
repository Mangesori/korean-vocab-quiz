-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Students can view assigned quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Teachers can view assignments for their quizzes" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Teachers can delete assignments" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Students can view classes they are members of" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view members of their classes" ON public.class_members;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_quiz_owner(_quiz_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quizzes
    WHERE id = _quiz_id
      AND teacher_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = _class_id
      AND teacher_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members
    WHERE class_id = _class_id
      AND student_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_quiz_assigned_to_student(_quiz_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    LEFT JOIN public.class_members cm ON cm.class_id = qa.class_id
    WHERE qa.quiz_id = _quiz_id
      AND (qa.student_id = _user_id OR cm.student_id = _user_id)
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Students can view assigned quizzes" 
ON public.quizzes 
FOR SELECT 
USING (public.is_quiz_assigned_to_student(id, auth.uid()));

CREATE POLICY "Teachers can view assignments for their quizzes" 
ON public.quiz_assignments 
FOR SELECT 
USING (public.is_quiz_owner(quiz_id, auth.uid()));

CREATE POLICY "Teachers can create assignments" 
ON public.quiz_assignments 
FOR INSERT 
WITH CHECK (public.is_quiz_owner(quiz_id, auth.uid()));

CREATE POLICY "Teachers can delete assignments" 
ON public.quiz_assignments 
FOR DELETE 
USING (public.is_quiz_owner(quiz_id, auth.uid()));

CREATE POLICY "Students can view classes they are members of" 
ON public.classes 
FOR SELECT 
USING (public.is_class_member(id, auth.uid()));

CREATE POLICY "Teachers can view members of their classes" 
ON public.class_members 
FOR SELECT 
USING (public.is_class_teacher(class_id, auth.uid()));