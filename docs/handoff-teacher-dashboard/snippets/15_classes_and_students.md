# 15 · 내 클래스 정렬·보관 / 학생 목록 · 활동 기록

시안 파일 `선생님 화면 개편 5차.dc.html`의 **6a · 7a · 7b**만 다룹니다.
색·간격 토큰은 `13_teacher_screens.md`의 **13-1**을 따릅니다 — 여기 없는 값은 그쪽을 보세요.

적용 순서: **7b → 7a → 6a** (다이얼로그 하나 → 페이지 하나 → 스키마 변경 포함).

---

## 15-1 공통 토큰 (요약)

```
초록 #1E6B47 / 연한 초록 배경 #E8F1EB / 초록 카드 #F4F9F6 / 초록 테두리 #DCE9E2·#C8DED3
페이지 #FAF8F5 / 카드 #FFFFFF / 카드 테두리 #EBE5DE / 구분선 #F4F0EA / 목록 헤더 #FBF9F6
본문 #1A1714 / 보조 #6B6460 / 흐림 #8A837D / 비활성 #A29B94·#C4BDB6·#B9B2AB
주의 #B4552D / 삭제 #C1554A
초록 계열 보조 텍스트 #5C7D6C(진함) · #7FA893(연함)
radius  카드 14~16 / 컨트롤 9~11 / 칩 8
```

---

## 15-2 · 7b — 활동 기록 다이얼로그

`StudentHistoryDialog.tsx`. 지금은 `max-w-6xl`에 8열 테이블(유형 6개가 열)이라 대부분 `—`·`미완료`로 비어 있습니다.

**퀴즈별 카드로 바꾸고 폭을 640px로 줄입니다.**

```
max-w-6xl → max-w-[640px]
padding 24px 26px
```

### 헤더

```
"Austin Norris 활동 기록"                      18px 700 letter-spacing -.3px
"배정 1개 · 완료 1개 · 마지막 제출 7일 전"        12.5px #8A837D, margin-top 5
우측 닫기 X 18px #8A837D
```

### 퀴즈 카드

```
border 1px #EBE5DE; radius 14; padding 16px 18px;  카드 사이 gap 10 (margin-top 18)

상단 행 (space-between, gap 14)
  좌: 제목 14px 700 letter-spacing -.2px
      "8월 17일 배정 · 8월 19일 제출"  11.5px #8A837D, margin-top 3
  우: [상세]  아웃라인 — border 1px #C8DED3; color #1E6B47; 11.5px 700; radius 8; padding 6px 11px
             eye 아이콘 13px, gap 6, white-space nowrap

─ border-top 1px #F2EDE7; margin-top 14; padding-top 13 ─

유형 칩  display flex; flex-wrap wrap; gap 7
```

### 유형 칩 — 꺼진 유형은 렌더하지 않습니다

칩 안은 `라벨 11.5px 600` + `값 12.5px 700`, `align-items: baseline; gap 7`, `radius 8`, `padding 7px 11px`.

| 상태 | 배경 | 라벨 | 값 |
|---|---|---|---|
| 점수 정상 | `#E8F1EB` | `#5C7D6C` | `#1E6B47` |
| 점수 낮음 | `#FBEFE9` | `#8A6A5C` | `#B4552D` |
| 미완료 | `#F5F1EB` | `#8A837D` | "미완료" 11.5px 600 `#A29B94` |

6개 열을 고정으로 두지 마세요. 켜진 유형만 칩으로 두면 그 퀴즈가 어떤 유형으로 구성됐는지도 함께 읽힙니다.

### 아직 안 푼 퀴즈도 같은 목록에

```
카드 배경 #FDFCFA
제목      #4A443F
메타      "8월 24일 배정 · 아직 안 풀었습니다"  — 뒷부분만 #B4552D 600
우측 버튼 [상세] 대신 [재알림]  — border 1px #E3DCD3; color #4A443F; 600
칩        점수 없이 유형 이름만 (#F5F1EB / #8A837D)
```

"활동 기록"이라면 배정만 되고 방치된 것도 활동의 일부입니다. `useStudentHistory`가 이미 배정 현황을 함께 가져옵니다.

---

## 15-3 · 7a — 학생 목록 (탭 제거)

