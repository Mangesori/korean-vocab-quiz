-- 라이브 세션 (실시간 수업)
--
-- 기존 quiz_shares(공유 링크)와는 별개다. 공유 링크는 학생이 아무 때나 혼자 푸는
-- 숙제용이고, 라이브 세션은 선생님이 열어야 시작되고 수업이 끝나면 닫히는 방이다.
-- 그래서 참여 코드도 nanoid(12)가 아니라 수업 중에 부르고 칠 수 있는 6자리 숫자다.
--
-- 풀이 중 진행 상황은 이 테이블에 쌓지 않는다. Realtime broadcast로만 흘려보내고
-- (초당 여러 번 발생), 최종 결과만 기존 quiz_results에 저장한다.

-- ── 세션 ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id     uuid REFERENCES public.classes(id) ON DELETE SET NULL,

  -- 수업 중 부르고 입력하는 6자리 코드. 열려 있는 세션 안에서만 유일하면 된다.
  join_code    text NOT NULL CHECK (join_code ~ '^[0-9]{6}$'),

  status       text NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'active', 'ended')),

  -- 준비 화면에서 고른 것들
  stages       text[] NOT NULL DEFAULT ARRAY['fill_blank']::text[],
  settings     jsonb  NOT NULL DEFAULT '{
                   "watchScreens": true,
                   "shareBoard": false,
                   "anonymize": false,
                   "shuffle": false,
                   "allowGuests": true
                 }'::jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  ended_at     timestamptz
);

-- 말하기 연습은 라이브에서 쓰지 않는다 (동시 녹음 충돌 + 즉시 채점 불가).
-- 빈 배열 검사에 array_length를 쓰면 안 된다 — 빈 배열에 대해 0이 아니라 NULL을
-- 돌려주고, CHECK는 NULL을 통과시키므로 빈 stages가 그대로 들어간다.
-- 중간에 실패해도 다시 돌릴 수 있게 제약을 먼저 떨어뜨린다.
ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_stages_exclude_recording;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_stages_exclude_recording
  CHECK (NOT ('recording' = ANY(stages)) AND cardinality(stages) >= 1);

-- 살아 있는 세션끼리는 코드가 겹치면 안 된다. 끝난 세션의 코드는 재사용 가능.
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_active_join_code_idx
  ON public.live_sessions (join_code)
  WHERE status <> 'ended';

CREATE INDEX IF NOT EXISTS live_sessions_teacher_idx
  ON public.live_sessions (teacher_id, created_at DESC);

-- ── 참가자 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,

  -- 로그인 학생이면 student_id가 차고, 비회원이면 NULL + display_name만 있다.
  student_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  is_guest     boolean NOT NULL DEFAULT false,

  joined_at    timestamptz NOT NULL DEFAULT now(),
  left_at      timestamptz,

  CONSTRAINT live_participants_guest_shape
    CHECK ((is_guest AND student_id IS NULL) OR (NOT is_guest AND student_id IS NOT NULL))
);

-- 같은 학생이 새로고침해도 한 줄만 유지되게.
CREATE UNIQUE INDEX IF NOT EXISTS live_participants_session_student_idx
  ON public.live_participants (session_id, student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS live_participants_session_idx
  ON public.live_participants (session_id, joined_at);

-- ── 6자리 코드 발급 ─────────────────────────────────────────────────────────
-- 살아 있는 세션과 겹치지 않는 코드를 뽑는다. 100만 개 중 동시에 열려 있는
-- 세션은 아주 적으므로 몇 번이면 반드시 빈 코드를 찾는다.
CREATE OR REPLACE FUNCTION public.generate_live_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries     int := 0;
BEGIN
  LOOP
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.live_sessions
      WHERE join_code = candidate AND status <> 'ended'
    );
    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION '참여 코드를 발급하지 못했습니다. 잠시 후 다시 시도해주세요.';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- ── 참여 코드로 세션 찾기 ───────────────────────────────────────────────────
