# help-shots — 도움말 센터 스크린샷용 더미 데이터

도움말 센터(`src/pages/HelpCenter.tsx`, `src/data/help/`)에 들어갈 스크린샷을
찍기 위한 결정적(deterministic) 더미 데이터 시드. `fixtures.ts`에 하드코딩된
값만 쓰고 AI 엣지 함수는 전혀 호출하지 않으므로, 몇 번을 다시 돌려도 항상
같은 화면이 나온다.

## 순서

### 1. 로컬 Supabase 기동

```
npx supabase start
```

Docker Desktop이 켜져 있어야 한다. 처음 뜨는 데 실패한다면 십중팔구
`supabase/migrations/`의 스키마 드리프트 때문이다 — 아래 "트러블슈팅" 참고.

성공하면 API URL / anon key / service_role key가 출력된다. 확인하려면:

```
npx supabase status
```

### 2. 시드

```
$env:SUPABASE_URL='http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_KEY='<supabase status의 SERVICE_ROLE_KEY 값>'
npx tsx scripts/help-shots/seed.ts --reset
```

`--reset`은 teacher/student1/student2 세 계정을 먼저 지운다(대부분의 테이블이
`auth.users`를 `ON DELETE CASCADE`로 참조하므로, 계정 삭제만으로 이 시드가
만든 데이터가 거의 다 함께 지워진다). 그 다음 처음부터 다시 만든다.

`--reset` 없이 실행하면 각 테이블의 자연 키(`quiz_id + problem_id` 등)로
upsert하므로 이미 있는 행은 갱신되고 중복 생성되지 않는다. 두 방식 모두
멱등이며, 검증 시 `--reset`을 연달아 2번 실행해도 에러 없이 끝난다.

**SUPABASE_URL이 `127.0.0.1`/`localhost`가 아니면 스크립트가 즉시 에러를
던지고 중단한다** — 실수로 운영 DB에 시드하는 사고를 막기 위한 안전장치이니
절대 지우지 말 것.

시드가 끝나면 다음 값들이 콘솔에 출력된다(캡처 스크립트에서 그대로 쓴다):

| 항목 | 값 |
|---|---|
| 선생님 계정 | `teacher@help.local` / `HelpShots123!` (김민지) |
| 학생1 계정 | `student1@help.local` / `HelpShots123!` (김민수) |
| 학생2 계정 | `student2@help.local` / `HelpShots123!` (이서연) |
| 클래스 초대코드 | `NAMU01` ("초급 한국어 A반") |
| 퀴즈 A | "초급 한국어 통합 퀴즈" — 6가지 유형 전부 켜짐, 단어 6개 |
| 퀴즈 B | "일상 표현 빈칸 채우기" — 빈칸 채우기만, 단어 5개 (편집 화면용) |
| 퀴즈 C | "발음 연습 퀴즈" — 말하기 연습(보고 말하기)만 |
| 퀴즈 D | "듣고 따라 말하기 연습" — 말하기 연습(듣고 말하기)만 |
| 퀴즈 E | "단어 받아쓰기 연습" — 받아쓰기만 |
| 퀴즈 F | "문장 순서 맞추기 연습" — 워드 마그넷만 |
| 퀴즈 G | "문장 만들기 연습" — 문장 만들기만 |
| 퀴즈 H | "단어 짝 맞추기 연습" — 짝 맞추기만 |
| 공유 토큰 | `helpshot0001` (퀴즈 A, `allow_anonymous: true`) |
| 학생1의 퀴즈 A 결과 | 4/6, 오답 3개(빈칸1·받아쓰기1·짝맞추기1) |
| 오답 진행도 | "학교" 마스터(⭐), "친구"·"감사하다" 미마스터 |

퀴즈 C~H는 학생 화면 캡처 전용이다. QuizTake가 문제를 매 로드마다 셔플하고
스테이지 순서도 고정돼 있어서, 6유형을 다 켠 퀴즈 A로는 특정 유형·모드 화면에
결정적으로 도달할 수 없다(자세한 이유는 `fixtures.ts`의 퀴즈 D~H 섹션 주석).

