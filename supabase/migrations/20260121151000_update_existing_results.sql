-- 기존 퀴즈 결과(quiz_results)를 소급 적용하여 수정하는 마이그레이션
-- answers JSON 배열의 각 항목에 대해:
-- 1. 'answer' 키를 'userAnswer'로 변경
-- 2. quizzes 테이블에서 해당 문제의 sentence, translation, correctAnswer, audioUrl 정보를 가져와 추가

DO $$
DECLARE
  r RECORD;
  q_problems JSONB;
  new_answers JSONB;
  old_answer JSONB;
  problem_info JSONB;
  p_id TEXT;
  user_ans TEXT;
  correct_ans TEXT;
BEGIN
  -- 모든 퀴즈 결과 순회
  FOR r IN SELECT * FROM quiz_results LOOP
    -- 해당 퀴즈의 전체 문제 목록 가져오기
    SELECT problems INTO q_problems FROM quizzes WHERE id = r.quiz_id;
    
    IF q_problems IS NOT NULL THEN
      new_answers := '[]'::jsonb;
      
      -- 기존 결과의 각 답안 순회
      FOR old_answer IN SELECT * FROM jsonb_array_elements(r.answers) LOOP
         p_id := old_answer->>'problemId';
         user_ans := old_answer->>'answer'; -- 기존 키는 'answer'였음
         
         -- userAnswer가 없고 user_answer가 있다면 매핑, 이미 있다면 그대로 사용 (재실행 안전성)
         IF user_ans IS NULL AND old_answer ? 'userAnswer' THEN
            user_ans := old_answer->>'userAnswer';
         END IF;

         -- 퀴즈 문제 목록에서 해당 문제 정보 찾기
         SELECT item INTO problem_info 
         FROM jsonb_array_elements(q_problems) AS item 
         WHERE item->>'id' = p_id;
         
         IF problem_info IS NOT NULL THEN
           correct_ans := problem_info->>'answer';
           
           new_answers := new_answers || jsonb_build_object(
             'problemId', p_id,
             'userAnswer', user_ans,
             'correctAnswer', correct_ans,
             'isCorrect', old_answer->'isCorrect', -- 기존 채점 결과 유지
             'sentence', COALESCE(problem_info->>'sentence', '문제 내용 없음'),
             'translation', COALESCE(problem_info->>'translation', ''),
             'audioUrl', problem_info->>'sentence_audio_url'
           );
         ELSE
            -- 문제 정보를 찾을 수 없는 경우 기존 데이터 유지 (최소한의 변환)
            new_answers := new_answers || jsonb_build_object(
             'problemId', p_id,
             'userAnswer', user_ans,
             'correctAnswer', '',
             'isCorrect', old_answer->'isCorrect',
             'sentence', '삭제된 문제',
             'translation', '',
             'audioUrl', null
            );
         END IF;
      END LOOP;
      
      -- 업데이트 실행
      UPDATE quiz_results SET answers = new_answers WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