-- 비회원도 호출해야 하므로 SECURITY DEFINER로 열되, 입장에 필요한 최소 정보만
-- 돌려준다. 코드가 틀리거나 이미 끝난 세션이면 빈 결과.
CREATE OR REPLACE FUNCTION public.find_live_session_by_code(p_code text)
RETURNS TABLE (
  id            uuid,
  quiz_id       uuid,
  quiz_title    text,
  status        text,
  allow_guests  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         s.quiz_id,
         q.title,
         s.status,
         COALESCE((s.settings ->> 'allowGuests')::boolean, true)
  FROM public.live_sessions s
  JOIN public.quizzes q ON q.id = s.quiz_id
  WHERE s.join_code = p_code
    AND s.status <> 'ended'
  LIMIT 1;
$$;

-- ── 게스트 입장 ─────────────────────────────────────────────────────────────
-- 비회원은 auth.uid()가 없어서 INSERT 정책을 통과할 수 없다. 그래서 입장만
-- SECURITY DEFINER 함수로 뚫어주되, 코드가 맞는지 · 세션이 살아 있는지 ·
-- allowGuests가 켜져 있는지를 서버에서 직접 확인한 뒤에만 넣는다.
CREATE OR REPLACE FUNCTION public.join_live_session_as_guest(p_code text, p_name text)
RETURNS public.live_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.live_sessions;
  v_row     public.live_participants;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION '이름을 입력해주세요.';
  END IF;

  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE join_code = p_code AND status <> 'ended';

  IF NOT FOUND THEN
    RAISE EXCEPTION '코드를 다시 확인해주세요.';
  END IF;

  IF NOT COALESCE((v_session.settings ->> 'allowGuests')::boolean, true) THEN
    RAISE EXCEPTION '이 수업은 로그인한 학생만 참여할 수 있어요.';
  END IF;

  INSERT INTO public.live_participants (session_id, student_id, display_name, is_guest)
  VALUES (v_session.id, NULL, btrim(p_name), true)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── RLS 도우미 ──────────────────────────────────────────────────────────────
-- live_participants의 정책 안에서 다시 live_participants를 조회하면 Postgres가
-- 정책을 무한 재귀로 평가해 "infinite recursion detected in policy" 오류가 난다.
-- SECURITY DEFINER 함수는 RLS를 우회하므로 이 고리를 끊어준다.
CREATE OR REPLACE FUNCTION public.is_live_participant(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_participants
    WHERE session_id = p_session_id
      AND student_id = auth.uid()
      AND left_at IS NULL
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;

-- 세션: 만든 선생님이 전권을 갖는다.
DROP POLICY IF EXISTS "선생님은 자기 세션을 관리한다" ON public.live_sessions;
CREATE POLICY "선생님은 자기 세션을 관리한다"
  ON public.live_sessions
  FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- 세션: 참가자는 자기가 들어간 세션을 읽을 수 있다.
DROP POLICY IF EXISTS "참가자는 자기 세션을 읽는다" ON public.live_sessions;
CREATE POLICY "참가자는 자기 세션을 읽는다"
  ON public.live_sessions
  FOR SELECT
  USING (public.is_live_participant(id));

-- 참가자: 선생님은 자기 세션의 참가자를 모두 본다.
DROP POLICY IF EXISTS "선생님은 자기 세션 참가자를 관리한다" ON public.live_participants;
CREATE POLICY "선생님은 자기 세션 참가자를 관리한다"
  ON public.live_participants
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = live_participants.session_id
      AND s.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = live_participants.session_id
      AND s.teacher_id = auth.uid()
  ));

-- 참가자: 로그인 학생은 아직 안 끝난 세션에 자기 이름으로 입장한다.
DROP POLICY IF EXISTS "학생은 열린 세션에 입장한다" ON public.live_participants;
CREATE POLICY "학생은 열린 세션에 입장한다"
  ON public.live_participants
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND is_guest = false
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE s.id = session_id AND s.status <> 'ended'
    )
  );

-- 참가자: 같은 세션에 있는 사람끼리는 서로 보인다 (대기실 명단).
-- 재귀를 피하려고 SECURITY DEFINER 도우미를 쓴다 (위 주석 참고).
DROP POLICY IF EXISTS "같은 세션 참가자끼리 보인다" ON public.live_participants;
CREATE POLICY "같은 세션 참가자끼리 보인다"
  ON public.live_participants
  FOR SELECT
  USING (public.is_live_participant(session_id));

-- 참가자: 자기 줄만 수정(퇴장 표시)할 수 있다.
DROP POLICY IF EXISTS "학생은 자기 참가 기록만 수정한다" ON public.live_participants;
CREATE POLICY "학생은 자기 참가 기록만 수정한다"
  ON public.live_participants
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────
-- 대기실 명단과 세션 상태(waiting → active → ended)는 DB 변경으로 전파한다.
-- 풀이 중 진행 상황은 broadcast로만 흐르고 여기 들어오지 않는다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_participants;
  END IF;
END $$;