`recording_answers`·`sentence_making_answers`의 `problem_id`에는 논리 id("r0")가
아니라 **문제 행의 PK(uuid)**를 넣어야 한다. 앱이 그렇게 읽고 쓴다. 두 테이블 모두
문제 테이블로의 FK가 없어 논리 id를 넣어도 DB는 아무 말이 없고 화면만 조용히 빈다
(실제로 결과 화면 말하기 탭의 단어별 색 피드백이 통째로 사라졌다).

정확한 필드 값은 `fixtures.ts`를 참고. 고정 UUID는 전부
`00000000-0000-0000-0000-0000000000XX` 패턴이라 grep으로 바로 찾을 수 있다.

### 3. 캡처

```
npx tsx scripts/help-shots/capture.ts            # 전체
npx tsx scripts/help-shots/capture.ts t-edit     # 문서 id를 주면 그 문서만
```

`capture.ts`가 dev 서버(`--mode capture`, 로컬 Supabase를 바라봄)를 직접 띄우고,
선생님/학생1로 로그인한 뒤 `src/data/help/articles.ts`에 선언된 `steps[n].shot`
슬롯을 전부 순회한다. 화면까지 가는 조작은 `recipes.ts`가 슬롯별로 담당한다.
결과는 `public/help/shot-<문서id>-<단계>.png`(전부 1600×900)로 저장된다.

문서 id를 인자로 주면 그 문서의 슬롯만 다시 찍으므로, 한 화면을 손볼 때
전체를 돌릴 필요가 없다.

콘텐츠 자체(related/카테고리/개수)는 따로 검증한다:

```
npx tsx scripts/help-shots/verify.ts
```

캡처가 끝날 때까지 **로컬 Supabase를 끄지 말 것**. 포트 5175를 이전 실행이
물고 있으면 `taskkill /pid <pid> /T /F`로 정리한다.

## 트러블슈팅

### `npx supabase start`가 "column ... does not exist" 류 에러로 멈춘다

`supabase/migrations/`의 83개+ 파일이 원격(운영) DB의 실제 스키마를 완전히
반영하지 못하고 있었다 — Supabase Studio 대시보드에서 직접 스키마를 고친 뒤
마이그레이션 파일로 옮기는 걸 몇 번 빠뜨린 흔적(스키마 드리프트)이다. 이미
확인된 사례: `profiles.role`, `quiz_results.is_anonymous`/`share_token`/
`anonymous_name`, `quizzes.api_provider`. 새 드리프트를 만나면
`src/integrations/supabase/types.ts`(원격 DB에서 생성된 진짜 스키마)와
마이그레이션 파일들을 대조해서 빠진 `ADD COLUMN`을 찾고, 그 컬럼을 처음
참조하는 마이그레이션 바로 앞에 `ADD COLUMN IF NOT EXISTS` 마이그레이션을
끼워 넣어라. 마이그레이션 파일을 고칠 때마다 `npx supabase stop` →
`npx supabase start`로 처음부터 다시 재생해야 한다(실행 중인 DB에는 나중에
끼워넣은 파일이 자동 반영되지 않는다).

### Docker Desktop은 떠 있는데 PowerShell에서 `docker` 명령을 못 찾는다

이 환경에서는 Docker Desktop이 `C:\Users\<user>\AppData\Local\Programs\
DockerDesktop\resources\bin`에 설치돼 있고 PATH에 없을 수 있다. 세션에
한 번 추가하면 된다:

```
$env:PATH = "C:\Users\<user>\AppData\Local\Programs\DockerDesktop\resources\bin;" + $env:PATH
```

### `admin.createUser`에 고정 UUID(`id`)가 안 먹는 것 같다

로컬 GoTrue(이 스택 기준 v2.194.0)는 `AdminUserAttributes.id`를 그대로
받아 그 UUID로 사용자를 만든다 — 직접 확인함. 안 되면 GoTrue 버전이 너무
오래됐을 가능성이 높으니 `npx supabase --version` / 이미지 버전을 확인해라.
