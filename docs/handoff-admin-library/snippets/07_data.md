# 07 — 데이터 / 쿼리 / 마이그레이션

시안이 보여주는 값 중 현재 스키마로 바로 얻을 수 없는 것들.

## 신규 컬럼 / 뷰

### 1. 라이브러리 복사 횟수

`2a`의 "복사 4회" 배지와 "복사 많은 순" 정렬에 필요.

```sql
-- 이미 copied_from_quiz_id가 있으면 집계 뷰로 충분
create or replace view public.quiz_copy_counts as
select copied_from_quiz_id as quiz_id, count(*)::int as copy_count
from public.quizzes
where copied_from_quiz_id is not null
group by copied_from_quiz_id;
```

컬럼이 없다면 `quizzes.copied_from_quiz_id uuid references quizzes(id)` 추가 후, 복사 로직에서 채운다.

### 2. 문장 은행 출처 퀴즈

`4b`의 "퀴즈 · {퀴즈 제목}" 표기와 링크에 필요.

```sql
alter table public.sentence_bank
  add column origin_quiz_id uuid references public.quizzes(id) on delete set null;
```

`upsert_sentence_bank`에서 퀴즈 생성 경로일 때 채운다. 기존 행은 null → 표기는 `batch_label` 또는 생성일로 폴백.

`batch_label`에 실제로 어떤 값이 들어가는지 확인 필요 (시안은 `8/15 배치`로 가정).

### 3. 단어별 문장 수

`4b`의 "문장 1개뿐" 배지와 필터, 커버리지 스트립에 필요.

```sql
create or replace view public.sentence_bank_word_stats as
select word, level, count(*)::int as sentence_count
from public.sentence_bank
group by word, level;
```

`get_sentence_bank_coverage`가 이미 비슷한 일을 하고 있으므로, 기준(문장 2개 이상)을 그 RPC와 일치시킬 것.

### 4. 선생님 활동 집계

`4a` 목록의 마지막 활동 / 클래스·퀴즈·학생 수.

```sql
create or replace view public.admin_teacher_stats as
select
  p.id,
  p.name,
  p.email,
  p.created_at,
  (select count(*) from classes c where c.teacher_id = p.id and c.archived_at is null)::int as class_count,
  (select count(*) from quizzes q where q.teacher_id = p.id)::int as quiz_count,
  (select count(distinct e.student_id)
     from class_enrollments e
     join classes c on c.id = e.class_id
    where c.teacher_id = p.id)::int as student_count,
  greatest(
    (select max(q.created_at) from quizzes q where q.teacher_id = p.id),
    (select max(c.created_at) from classes c where c.teacher_id = p.id)
  ) as last_active_at
from profiles p
where p.role = 'teacher';
```

`last_active_at`을 무엇으로 정의할지 결정 필요 — 퀴즈/클래스 생성만으로 볼지, 로그인(`auth.users.last_sign_in_at`)까지 포함할지. 시안의 "휴면"은 `quiz_count = 0` 기준이다.

### 5. 선생님 권한 신청 + 판단 근거

`4a` 신청 줄에 필요.

```sql
create or replace view public.admin_teacher_applications as
select
  a.id,
  a.user_id,
  p.name,
  p.email,
  a.created_at as applied_at,
  p.created_at,
  (select count(*) from submissions s where s.student_id = p.id)::int as submission_count
from teacher_applications a
join profiles p on p.id = a.user_id
where a.status = 'pending'
order by a.created_at desc;
```

### 6. 대시보드 신호

`5a`의 4개 신호.

```sql
create or replace function public.get_admin_signals()
returns json language sql security definer as $$
  select json_build_object(
    'total_quizzes',     (select count(*) from quizzes),
    'zero_submission',   (select count(*) from quizzes q
                           where not exists (select 1 from submissions s where s.quiz_id = q.id)),
    'total_teachers',    (select count(*) from profiles where role = 'teacher'),
    'idle_teachers',     (select count(*) from profiles p
                           where p.role = 'teacher'
                             and not exists (select 1 from quizzes q where q.teacher_id = p.id)),
    'total_students',    (select count(*) from profiles where role = 'student'),
    'active_students_30',(select count(distinct s.student_id) from submissions s
                           where s.created_at > now() - interval '30 days')
  );
$$;
```

