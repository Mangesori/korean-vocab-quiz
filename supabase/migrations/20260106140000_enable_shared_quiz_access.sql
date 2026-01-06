-- Enable RLS on quiz_shares (just in case)
alter table "public"."quiz_shares" enable row level security;

-- Policy to allow public to view quiz shares (requires knowing the token effectively)
drop policy if exists "Public can view quiz shares" on "public"."quiz_shares";
create policy "Public can view quiz shares"
on "public"."quiz_shares"
for select
to public
using ( true );

-- Policy to allow public to increment view count
drop policy if exists "Public can update quiz shares view count" on "public"."quiz_shares";
create policy "Public can update quiz shares view count"
on "public"."quiz_shares"
for update
to public
using ( true )
with check ( true );

-- Enable RLS on quizzes (just in case)
alter table "public"."quizzes" enable row level security;

-- Policy to allow public to view quizzes that have a share record
drop policy if exists "Public can view shared quizzes" on "public"."quizzes";
create policy "Public can view shared quizzes"
on "public"."quizzes"
for select
to public
using (
  exists (
    select 1 from quiz_shares
    where quiz_shares.quiz_id = quizzes.id
  )
);

-- Enable RLS on profiles (just in case)
alter table "public"."profiles" enable row level security;

-- Policy to allow public to view profiles (needed for teacher name)
drop policy if exists "Public can view profiles" on "public"."profiles";
create policy "Public can view profiles"
on "public"."profiles"
for select
to public
using ( true );
