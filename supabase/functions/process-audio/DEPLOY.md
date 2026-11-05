# process-audio 운영 적용 절차서

서버 쪽 음성(TTS) 생성(엣지 함수 `process-audio` + 1분 주기 pg_cron)을 운영
(`lkuikpbquqcgbezepkxl`)에 적용하는 순서다. **위에서부터 차례로** 실행한다.
비밀 값은 이 문서에 쓰지 않는다 — 만드는 방법만 적었다.

관련 파일
- `supabase/migrations/20261105000000_server_side_audio.sql`
- `supabase/functions/process-audio/index.ts`, `supabase/functions/_shared/tts.ts`
- `supabase/config.toml` (`[functions.process-audio] verify_jwt = false`)

> 화면(새 `QuizPreview` 등)이 `quizzes.tts_provider`를 INSERT하므로 **① 마이그레이션이 화면 배포보다 먼저**여야 한다.
> 기존 `elevenlabs-tts` / `azure-tts` 함수는 바꾸지 않았다 → 재배포 대상 아님.

---

## 0. 적용 전 확인 (읽기 전용)

```sql
-- 확장 상태: supabase_vault만 있어야 정상(pg_cron, pg_net은 ①에서 생성)
select extname, extversion from pg_extension where extname in ('pg_cron','pg_net','supabase_vault');

-- 백필 규모(2026-11-05 기준: quiz_problems URL 없음 72행, recording listen URL 없음 104행,
-- quiz_problems 행이 없는 퀴즈 3개/65문제)
select count(*) filter (where sentence_audio_url is null) from public.quiz_problems;
select count(*) from public.recording_problems where mode = 'listen' and sentence_audio_url is null;
```

마이그레이션 7번(행 없는 퀴즈 보정)이 채울 퀴즈(2026-11-05 확인):

| quiz id | 제목 | 문제 수 |
|---|---|---|
| 06451409-0884-48d2-929c-9f1008835fde | 서강대 1과 | 25 |
| 1c49413a-fc38-4a0a-8eef-78d64b5003f5 | 2.12 김선진 - 헬스장 | 25 |
| 21373bb2-9b62-471f-b448-2de1d0c64a5a | 2.27 율리아네 - 추억 2 | 15 |

## ① 마이그레이션 적용

저장소 루트에서:

```bash
npx supabase migration list --linked     # 원격과 로컬 이력이 어긋나 있지 않은지 먼저 확인
npx supabase db push --linked            # 20261105000000_server_side_audio.sql 적용
```

(이력이 어긋나 `db push`가 곤란하면 Supabase MCP `apply_migration`으로 이 파일 내용을
`server_side_audio` 이름으로 적용해도 된다. 파일은 재실행 안전.)

적용 확인:

```sql
select extname from pg_extension where extname in ('pg_cron','pg_net');            -- 2행
select jobname, schedule, active from cron.job where jobname = 'process-audio';    -- active = false
select count(*) from public.quiz_problems
 where quiz_id in ('06451409-0884-48d2-929c-9f1008835fde','1c49413a-fc38-4a0a-8eef-78d64b5003f5','21373bb2-9b62-471f-b448-2de1d0c64a5a'); -- 65
select tbl, status, count(*) from public.audio_work_items group by 1, 2 order by 1, 2;
```

## ② Vault 비밀 2개 만들기

cron 비밀 값을 하나 만든다(어디에도 붙여넣거나 커밋하지 말 것. ②와 ③에 같은 값을 쓴다).

```bash
openssl rand -hex 32
# 또는 PowerShell:
# -join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })
```

Supabase 대시보드 → SQL Editor에서(값 자리만 바꿔서):

```sql
select vault.create_secret(
  'https://lkuikpbquqcgbezepkxl.supabase.co/functions/v1/process-audio',
  'process_audio_url',
  'process-audio 엣지 함수 URL (pg_cron이 호출)'
);
select vault.create_secret(
  '<위에서 만든 cron 비밀>',
  'process_audio_cron_secret',
  'process-audio x-cron-secret (엣지 함수 AUDIO_CRON_SECRET과 같은 값)'
);

-- 확인(값은 보지 않고 이름만)
select name, created_at from vault.secrets where name in ('process_audio_url','process_audio_cron_secret');
```

값을 바꿀 때: `select vault.update_secret((select id from vault.secrets where name = 'process_audio_cron_secret'), '<새 값>');`

## ③ 엣지 함수 비밀

```bash
npx supabase secrets set AUDIO_CRON_SECRET=<②와 같은 값> --project-ref lkuikpbquqcgbezepkxl
npx supabase secrets list --project-ref lkuikpbquqcgbezepkxl   # AUDIO_CRON_SECRET, ELEVENLABS_API_KEY, AZURE_SPEECH_KEY 있는지
```

(셸 기록에 남기 싫으면 `.env` 파일에 넣고 `npx supabase secrets set --env-file <파일>` 후 파일 삭제.)

