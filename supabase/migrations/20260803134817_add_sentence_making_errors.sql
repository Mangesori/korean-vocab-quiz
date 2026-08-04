-- 문장 만들기 채점의 "오류 목록"을 저장한다.
--
-- 배경 (2026-08-03 코드 전수 확인):
--   - grade-sentence는 errors를 돌려주는데 저장하는 곳이 없어 그대로 버려지고 있었다.
--   - 반대로 word_usage_score / grammar_score / naturalness_score 세 컬럼은
--     1,300여 행에 저장돼 있지만 화면에 렌더하는 코드가 한 줄도 없다(write-only).
--   즉 제일 쓸모 있는 진단은 버리고, 아무도 안 보는 숫자를 보관해 왔다.
--
-- 왜 심각도까지 저장하나:
--   채점 기준(supabase/functions/grade-sentence/GRADING-CRITERIA.md)은 감점 폭과
--   합격선을 상수로 둔다. 오류와 심각도가 남아 있으면 그 상수를 조정했을 때
--   재채점(=API 비용) 없이 점수를 다시 계산할 수 있다. 현재 감점 폭은 사례 7건에
--   맞춘 값이라 조정될 것이 확실하다.
--
-- 이 마이그레이션은 컬럼 추가만 한다. 기존 데이터는 건드리지 않으며,
-- 세 점수 컬럼도 이력 보존을 위해 남겨 둔다(이미 nullable이라 쓰기만 멈추면 된다).

alter table public.sentence_making_answers
  add column if not exists errors jsonb;

comment on column public.sentence_making_answers.errors is
  '채점이 찾아낸 오류 목록. [{"text": "설명", "severity": "critical"|"major"|"minor"}] 형식. '
  'null이면 이 컬럼 도입(2026-08-03) 이전에 채점된 기록이다. '
  '오류 1건 = 학생이 저지른 실수 1개 — 파생 부작용을 따로 세지 않는다.';

comment on column public.sentence_making_answers.word_usage_score is
  'DEPRECATED (2026-08-03). 화면에 표시된 적이 없고, 총점을 가중평균으로 계산하던 옛 공식의 잔재. '
  '새 채점은 이 값을 쓰지 않는다. 기존 행의 이력 보존용으로만 남긴다.';
comment on column public.sentence_making_answers.grammar_score is
  'DEPRECATED (2026-08-03). word_usage_score 참조.';
comment on column public.sentence_making_answers.naturalness_score is
  'DEPRECATED (2026-08-03). word_usage_score 참조.';