`ClassStudents.tsx`. `학생` / `복습 현황` **탭을 없애고 한 테이블로 합칩니다.**
같은 학생의 다른 열이라 탭으로 가르면 1:1 클래스에서 1행 테이블을 두 번 보게 됩니다.
`Card` 래퍼도 없애 카드 안 카드를 제거하고, 테이블이 바로 옵니다.

### 헤더

```
좌:  "학생 1명"   21px 700 letter-spacing -.4px  (숫자는 #8A837D 600)
     "복습 대기는 오늘 풀 수 있는 오답 개수입니다."  12.5px #8A837D, margin-top 5
우:  초대 코드 pill — 흰 배경 + border 1px #E3DCD3 + radius 11 + padding 10px 14px
     [라벨 "초대 코드" 11.5px #8A837D] [값 13px 700 #1E6B47 letter-spacing .06em] [복사 14px #8A837D]
```

상단 뒤로가기 버튼(`← 오스틴`)은 넣지 않습니다.

### 테이블

```
grid-template-columns: 1fr 130px 110px 90px 130px 130px;  gap 14px
                       학생  가입일  복습대기  졸업  마지막활동  (액션 — 헤더 라벨 없음)
헤더  padding 13px 22px; background #FBF9F6; border-bottom 1px #EFE9E2
      11px 700 #8A837D letter-spacing .03em
행    padding 14px 22px; align-items center
```

| 열 | 값 | 스타일 |
|---|---|---|
| 학생 | 아바타 28px + 이름 | 선택 행 700, 그 외 600 |
| 가입일 | 2026. 8. 17. | 12.5px `#6B6460` |
| 복습 대기 | 4개 | 13px 700 `#B4552D` / **0이면 `—` `#B9B2AB`** |
| 졸업 | 12개 | 12.5px `#6B6460` |
| 마지막 활동 | 7일 전 | 없으면 `아직 활동 없음` `#A29B94` |
| 액션 | `[활동 기록]` + chevron | 아웃라인 11.5px 600 `#1E6B47`, border `#C8DED3` |

- 아바타: 활동 있는 학생 `#E8F1EB`/`#1E6B47`, 없으면 `#F3F0EA`/`#6B6460`
- 복습 대기 = 현재 `오늘 복습 대상`과 같은 값 / 졸업 = 6단계(90일차) 통과 개수
- **0을 그대로 늘어놓지 마세요.** 값이 없으면 `—`.

### 아이콘에 이름을 붙이세요

지금은 시계·붉은 사람 아이콘 두 개만 있어 무엇인지 알 수 없습니다.

- 시계 → **`활동 기록`** 버튼 (7b 다이얼로그를 엽니다)
- user-minus → 펼친 행 안의 **`클래스에서 제외`**. 되돌릴 수 없는 동작을 목록에 상시 노출하지 않습니다.

### 펼친 행

```
행 전체 background #F4F9F6; border-bottom 1px #E4EDE8
chevron 은 #7FA893 (접힘 상태는 #C4BDB6)
내용 padding: 0 22px 18px 60px      ← 아바타 28 + gap 10 + 여백 22, 이름 열에 맞춤
```

```
"복습 단계"  11.5px 700 #5C7D6C   ...옆에  "맞힐수록 다음 단계로 넘어가고, 90일차를 지나면 졸업합니다." 11.5px #7FA893
                                                                        (align-items: baseline; gap 10)
칸 7개  flex:1; gap 7; radius 10; padding 11px 0; 가운데
        라벨 10.5px 600 + 값 15px 700 (margin-top 3)
        1일차 / 3일차 / 7일차 / 16일차 / 35일차 / 90일차 / 졸업
```

| 칸 상태 | 테두리 | 라벨 | 값 |
|---|---|---|---|
| 값 있음 | `#DCE9E2` | `#7FA893` | `#1A1714` |
| 값 0 | `#EFE9E2` | `#A29B94` | `#C4BDB6` |
| 졸업 | `#C8DED3` + 배경 `#E8F1EB` | `#1E6B47` 700 | `#1E6B47` |

```
아래 버튼 행 (margin-top 12; align-items center; gap 9)
  [오답 복습 퀴즈 만들기]   border 1px #C8DED3; color #1E6B47; 11.5px 700; radius 8; padding 7px 12px
  [어휘 보강 퀴즈 만들기]   border 1px #E3DCD3; color #4A443F; 11.5px 600
  <span flex:1>
  [클래스에서 제외]         텍스트만, #C1554A, 11.5px 600, user-minus 13px
```