## ④ 함수 배포

```bash
npx supabase functions deploy process-audio --project-ref lkuikpbquqcgbezepkxl
```

`config.toml`의 `verify_jwt = false`가 적용된다(함수가 직접 인증). `_shared/tts.ts`는 함께 묶여 올라간다.

간단 확인(비밀 없이 호출 → 401이면 정상):

```bash
curl -s -X POST https://lkuikpbquqcgbezepkxl.supabase.co/functions/v1/process-audio -H "Content-Type: application/json" -d '{}'
# {"error":"인증이 필요합니다."}
```

## ⑤ cron 켜기 전에 EP.5 퀴즈 하나로 시험

대상: `d4c8e239-63bf-4984-94a2-1ec833d3cf8f` — 녹음(listen) 6행이 URL 없음
(sort_order 1, 3, 4, 6, 8, 10 / 모두 빈칸 채우기 문장과 달라서 재사용 없이 TTS 6회).

시험 전 상태:

```sql
select sort_order, mode, sentence, sentence_audio_url is not null as has_url, audio_attempts
from public.recording_problems
where quiz_id = 'd4c8e239-63bf-4984-94a2-1ec833d3cf8f'
order by sort_order;
```

시험 호출 — `{ quizId }` 요청은 운영 점검용으로 올바른 `x-cron-secret`이 있으면 사용자 JWT 없이 허용된다:

```bash
curl -s -X POST https://lkuikpbquqcgbezepkxl.supabase.co/functions/v1/process-audio \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <cron 비밀>" \
  -d '{"quizId":"d4c8e239-63bf-4984-94a2-1ec833d3cf8f"}'
# {"accepted":true}  → 30초~1분 기다린 뒤 아래 확인
```

(또는 그 퀴즈 소유 선생님/관리자로 로그인한 화면에서 `supabase.functions.invoke("process-audio", { body: { quizId } })`.)

확인 SQL:

```sql
select sort_order, mode, sentence,
       audio_text_hash = md5(btrim(sentence))   as text_matches_sentence,
       sentence_audio_url is not null           as has_url,
       sentence_audio_url like '%/recording_%'  as server_file,
       audio_attempts, audio_error
from public.recording_problems
where quiz_id = 'd4c8e239-63bf-4984-94a2-1ec833d3cf8f' and mode = 'listen'
order by sort_order;

-- 핵심: sort_order 6은 녹음 문장이어야 하고, 빈칸 채우기 완성 문장("팀원들이 각자 자기 몫…")이 아니어야 한다
select r.audio_text_hash = md5('저는 벌써 제 몫을 다 끝냈어요.') as ok_recording_text,
       r.audio_text_hash = md5(btrim(regexp_replace(qp.sentence, '\(\s*\)|\(\)',
         (select e->>'answer' from public.quizzes q, jsonb_array_elements(q.problems) e
           where q.id = r.quiz_id and e->>'id' = r.problem_id), 'g'))) as wrong_fill_blank_text,
       r.sentence_audio_url is distinct from qp.sentence_audio_url as own_audio_file
from public.recording_problems r
join public.quiz_problems qp on qp.quiz_id = r.quiz_id and qp.problem_id = r.problem_id
where r.quiz_id = 'd4c8e239-63bf-4984-94a2-1ec833d3cf8f' and r.sort_order = 6;
-- 기대: ok_recording_text = true, wrong_fill_blank_text = false, own_audio_file = true

select public.audio_status('d4c8e239-63bf-4984-94a2-1ec833d3cf8f');  -- SQL Editor(관리자 아님)에서는 NULL. 아래로 대신:
select status, count(*) from public.audio_work_items
where quiz_id = 'd4c8e239-63bf-4984-94a2-1ec833d3cf8f' group by 1;   -- pending/failed 0이어야 함
```

기대: listen 6행 모두 `has_url = true`, `text_matches_sentence = true`, `server_file = true`, `audio_error` NULL.
`audio_text_hash`는 정리된 텍스트의 **md5 hex(소문자, UTF-8)** 이고 Postgres `md5(text)`와 같은 값이다
(텍스트 자체는 정답 노출 때문에 저장하지 않는다).
URL 하나를 브라우저로 열어 실제로 그 문장을 읽는지 들어본다(sort_order 6).
실패하면 `audio_error`와 대시보드 → Edge Functions → process-audio → Logs를 본다.

## ⑥ cron 활성화

```sql
select cron.alter_job((select jobid from cron.job where jobname = 'process-audio'), active := true);
select jobname, schedule, active from cron.job where jobname = 'process-audio';
```

예상 백필 규모(2026-11-05 SELECT 기준):

