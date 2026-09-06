# 퀴즈 라이브러리 · 관리자 화면 개편 — 적용 가이드

시안: `라이브러리·관리자 개편.dc.html` (확정안만 남김)

**작업 진입 전 `00_START_HERE.md`를 읽으십시오.** 관리자 화면은 현재 파일 2개에 탭으로 묶여 있어, 화면별 작업 전에 분리 단계가 필요합니다.

## 대상 화면 6개

현재 관리자 화면은 `AdminDashboard.tsx`(1259줄, 탭 4개) + `AdminSentenceBank.tsx` 둘뿐이다. 아래 "분리 후 파일"은 `snippets/08` 진행 이후의 위치다.

| 화면 | 시안 id | 현재 위치 | 분리 후 파일 | 변경 규모 |
|---|---|---|---|---|
| 퀴즈 라이브러리 | 2a | `SharedQuizzes.tsx` | 그대로 | 큼 (목록 구조 + 검색) |
| 관리자 대시보드 | 5a | `AdminDashboard.tsx` `?tab=dashboard` | `admin/AdminDashboard.tsx` | 큼 (표 제거) |
| 사용자 관리 | 5b | 같은 탭의 사용자 표 | **신규** `admin/AdminUsers.tsx` | 신규 (이관) |
| 선생님 관리 | 4a | `?tab=teachers` | `admin/AdminTeachers.tsx` | 중간 |
| 문장 은행 관리 | 4b | `AdminSentenceBank.tsx` | 그대로 | 큼 (행 레이아웃) |
| 시스템 리포트 | 1d | `?tab=report` | `admin/AdminReport.tsx` | 중간 (차트 정돈) |

`?tab=feedback`(피드백)은 이번 개편 대상이 아니지만 분리 단계에서 함께 페이지로 나간다.

## 공통 규칙 (모든 관리 표에 동일 적용)

1. **표 행 높이 `h-16`(64px)** — 기존 78px에서 축소. 셀은 한 줄만.
2. **날짜는 `2026년 8월 25일` 한 줄** — 줄바꿈 유발하는 `toLocaleDateString` 기본 출력 금지. `formatKoreanDate()` 사용 (snippets/01 참고).
3. **지표는 카드가 아니라 스트립** — `Card` 4개 나열 대신 테두리 하나를 `divide-x`로 나눔.
4. **대시보드는 목록을 갖지 않는다** — 처리할 일 + 신호만. 목록은 각 관리 페이지 소유.
5. **행 액션은 최대 2개** — 주 동작 1개 + `⋯` 메뉴. 삭제는 항상 `⋯` 안으로.
6. **0값은 막대를 그리지 않는다** — 흐린 글자만 (`text-muted-foreground`).
7. **다중 선택 체크박스는 원형 금지** — `rounded-md`. 원형은 단일 선택으로 읽힘.
8. **왼쪽 굵은 테두리(border-l-4) 사용 금지** — 결과 표시(`WrongAnswerPractice`)에만 남김. 상태 배너는 `border-warning/40` 전체 테두리로.

## 검토 과정에서 확인한 사실 (구현 시 주의)

- **가입 시 역할은 `student`로 확정된다** (`AuthCallback.tsx:68`). "역할 미지정" 상태는 존재하지 않으므로 그 큐/필터/배지를 만들지 말 것.
- **문장 은행 수정은 기존 퀴즈에 반영되지 않는다.** `sentence_bank`는 별도 테이블이고 `upsert_sentence_bank`로 복사되는 단방향 구조. 은행을 읽는 곳은 `WrongAnswerPractice`, `VocabPracticeQuizCreate` 두 곳이라 수정 효과는 이후 생성물에만 적용된다. 다이얼로그에 "퀴즈 N개에 반영" 같은 문구를 쓰면 사실과 다름.
- **`meaning`(단어 뜻)과 `translation`(문장 번역)은 별개 컬럼**이다. 하나로 묶지 말고 필터도 따로.
- **정답은 조사·어미를 포함한 형태**다 (`박물관은`, `운전할 수 없어요`). 문장에서 하이라이트할 범위도 그 전체.
- **힌트 없음은 결함이 아니다.** 부사 등 힌트가 필요 없는 단어가 있어 "채워야 할 것" 그룹에 넣으면 오탐이 된다.

## 미확인 / 결정 필요

- `sentence_bank.batch_label`에 실제로 어떤 값이 들어가는지 (시안은 `8/15 배치`로 가정).
- 퀴즈에서 생성된 문장이 출처 퀴즈 id를 갖는지 — 시안은 퀴즈 제목 표시 + 해당 퀴즈로 링크를 전제로 한다. 컬럼이 없으면 마이그레이션 필요.
- 라이브러리 정렬 "복사 많은 순"에 필요한 복사 횟수 카운터 (`quizzes.copy_count` 또는 `copied_from_quiz_id` 집계).
- 라이브러리 검색어 자동완성 소스 (단어 인덱스 필요).

## 파일

- `00_START_HERE.md` — **진입점**: 작업 순서, 현재 구조 실상, 금지 사항, 확인 방법
- `snippets/01_common.md` — 날짜 포맷터, 지표 스트립, 64px 표 행, 상태 배너, 누락 표시
- `snippets/02_quiz_library.md` — 2a
- `snippets/03_admin_dashboard_users.md` — 5a + 5b
- `snippets/04_admin_teachers.md` — 4a
- `snippets/05_sentence_bank.md` — 4b
- `snippets/06_system_report.md` — 1d
- `snippets/07_data.md` — 필요한 뷰 / RPC / 컬럼 / 마이그레이션
- `snippets/08_routing_and_sidebar.md` — 탭 → 페이지 분리, 라우트, 사이드바

## 적용 순서

`00_START_HERE.md`에 단계별로 상세하게 있다. 요약:

1. `01` 공통 유틸 → 기존 표 3곳에 행 높이·날짜만 먼저 적용 (이것만으로 체감 큼)
2. `08` 탭 → 페이지 분리 (디자인 변경 없이 이동만)
3. `03` 5a·5b → `04` 4a → `06` 1d → `05` 4b → `02` 2a
4. `07` 데이터 — 각 UI 작업 중 필요해지는 시점에
