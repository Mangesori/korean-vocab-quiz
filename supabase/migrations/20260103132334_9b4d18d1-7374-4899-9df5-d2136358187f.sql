-- 1. class_members 테이블에 명시적 UPDATE 거부 정책 추가
CREATE POLICY "No one can update class memberships"
ON public.class_members
FOR UPDATE
USING (false);

-- 2. 퀴즈 정답을 서버에서만 접근 가능하도록 별도 테이블 생성
CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  problem_id text NOT NULL,
  correct_answer text NOT NULL,
  word text NOT NULL,
  UNIQUE (quiz_id, problem_id)
);

-- quiz_answers 테이블 RLS 활성화 (아무도 직접 조회 불가)
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- 오직 교사만 자신의 퀴즈 정답 조회 가능
CREATE POLICY "Teachers can view their quiz answers"
ON public.quiz_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_answers.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- 교사만 정답 삽입 가능
CREATE POLICY "Teachers can insert quiz answers"
ON public.quiz_answers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_answers.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- 교사만 정답 삭제 가능
CREATE POLICY "Teachers can delete quiz answers"
ON public.quiz_answers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_answers.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- 3. 서버에서 퀴즈 점수를 계산하는 SECURITY DEFINER 함수 생성
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  _quiz_id uuid,
  _student_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _quiz_exists boolean;
  _is_assigned boolean;
  _score integer := 0;
  _total integer := 0;
  _answer_record record;
  _user_answer text;
  _result_id uuid;
  _answers_array jsonb := '[]'::jsonb;
BEGIN
  -- 현재 사용자 ID 확인
  _student_id := auth.uid();
  
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 학생 역할 확인
  IF NOT has_role(_student_id, 'student') THEN
    RAISE EXCEPTION 'Only students can submit quiz answers';
  END IF;
  
  -- 퀴즈 존재 확인
  SELECT EXISTS (SELECT 1 FROM quizzes WHERE id = _quiz_id) INTO _quiz_exists;
  IF NOT _quiz_exists THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  
  -- 퀴즈 할당 확인
  SELECT is_quiz_assigned_to_student(_quiz_id, _student_id) INTO _is_assigned;
  IF NOT _is_assigned THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;
  
  -- 각 정답과 비교하여 점수 계산
  FOR _answer_record IN 
    SELECT problem_id, correct_answer FROM quiz_answers WHERE quiz_id = _quiz_id
  LOOP
    _total := _total + 1;
    _user_answer := LOWER(TRIM(_student_answers->>_answer_record.problem_id));
    
    IF _user_answer = LOWER(TRIM(_answer_record.correct_answer)) THEN
      _score := _score + 1;
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _answer_record.problem_id,
        'answer', _student_answers->>_answer_record.problem_id,
        'isCorrect', true
      );
    ELSE
      _answers_array := _answers_array || jsonb_build_object(
        'problemId', _answer_record.problem_id,
        'answer', COALESCE(_student_answers->>_answer_record.problem_id, ''),
        'isCorrect', false
      );
    END IF;
  END LOOP;
  
  -- 결과 저장
  INSERT INTO quiz_results (quiz_id, student_id, score, total_questions, answers)
  VALUES (_quiz_id, _student_id, _score, _total, _answers_array)
  RETURNING id INTO _result_id;
  
  -- 교사에게 알림 전송
  INSERT INTO notifications (user_id, type, title, message, quiz_id, from_user_id)
  SELECT 
    q.teacher_id,
    'quiz_completed'::notification_type,
    '학생이 퀴즈를 완료했습니다!',
    q.title || ' 퀴즈 결과: ' || _score::text || '/' || _total::text || '점',
    _quiz_id,
    _student_id
  FROM quizzes q WHERE q.id = _quiz_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'result_id', _result_id,
    'score', _score,
    'total', _total
  );
END;
$$;

-- 4. 학생에게 퀴즈 문제만 반환하는 함수 (정답 제외)
CREATE OR REPLACE FUNCTION public.get_quiz_for_student(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _quiz_data jsonb;
  _problems jsonb;
  _sanitized_problems jsonb := '[]'::jsonb;
  _problem jsonb;
BEGIN
  _student_id := auth.uid();
  
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 퀴즈 할당 확인
  IF NOT is_quiz_assigned_to_student(_quiz_id, _student_id) THEN
    RAISE EXCEPTION 'Quiz not assigned to student';
  END IF;
  
  -- 퀴즈 데이터 가져오기
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'difficulty', difficulty,
    'timer_enabled', timer_enabled,
    'timer_seconds', timer_seconds,
    'words', words,
    'words_per_set', words_per_set,
    'translation_language', translation_language,
    'teacher_id', teacher_id,
    'problems', problems
  ) INTO _quiz_data
  FROM quizzes
  WHERE id = _quiz_id;
  
  IF _quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  
  -- 문제에서 정답(answer) 필드 제거
  _problems := _quiz_data->'problems';
  
  FOR _problem IN SELECT * FROM jsonb_array_elements(_problems)
  LOOP
    _sanitized_problems := _sanitized_problems || jsonb_build_object(
      'id', _problem->>'id',
      'word', _problem->>'word',
      'sentence', _problem->>'sentence',
      'hint', _problem->>'hint',
      'translation', _problem->>'translation'
    );
  END LOOP;
  
  RETURN jsonb_set(_quiz_data, '{problems}', _sanitized_problems);
END;
$$;