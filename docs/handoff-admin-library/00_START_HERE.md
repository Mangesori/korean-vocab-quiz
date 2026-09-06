# START HERE — Claude Code 작업 지시

이 폴더는 퀴즈 라이브러리 + 관리자 화면 개편의 적용 자료다. 시안은 프로젝트 루트의 `라이브러리·관리자 개편.dc.html`(6개 화면).

## 먼저 읽을 것

1. 이 파일 (전체 구조 + 작업 순서)
2. `README.md` (공통 규칙 8개 + 확인된 사실)
3. 작업할 화면의 스니펫 하나

스니펫의 코드는 **완성된 컴포넌트가 아니라 패턴 참고**다. 기존 파일의 데이터 흐름·훅·권한 처리를 유지하면서 마크업과 정보 구조만 스니펫대로 바꾼다.

## 현재 구조 (작업 전 실측)

관리자 화면은 **파일 2개**뿐이다:

```
src/pages/AdminDashboard.tsx     1259줄 — 탭 4개가 한 파일에
  ?tab=dashboard   전체 사용자 표 + 카드 4개 + 도넛
  ?tab=teachers    선생님 관리
  ?tab=report      시스템 리포트
  ?tab=feedback    피드백
src/pages/AdminSentenceBank.tsx   643줄
```

사이드바(`src/components/layout/AppSidebar.tsx:173`)는 `exactSearch: "?tab=teachers"` 방식으로 이미 **별도 페이지처럼 5개 항목**을 노출하고 있다. 즉 사용자에게는 이미 별개 화면인데 코드만 한 파일이다.

**따라서 이번 개편의 첫 단계는 탭을 실제 페이지로 분리하는 것이다.** 이게 선행되지 않으면 5a(대시보드에서 표 제거)를 적용할 수 없다 — 표를 옮길 페이지가 없다.

## 작업 순서

각 단계는 독립적으로 커밋 가능하다. 순서를 지킬 것.

### 0단계 — 공통 유틸

`snippets/01_common.md`

- `src/lib/format.ts`에 `formatKoreanDate`, `formatRelativeKo`, `pct` 추가
- 기존 관리자 표 3곳(대시보드 사용자 표, 선생님 탭, 문장 은행)에 `h-16` + `formatKoreanDate` 먼저 적용

이 단계만으로 "행 높이가 너무 크다 / 날짜가 줄바꿈된다"는 문제가 해결된다. 이후 단계와 무관하게 먼저 넣을 수 있다.

### 1단계 — 탭을 페이지로 분리

`snippets/08_routing_and_sidebar.md`

`AdminDashboard.tsx` 1259줄을 5개 파일로 나눈다. **이 단계에서는 디자인을 바꾸지 않는다** — 순수 이동만. 그래야 다음 단계의 diff가 읽힌다.

```
src/pages/admin/AdminDashboard.tsx    (?tab=dashboard 중 지표만)
src/pages/admin/AdminUsers.tsx        (전체 사용자 표 — 신규 위치)
src/pages/admin/AdminTeachers.tsx     (?tab=teachers)
src/pages/admin/AdminReport.tsx       (?tab=report)
src/pages/admin/AdminFeedback.tsx     (?tab=feedback)
```

라우트 + 사이드바 `exactSearch` → 실제 `path` 전환. `?tab=` URL은 리다이렉트로 살려둔다(북마크 보호).

### 2단계 — 화면별 디자인 적용

순서 무관하나 규모 순으로:

| 순서 | 화면 | 스니펫 | 파일 |
|---|---|---|---|
| 2-1 | 관리자 대시보드 (5a) | `03` | `admin/AdminDashboard.tsx` |
| 2-2 | 사용자 관리 (5b) | `03` | `admin/AdminUsers.tsx` |
| 2-3 | 선생님 관리 (4a) | `04` | `admin/AdminTeachers.tsx` |
| 2-4 | 시스템 리포트 (1d) | `06` | `admin/AdminReport.tsx` |
| 2-5 | 문장 은행 (4b) | `05` | `AdminSentenceBank.tsx` |
| 2-6 | 퀴즈 라이브러리 (2a) | `02` | `SharedQuizzes.tsx` |

### 3단계 — 데이터

`snippets/07_data.md`

시안의 일부 값은 현재 스키마로 얻을 수 없다. **2단계에서 해당 UI를 만들 때 값이 없으면 그 요소를 생략하고 진행한다** — 임시 값을 하드코딩하지 말 것. 필요한 뷰/RPC/컬럼은 07에 정리돼 있고, 각 항목에 "없으면 어떻게 폴백하는지" 명시했다.

## 지켜야 할 것

- **`src/index.css`의 토큰만 쓴다.** `slate-*`, `gray-*` 같은 Tailwind 기본 팔레트를 새로 추가하지 말 것. 필요한 색은 이미 다 있다: `primary` `accent` `warning` `info` `success` `destructive` `muted-foreground` `border` `secondary` `card`.
- **`bg-type-${x}` 같은 동적 클래스 금지.** Tailwind JIT가 못 잡는다. 정적 맵을 쓴다 — `snippets/02` 하단 참고.
- **`border-l-4` 금지.** 결과 표시(`WrongAnswerPractice.tsx:566`)에만 남긴다.
- **없는 상태를 만들지 말 것.** "역할 미지정"은 존재하지 않는다 (`AuthCallback.tsx:68`에서 가입 시 `student` 확정).
- **문장 은행 수정이 기존 퀴즈에 반영된다고 쓰지 말 것.** 단방향 복사 구조다. 근거는 `README.md`.

## 확인 방법

각 단계 후:

```
npm run build     # 타입 에러 없어야 함
```

수동 확인:

- 관리자 계정으로 `/admin` → 표가 없고 처리할 일 카드만 보이는가
- `/admin/users` → 59명 목록, 행 높이 64px, 날짜 한 줄
- 기존 `?tab=teachers` URL이 `/admin/teachers`로 리다이렉트되는가
- 사이드바 5개 항목이 각각 활성 표시되는가 (`exactSearch` 제거 후에도)
- 다크 모드에서 `warning`/`info` 대비가 유지되는가

## 파일 목록

```
README.md                          공통 규칙 + 확인된 사실 + 미확인 항목
snippets/01_common.md              날짜 포맷터, 지표 스트립, 64px 행, 배너, 누락 표시
snippets/02_quiz_library.md        2a — 라이브러리
snippets/03_admin_dashboard_users.md  5a + 5b
snippets/04_admin_teachers.md      4a
snippets/05_sentence_bank.md       4b
snippets/06_system_report.md       1d
snippets/07_data.md                뷰/RPC/컬럼/마이그레이션
snippets/08_routing_and_sidebar.md 1단계 — 탭 분리, 라우트, 사이드바
```
