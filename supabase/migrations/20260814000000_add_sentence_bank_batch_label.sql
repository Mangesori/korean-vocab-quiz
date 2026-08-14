-- 문장 은행 배치 라벨 — "이번에 새로 추가한 단어들만" 골라 복습 퀴즈를 보내기 위함.
--
-- 왜 필요한가:
--   sentence_bank는 지금 100단어(초기분)에 이어 347단어(신규 TSV)가 추가로 들어올
--   예정인데, "어느 배치에서 들어왔는가"를 구분할 컬럼이 없다. source(import/quiz)는
--   출처(사람 검수 vs AI 자동수집) 구분일 뿐 배치 구분이 아니다.
--   VocabPracticeQuizCreate(어휘 보강 퀴즈 만들기)에서 선생님이 "이번에 새로 추가한
--   단어들만" 학생에게 복습 퀴즈로 보내려면 지금은 체크박스를 하나하나 눌러야 한다.
--
-- batch_label은 사람이 읽는 자유 텍스트다(예: "2026-08-14 신규 347단어"). NULL 허용
-- — 기존 행(100단어)은 라벨이 없어도 그대로 남는다. UNIQUE (word, level, sentence)
-- 정체성에는 포함하지 않는다 — 같은 문장이 다른 배치 라벨로 다시 들어와도 정체성은
-- 바뀌지 않고, 라벨만 최신 값으로 갱신된다(아래 upsert 참고).
ALTER TABLE public.sentence_bank
  ADD COLUMN IF NOT EXISTS batch_label text;

COMMENT ON COLUMN public.sentence_bank.batch_label IS
  '이 문장이 들어온 배치의 사람이 읽는 라벨(자유 텍스트). NULL이면 배치 구분 이전(초기 100단어) 행.';

-- 배치별 필터 드롭다운(관리 페이지, 어휘 보강 퀴즈 만들기)이 "이 레벨에 어떤 배치가
-- 있나"를 조회하는 패턴이라 (level, batch_label)에 인덱스를 둔다.
CREATE INDEX IF NOT EXISTS sentence_bank_batch_label_idx
  ON public.sentence_bank (batch_label)
  WHERE batch_label IS NOT NULL;

-- ── upsert_sentence_bank에 배치 라벨 파라미터 추가 ──────────────────
--
-- 기존 시그니처(_rows jsonb, _source text DEFAULT 'import') 뒤에
-- _batch_label text DEFAULT NULL을 추가한다. DEFAULT NULL이라 기존 호출부
-- (QuizPreview.tsx의 자동 수집 등)는 고치지 않아도 그대로 동작한다.
--
-- 먼저 옛 2-인자 함수를 지운다 — CREATE OR REPLACE는 이름은 같아도 인자 개수가
-- 다르면 "교체"가 아니라 "추가"로 취급해 옛 2-인자 함수가 그대로 남는다. 그러면
-- PostgREST가 2개짜리 인자로 호출할 때 두 함수(2-인자 원본 / 3-인자에서 세 번째가
-- DEFAULT) 사이에서 "함수가 유일하지 않다" 오류가 난다.
DROP FUNCTION IF EXISTS public.upsert_sentence_bank(jsonb, text);

CREATE OR REPLACE FUNCTION public.upsert_sentence_bank(
  _rows jsonb,
  _source text DEFAULT 'import',
  _batch_label text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN 0;
  END IF;

  IF _source NOT IN ('import', 'quiz') THEN
    RAISE EXCEPTION '알 수 없는 출처: %', _source;
  END IF;

  -- 검수 문장으로 등록하는 건 관리자만. AI 자동 수집은 누구나 가능하다.
  IF _source = 'import' AND NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  WITH incoming AS (
    SELECT DISTINCT ON (elem->>'word', elem->>'level', elem->>'sentence')
           elem->>'word'        AS word,
           NULLIF(elem->>'meaning','')     AS meaning,
           elem->>'level'       AS level,
           elem->>'sentence'    AS sentence,
           elem->>'answer'      AS answer,
           NULLIF(elem->>'hint','')        AS hint,
           NULLIF(elem->>'translation','') AS translation
      FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) elem
     WHERE COALESCE(elem->>'word','') <> ''
       AND COALESCE(elem->>'sentence','') <> ''
       AND COALESCE(elem->>'answer','') <> ''
       AND COALESCE(elem->>'level','') IN ('A1','A2','B1','B2','C1','C2')
  ),
  -- 새로 들어가는 문장에 붙일 번호. 그 단어·레벨의 기존 최대값 다음부터 이어 준다.
  numbered AS (
    SELECT i.*,
           COALESCE((SELECT max(b.seq) FROM public.sentence_bank b
                      WHERE b.word = i.word AND b.level = i.level), 0)
             + row_number() OVER (PARTITION BY i.word, i.level ORDER BY i.sentence) AS new_seq
      FROM incoming i
  ),
  ups AS (
    INSERT INTO public.sentence_bank
           (word, meaning, level, seq, sentence, answer, hint, translation, source, created_by, batch_label)
    SELECT n.word, n.meaning, n.level, n.new_seq::smallint,
           n.sentence, n.answer, n.hint, n.translation, _source, _uid, _batch_label
      FROM numbered n
    ON CONFLICT (word, level, sentence) DO UPDATE
      SET meaning     = COALESCE(EXCLUDED.meaning, public.sentence_bank.meaning),
          answer      = EXCLUDED.answer,
          hint        = COALESCE(EXCLUDED.hint, public.sentence_bank.hint),
          translation = COALESCE(EXCLUDED.translation, public.sentence_bank.translation),
          -- 검수 문장으로 승격은 하되 강등은 하지 않는다.
          source      = CASE WHEN EXCLUDED.source = 'import' THEN 'import'
                             ELSE public.sentence_bank.source END,
          -- 배치 라벨을 넘겨 받은 경우에만 갱신한다(넘기지 않으면 기존 라벨을 지키지 않고
          -- NULL로 지워 버리는 걸 막는다 — 자동 수집 호출부는 라벨을 모르기 때문이다).
          batch_label = COALESCE(EXCLUDED.batch_label, public.sentence_bank.batch_label)
      -- seq는 건드리지 않는다. 이미 매겨진 회전 순서가 바뀌면 학생이 보던 순서가 흔들린다.
    RETURNING 1
  )
  SELECT count(*)::int INTO _n FROM ups;

  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_sentence_bank(jsonb, text, text) TO authenticated;

COMMENT ON FUNCTION public.upsert_sentence_bank(jsonb, text, text) IS
  '문장 은행에 넣거나 갱신한다. seq는 서버가 기존 최대값 다음으로 매긴다. import는 관리자만. _batch_label은 넘길 때만 갱신된다.';