| 대상 | 행 | TTS 호출 | 글자 수(대략) |
|---|---|---|---|
| quiz_problems URL 없음 | 72 | 72 | |
| quiz_problems 새로 보정된 3개 퀴즈 | 65 | 65 | |
| (quiz_problems 합계) | 137 | 137 | 3,705 |
| recording listen — 지금 바로 재사용(URL 복사) | 42 | 0 | |
| recording listen — 빈칸 채우기 음성 생성 후 재사용(URL 복사) | 13 | 0 | |
| recording listen — 새로 생성 | 49 | 49 | 1,156 |
| **합계** | **241** | **약 186** | **약 4,900** |

호출 1회당 최대 약 100초 동안 동시 3개씩 처리하고, 1분마다 다시 깨어나므로 보통 15~30분 안에 끝난다.
(녹음 행은 같은 문제의 빈칸 채우기 행이 끝날 때까지 미뤄서 재사용 기회를 살린다. 재사용은 녹음 행에 URL을
**복사해 저장**하는 방식이며, 화면은 더 이상 빈칸 채우기 음성을 대신 찾지 않으므로 A1/A2 듣기 음성의 유일한 경로다.
재사용으로 URL을 공유하는 녹음 행 수(기존 화면이 재사용한 행 포함, 적용 전보다 약 55 늘어야 함): `select count(*) from public.recording_problems r join public.quiz_problems qp on qp.quiz_id = r.quiz_id and qp.problem_id = r.problem_id where r.mode = 'listen' and r.sentence_audio_url = qp.sentence_audio_url;`)
대부분 퀴즈의 `tts_provider`는 기본값 `elevenlabs`라 ElevenLabs 크레딧을 쓴다. 크레딧이 없으면(402) Azure로 자동 대체.

## ⑦ 진행 확인

```sql
-- 전체 진행
select tbl, status, count(*) from public.audio_work_items group by 1, 2 order by 1, 2;

-- 실패/재시도 중인 행
select tbl, quiz_id, problem_id, audio_attempts, audio_locked_until, audio_error
from public.audio_work_items
where status <> 'ready' and audio_error is not null
order by audio_attempts desc limit 50;

-- cron 실행 기록
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'process-audio')
order by start_time desc limit 10;

-- pg_net 응답(202 = 정상 접수, 401 = 비밀 불일치)
select id, status_code, left(content, 120) as content, created
from net._http_response order by created desc limit 10;
```

최종 실패(`status = 'failed'`, 5회 실패)한 행은 화면의 "다시 만들기"(force)로 처리하거나,
원인 해결 후 다음으로 재시도 대상으로 되돌린다:

```sql
update public.quiz_problems      set audio_attempts = 0, audio_locked_until = null, audio_error = null
 where sentence_audio_url is null and audio_attempts >= 5;
update public.recording_problems set audio_attempts = 0, audio_locked_until = null, audio_error = null
 where mode = 'listen' and sentence_audio_url is null and audio_attempts >= 5;
```

## ⑧ 되돌리기

1. **cron 멈춤(가장 먼저, 언제든 안전)**
   ```sql
   select cron.alter_job((select jobid from cron.job where jobname = 'process-audio'), active := false);
   -- 완전히 지우려면: select cron.unschedule('process-audio');
   -- (다시 등록: 마이그레이션의 8번 DO 블록을 다시 실행하면 꺼진 상태로 재등록됨)
   ```
2. **함수 비활성화**
   - cron 경로만 막기: `npx supabase secrets unset AUDIO_CRON_SECRET --project-ref lkuikpbquqcgbezepkxl` (cron 호출이 401로 끝남)
   - 함수 전체 제거: `npx supabase functions delete process-audio --project-ref lkuikpbquqcgbezepkxl`
     (새 화면의 "다시 만들기"·상태 표시가 이 함수에 의존하므로 화면도 함께 되돌릴 때만)
3. **스키마는 남겨 둬도 무해**하다(컬럼 추가·트리거·뷰·RPC). 꼭 지워야 하면:
   ```sql
   select cron.unschedule('process-audio');
   drop function if exists public.kick_process_audio();
   drop function if exists public.claim_audio_work(int, uuid);
   drop function if exists public.audio_status(uuid);
   drop view if exists public.audio_work_items;
   drop trigger if exists quiz_problems_reset_audio on public.quiz_problems;
   drop trigger if exists recording_problems_reset_audio on public.recording_problems;
   drop function if exists public.reset_audio_on_sentence_change();
   drop function if exists public.audio_row_claimable(text, int, timestamptz);
   drop function if exists public.audio_row_status(text, int);
   -- 컬럼(audio_text_hash, audio_attempts, audio_error, audio_locked_until, quizzes.tts_provider)은
   -- 화면이 쓰고 있으면 지우지 말 것. 보정으로 넣은 quiz_problems 65행도 정상 데이터라 그대로 둔다.
   ```
4. Vault 비밀 정리(선택): `delete from vault.secrets where name in ('process_audio_url','process_audio_cron_secret');`