값은 `useClassSrsSummary`가 이미 돌려줍니다(`SRS_STAGE_LABELS`). **쿼리 변경 없음** — 마크업 작업입니다.

---

## 15-4 · 6a — 내 클래스 정렬과 보관

`Classes.tsx`.

### 정렬 — pill 토글 2개

검색창과 같은 행, 우측. 13-4의 필터 토글과 같은 스타일.

```
컨테이너  background #fff; border 1px #E3DCD3; radius 11; padding 4
pill      12px; radius 8; padding 7px 13px
활성      background #1E6B47; color #fff; 700
비활성    color #6B6460; 600
```

```
최근 활동순 (기본)  lastActivity 내림차순.
                   활동 없는 클래스는 맨 뒤로 보내고 그 안에서 created_at 최신순
만든 순서          classes.created_at 내림차순 — 지금 화면과 같은 순서
```

선택은 `localStorage`에 남겨 다음 방문에도 유지하세요.

검색창도 같은 행에 둡니다: `flex 1; min-width 280px`, 흰 배경 + border `#E3DCD3` + radius 11 + padding 11px 15px, 돋보기 15px `#A29B94`, placeholder `클래스 이름 또는 학생 이름으로 검색…`.

### 목록 위 한 줄

```
좌: "클래스 24개"  12px #8A837D
우: [보관함 아이콘 14px] 보관함 3   12px 600 #4A443F (숫자만 #1A1714 bold)
```

**보관된 클래스가 0개면 렌더하지 않습니다.** 빈 링크를 두면 매번 읽어야 하는 글자가 됩니다.

### 보관 — 마이그레이션 1개

```sql
alter table classes add column archived_at timestamptz;
```

- 목록 쿼리에 `.is('archived_at', null)`
- **확인 다이얼로그를 띄우지 마세요.** 데이터를 지우지 않습니다. 토스트에 "되돌리기"만 두세요.
- 보관함 화면은 같은 그리드에 카드를 회색조로 두고 버튼만 **보관 해제**로 바꾸면 됩니다. 별도 레이아웃 불필요.

### 카드 우상단 `⋮` 메뉴 (현재 카드에 메뉴가 없습니다)

트리거는 카드 상단 행 오른쪽 끝, `16px` dots-vertical, `stroke #4A443F 2.2`, `margin-top 2`.

```
메뉴   position absolute; top 46px; right 14px; z-index 2
       background #fff; border 1px #E3DCD3; radius 11; padding 5
       box-shadow 0 6px 18px rgba(0,0,0,.1); width 150px
항목   padding 9px 10px; 12.5px 600; 아이콘 14px; gap 8
       hover → background #F4F9F6; radius 7
순서   이름 수정 / 보관하기 / ─ / 삭제(#C1554A)
구분선 height 1px; background #F2EDE7; margin 4px 6px
```

### 카드 본문 (5e와 동일 — 이미 적용됨)

활동이 멀어진 카드만 다릅니다.

```
30일 초과   아바타 #F3F0EA/#8A837D, 제목 #4A443F, "39일 전" 값 #8A837D
활동 없음   값 자리에 "아직 활동 없음"  12.5px 600 #A29B94
```

그리드: `repeat(3, 1fr); gap 14`.

---

## 15-5 하지 말 것

- **학생 / 복습 현황을 탭으로 가르지 마세요.** 같은 학생의 다른 열입니다.
- **유형 6개를 고정 열로 두지 마세요** (7b). 대부분 비어 있어 표가 빈칸으로 채워집니다.
- **0을 그대로 늘어놓지 마세요** (7a). 값이 없으면 `—`, 단계 칸은 회색으로 눌러 놓습니다.
- **이름 없는 아이콘을 목록 행에 두지 마세요.** 무엇인지 알 수 없습니다.
- **클래스에서 제외를 목록 행에 상시 노출하지 마세요.** 펼친 행 안으로.
- **보관에 확인 다이얼로그를 붙이지 마세요.** 삭제가 아닙니다.
- **보관함 링크를 0개일 때도 두지 마세요.**
- 카드 안에 카드를 두지 마세요 (7a의 `Card` 래퍼 제거).
