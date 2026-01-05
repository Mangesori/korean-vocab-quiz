-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

-- Create enum for quiz difficulty levels
CREATE TYPE public.difficulty_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- Create enum for supported languages
CREATE TYPE public.translation_language AS ENUM (
  'en', 'zh_CN', 'zh_TW', 'ja', 'vi', 'th', 'id', 'es', 'fr', 'de', 'ru'
);

-- Create enum for notification types
CREATE TYPE public.notification_type AS ENUM ('quiz_assigned', 'quiz_completed');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create class_members table
CREATE TABLE public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  words TEXT[] NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'A1',
  words_per_set INTEGER NOT NULL DEFAULT 5,
  timer_enabled BOOLEAN NOT NULL DEFAULT false,
  timer_seconds INTEGER,
  translation_language translation_language NOT NULL DEFAULT 'en',
  problems JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create quiz_assignments table
CREATE TABLE public.quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT must_have_class_or_student CHECK (class_id IS NOT NULL OR student_id IS NOT NULL)
);

-- Create quiz_results table
CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create function to generate invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view student profiles in their classes"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.student_id = profiles.user_id
        AND c.teacher_id = auth.uid()
    )
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for classes
CREATE POLICY "Teachers can view their own classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can view classes they are members of"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members
      WHERE class_id = classes.id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view class by invite code"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can create classes"
  ON public.classes FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their own classes"
  ON public.classes FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
  ON public.classes FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- RLS Policies for class_members
CREATE POLICY "Teachers can view members of their classes"
  ON public.class_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = class_members.class_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own memberships"
  ON public.class_members FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can join classes"
  ON public.class_members FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(), 'student'));

CREATE POLICY "Students can leave classes"
  ON public.class_members FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- RLS Policies for quizzes
CREATE POLICY "Teachers can view their own quizzes"
  ON public.quizzes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can view assigned quizzes"
  ON public.quizzes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_assignments qa
      LEFT JOIN public.class_members cm ON cm.class_id = qa.class_id
      WHERE qa.quiz_id = quizzes.id
        AND (qa.student_id = auth.uid() OR cm.student_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can create quizzes"
  ON public.quizzes FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their own quizzes"
  ON public.quizzes FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own quizzes"
  ON public.quizzes FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- RLS Policies for quiz_assignments
CREATE POLICY "Teachers can view assignments for their quizzes"
  ON public.quiz_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_assignments.quiz_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their assignments"
  ON public.quiz_assignments FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.class_members
      WHERE class_id = quiz_assignments.class_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create assignments"
  ON public.quiz_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete assignments"
  ON public.quiz_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_assignments.quiz_id AND teacher_id = auth.uid()
    )
  );

-- RLS Policies for quiz_results
CREATE POLICY "Students can view their own results"
  ON public.quiz_results FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view results for their quizzes"
  ON public.quiz_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_results.quiz_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert their own results"
  ON public.quiz_results FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;