## 라이브러리 검색

`2a`는 단어까지 검색하고 **어떤 단어가 걸렸는지** 표시한다. 제목 `ilike`만으로는 부족하다.

```sql
create or replace function public.search_shared_quizzes(
  p_query text,
  p_levels text[] default null,
  p_stages text[] default null,
  p_sort text default 'recent'
)
returns table (
  quiz_id uuid,
  title text,
  level text,
  teacher_name text,
  word_count int,
  copy_count int,
  created_at timestamptz,
  matched_words text[],      -- 행에 표시할 걸린 단어
  title_matched boolean
) language sql stable as $$
  -- 제목 일치 + 문제 단어 일치를 union 하고, 단어 일치는 array_agg로 모아 반환
$$;
```

자동완성은 별도 RPC가 낫다 (단어/제목을 구분해 kind와 함께 반환):

```sql
create or replace function public.suggest_library_terms(p_prefix text, p_limit int default 6)
returns table (kind text, label text, count int) language sql stable as $$
  -- kind='word'  : 문제 단어에서 prefix 일치, 해당 단어를 포함한 공개 퀴즈 수
  -- kind='title' : 공개 퀴즈 제목에서 prefix 일치
$$;
```

## 대시보드에서 이관되는 쿼리

`AdminDashboard.tsx`의 전체 사용자 조회(`profiles` 전체 select)는 `AdminUsers.tsx`로 옮기고, **서버 페이지네이션**으로 바꾼다. 대시보드는 최근 가입 5명만 받는다:

```ts
supabase.from('profiles')
  .select('id, name, role, created_at')
  .order('created_at', { ascending: false })
  .limit(5);
```

## 피드백 읽지 않은 건

`5a` 큐와 사이드바 배지에 필요. `feedback` 테이범에 읽음 표시 컨럼이 없으면 추가한다:

```sql
alter table public.feedback
  add column read_at timestamptz;
```

현재 피드백 탭이 상태를 어떻게 다룬는지 확인 후 재사용할 것 — 이번 개편 대상은 아니지만 대시보드 큐가 이 값을 읽는다. 없으면 큐에서 피드백 항목을 생략하고 진행한다.

## 값이 없을 때의 폴백 정리

2단계 UI 작업 중 아래 값을 바로 얼지 못하면, **임시 값을 하드코딩하지 말고 그 요소를 생략한다.**

| 시안 요소 | 필요 값 | 없을 때 |
|---|---|---|
| 라이브러리 "복사 4회" 배지 | `quiz_copy_counts` | 배지 생략, 정렬 옵션도 제거 |
| "검색어 포함 단어" 표시 | `search_shared_quizzes` | 제목 검색만 유지, 단어 칩 생략 |
| 검색어 자동완성 | `suggest_library_terms` | 일반 입력창으로 남김 |
| 문장 은행 "문장 1개뿐" 배지/필터 | `sentence_bank_word_stats` | 배지·필터 생략 |
| 은행 행의 퀴즈 제목 | `origin_quiz_id` | `batch_label` 또는 생성일로 폴백 |
| 선생님 "마지막 활동" 열 | `admin_teacher_stats` | 가입일 역으로 유지 (정렬도 가입일) |
| 승인 대기 판단 근거 | `admin_teacher_applications` | 이름·이메일·신잭일만 |
| 대시보드 신호 4개 | `get_admin_signals` | 얼을 수 있는 항목만 표시 |

## 기존 버그

`pct()` 미사용으로 분모 0에서 `Infinity%`가 표시되는 곳이 있다 (클래스 통계). snippets/01의 `pct()`로 통일할 것.
