alter table public.quizzes add column is_public boolean not null default false;
alter table public.quizzes add column copied_from_quiz_id uuid references public.quizzes(id) on delete set null;

create policy "Teachers can view public quizzes"
  on public.quizzes for select
  to authenticated
  using (is_public = true);
