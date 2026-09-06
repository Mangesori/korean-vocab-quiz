create or replace view public.quiz_copy_counts as
select copied_from_quiz_id as quiz_id, count(*)::int as copy_count
from public.quizzes
where copied_from_quiz_id is not null
group by copied_from_quiz_id;

create or replace view public.sentence_bank_word_stats as
select word, level, count(*)::int as sentence_count
from public.sentence_bank
group by word, level;

create or replace view public.admin_teacher_stats as
select
  p.user_id,
  p.name,
  p.created_at,
  (select count(*) from public.classes c where c.teacher_id = p.user_id and c.archived_at is null)::int as class_count,
  (select count(*) from public.quizzes q where q.teacher_id = p.user_id)::int as quiz_count,
  (select count(distinct cm.student_id)
     from public.class_members cm
     join public.classes c on c.id = cm.class_id
    where c.teacher_id = p.user_id)::int as student_count,
  (select max(r.completed_at)
     from public.quiz_results r
     join public.quizzes q on q.id = r.quiz_id
    where q.teacher_id = p.user_id) as last_active_at
from public.profiles p
where p.role = 'teacher';

create or replace function public.get_admin_signals()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'total_quizzes',      (select count(*) from quizzes),
    'zero_submission',    (select count(*) from quizzes q
                            where not exists (select 1 from quiz_results r where r.quiz_id = q.id)),
    'total_teachers',     (select count(*) from profiles where role = 'teacher'),
    'idle_teachers',      (select count(*) from profiles p
                            where p.role = 'teacher'
                              and not exists (select 1 from quizzes q where q.teacher_id = p.user_id)),
    'total_students',     (select count(*) from profiles where role = 'student'),
    'active_students_30', (select count(distinct r.student_id) from quiz_results r
                            where r.completed_at > now() - interval '30 days')
  );
$$;
