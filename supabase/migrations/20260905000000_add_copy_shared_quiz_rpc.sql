-- 퀴즈 라이브러리 복사 버그 수정: handleCopy가 클라이언트에서 자식 테이블을
-- 직접 SELECT하려 했지만, 각 테이블의 RLS 정책이 "퀴즈 소유 선생님만" 허용해서
-- 공개 퀴즈를 복사하는 다른 선생님에게는 항상 빈 배열이 돌아왔다(빈칸 채우기 외
-- 나머지 유형이 전부 0문제로 복사되는 버그). SECURITY DEFINER 함수로 서버에서
-- 한 번에 복사해 RLS를 우회한다.
create or replace function public.copy_shared_quiz(_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_quiz_id uuid;
  _teacher_id uuid := auth.uid();
begin
  if _teacher_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.quizzes where id = _quiz_id and is_public = true) then
    raise exception '공개된 퀴즈만 복사할 수 있습니다';
  end if;

  insert into public.quizzes (
    teacher_id, title, words, difficulty, translation_language, words_per_set,
    timer_enabled, timer_seconds, problems, source, api_provider, kind,
    fill_blank_enabled, sentence_making_enabled, recording_enabled,
    matchup_enabled, type_answer_enabled, word_magnet_enabled,
    is_public, copied_from_quiz_id
  )
  select
    _teacher_id, title, words, difficulty, translation_language, words_per_set,
    timer_enabled, timer_seconds, problems, source, api_provider, kind,
    fill_blank_enabled, sentence_making_enabled, recording_enabled,
    matchup_enabled, type_answer_enabled, word_magnet_enabled,
    false, id
  from public.quizzes
  where id = _quiz_id
  returning id into _new_quiz_id;

  insert into public.quiz_problems (quiz_id, problem_id, word, sentence, hint, hint_audio_url, sentence_audio_url, translation)
  select _new_quiz_id, problem_id, word, sentence, hint, hint_audio_url, sentence_audio_url, translation
  from public.quiz_problems where quiz_id = _quiz_id;

  insert into public.quiz_answers (quiz_id, problem_id, word, correct_answer)
  select _new_quiz_id, problem_id, word, correct_answer
  from public.quiz_answers where quiz_id = _quiz_id;

  insert into public.matchup_problems (quiz_id, problem_id, korean_text, meaning_text, sort_order)
  select _new_quiz_id, problem_id, korean_text, meaning_text, sort_order
  from public.matchup_problems where quiz_id = _quiz_id;

  insert into public.type_answer_problems (quiz_id, problem_id, prompt, answer, sort_order)
  select _new_quiz_id, problem_id, prompt, answer, sort_order
  from public.type_answer_problems where quiz_id = _quiz_id;

  insert into public.word_magnet_problems (quiz_id, problem_id, base_text, items, translation, sort_order)
  select _new_quiz_id, problem_id, base_text, items, translation, sort_order
  from public.word_magnet_problems where quiz_id = _quiz_id;

  insert into public.sentence_making_problems (quiz_id, problem_id, word, word_meaning, model_answer, grading_criteria, sort_order)
  select _new_quiz_id, problem_id, word, word_meaning, model_answer, grading_criteria, sort_order
  from public.sentence_making_problems where quiz_id = _quiz_id;

  insert into public.recording_problems (quiz_id, problem_id, sentence, mode, translation, source_type, source_problem_id, label, sentence_audio_url)
  select _new_quiz_id, problem_id, sentence, mode, translation, source_type, source_problem_id, label, sentence_audio_url
  from public.recording_problems where quiz_id = _quiz_id;

  return _new_quiz_id;
end;
$$;

grant execute on function public.copy_shared_quiz(uuid) to authenticated;
