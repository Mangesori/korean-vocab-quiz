# 12. 학생 내비게이션 — `/classes` 리다이렉트 버그 + 사이드바 항목

시안: `학생 대시보드 개편.dc.html` 의 **6a**(사이드바) · **6b**(내 클래스 학생 화면) · **6c**(전체 퀴즈)

대상 파일
- `src/pages/Classes.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/MobileBottomNav.tsx`
- `src/pages/MyQuizzes.tsx`

---

## 12-1. P1 — 사이드바 "내 클래스"가 대시보드로 보내는 버그

**현상.** 학생이 사이드바에서 대시보드와 내 클래스를 눌렀을 때 같은 화면이 뜬다.

**원인.** `src/pages/Classes.tsx` 는 선생님용 페이지다. 쿼리가 `.eq('teacher_id', user?.id)` 이고 `enabled: can(PERMISSIONS.CREATE_CLASS)` 이며, 렌더 직전에

```tsx
if (!user || !can(PERMISSIONS.CREATE_CLASS)) {
  return <Navigate to="/dashboard" replace />;
}
```

로 학생을 되돌려 보낸다. 그런데 `AppSidebar.tsx` 의 `studentClassItems` 는 같은 `/classes` 를 가리킨다. 즉 학생에게 존재하지 않는 목적지를 메뉴에 걸어둔 상태다.

**해결(권장).** 학생 전용 화면을 만든다. `Classes.tsx` 를 역할별로 분기하지 말고 페이지를 나눌 것 — 쿼리·권한·레이아웃이 전부 다르다.

1. `src/pages/MyClass.tsx` 신규 (학생 전용). 라우트는 `/my-class`.
2. `AppSidebar.tsx` 의 `studentClassItems` 를 `/my-class` 로 변경하고, 라벨을 **클래스 이름**으로 바꾼다.
3. 소속 클래스가 없으면 항목 자체를 `클래스 가입`(대시보드 가입 배너와 같은 목적지)으로 대체한다.
4. 소속이 2개 이상이면 "내 클래스" 그룹 아래에 클래스를 각각 나열한다 (`/my-class/:id`).

`Classes.tsx` 의 `<Navigate>` 가드는 그대로 둔다 (직접 URL 진입 방어용).

### 사이드바 라벨 데이터

```ts
// AppSidebar.tsx — 학생 소속 클래스
const { data: myClasses = [] } = useQuery({
  queryKey: ['myClasses', user?.id],
  enabled: !!user && role === 'student',
  queryFn: async () => {
    const { data } = await supabase
      .from('class_members')
      .select('class_id, classes:class_id ( id, name )')
      .eq('student_id', user!.id);
    return (data ?? []).map((m: any) => m.classes).filter(Boolean);
  },
});

const studentClassItems: NavItem[] =
  myClasses.length === 0
    ? [{ path: '/dashboard#join-class', icon: Users, label: '클래스 가입' }]
    : myClasses.map((c) => ({ path: `/my-class/${c.id}`, icon: Users, label: c.name }));
```

---

## 12-2. P2 — 사이드바에 `전체 퀴즈` 추가

`src/pages/MyQuizzes.tsx`("전체 퀴즈", 라우트 `/my-quizzes`)는 **이미 구현되어 있으나 어떤 내비게이션에도 링크가 없다.** 대시보드의 "전체 보기"들도 목적지가 없다. 새 페이지를 만들지 말고 링크를 연결한다.

```ts
const studentStudyItems: NavItem[] = [
  { path: "/review", icon: CalendarCheck, label: "오늘의 복습", badgeCount: dueCount },
  { path: "/my-quizzes", icon: ListChecks, label: "전체 퀴즈" },   // 신규
  { path: "/wrong-answers", icon: FileX, label: "오답노트" },
  { path: "/vocabulary", icon: BookMarked, label: "단어장" },
];
```

- 아이콘은 `lucide-react` 의 `ListChecks`.
- 대시보드의 "풀어야 할 퀴즈 / 최근 결과 전체 보기" 링크를 모두 `/my-quizzes` 로 연결한다.
- `MobileBottomNav.tsx` 는 항목을 늘리지 않는다 (현재 4개가 상한). 전체 퀴즈는 사이드바/햄버거 메뉴에서만 노출.

**더 추가하지 말 것.** 통계·즐겨찾기·설정 같은 항목은 넣지 않는다. 학생 내비게이션은 대시보드 + 클래스 + 학습 4개로 끝낸다.

---

## 12-3. `MyClass.tsx` 화면 구성 (시안 6b)

대시보드와의 역할 분담을 지킨다.

| 화면 | 답하는 질문 | 내용 |
|---|---|---|
| 대시보드 | 지금 뭘 해야 하나 | 진행 중 퀴즈 1개(마감 임박 순) + 다음 퀴즈 줄 + 복습 대기 + 최근 결과 |
| 내 클래스 | 우리 반은 어떤가 | 공지, 반에 배정된 **전체** 퀴즈(완료분 포함), 같이 배우는 학생, 선생님 |

섹션 순서와 데이터:

1. **헤더** — 클래스 이름 / `선생님 이름 · 학생 N명 · 가입일`. 오른쪽에 `퀴즈 N개 중 M개 완료`.
   - `classes`, `class_members`(count), `profiles`(선생님 이름)
2. **공지** — 최신 1건 전문 + `공지 N개 모두 보기 ›` → `/class/:id/announcements`.
   - 공지가 없으면 이 블록 전체를 렌더하지 않는다 (빈 카드 금지).
3. **이 반에 배정된 퀴즈** — 미완료가 위, 완료는 아래에 흐린 색. 행당 제목 / 마감·진행 / 액션.
   - 액션: 미완료 = `이어서 풀기`·`시작하기`, 완료 = `결과 확인` + `다시 풀기`
   - 하단에 `전체 퀴즈에서 보기 ›` → `/my-quizzes`
4. **사이드(240px)** — 같이 배우는 학생 칩(최대 5명 + `+N`), 선생님 카드, 다른 클래스 가입.

모바일에서는 2컬럼이 세로로 쌓이고 사이드 블록이 마지막으로 내려간다 (시안 **7b**). "같이 배우는 학생"과 "선생님"은 카드 하나로 합치고, 완료 행은 버튼 두 개를 아래로 내려 44px 터치 영역을 확보한다.

---

## 12-4. `MyQuizzes.tsx` 정리 (시안 6c)

기존 기능은 유지하고 표현만 대시보드 최근 결과와 같은 문법으로 맞춘다.

- 카드 리스트 → **테이블형 행** (`퀴즈 / 진행·점수 / 날짜 / 액션` 4열). 대시보드 최근 결과 테이블과 열 문법을 공유한다.
- 필터 탭은 유지하되 기본값 `전체` — 상태는 행 안에서 구분되므로 탭을 누르지 않아도 전부 보인다.
- 점수 표기: `108/120` + 유형별 미니 바 6개 (`QuizTypeScoreBadges` 의 색 배지 대신). 색은 정답률 높음 `#1E6B47`, 낮음 `#8FBFA6`, 미제출 `#E2DDD8` 3단계만.
- 진행 중인 행만 흰 배경 + 초록 채운 버튼, 완료 행은 외곽선 버튼.
- 미완료 행에는 마감 임박 시 `내일 마감` 배지(`#F7E9CB` / `#B26A00`).
- 완료 행의 액션은 `결과 확인`(회색 외곽선) + `다시 풀기`(그린 외곽선) 두 개. 내 클래스(6b)의 완료 행도 동일.

### 다시 풀기 버튼의 위치 (확정)

대시보드는 "지금 할 것"만 다룬다 — 지난 퀴즈를 다시 여는 진입점은 목록 화면에만 둔다.

| 화면 | 결과 확인 | 다시 풀기 |
|---|---|---|
| 대시보드 최근 결과 (데스크톱 5a) | O | **X** |
| 내 클래스 배정 퀴즈 (6b) | O | O |
| 전체 퀴즈 (6c) | O | O |

모바일 대시보드(4a)는 최근 결과 카드가 하나뿐이므로 기존대로 다시 풀기를 유지한다.

### 모바일 (시안 7c)

테이블 4열을 카드 행으로 바꾸되 열 순서(제목 → 진행·점수 → 날짜 → 액션)는 그대로 지킨다. 미완료 카드는 진행 바만, 완료 카드는 점수와 유형바만 넣어 높이를 상태별로 다르게 둔다. 진행 중인 카드만 초록 채운 버튼 + 연한 초록 외곽선(`#D9E8DF`).

---

## 12-5. 클래스 미가입 상태의 대시보드 (시안 7a)

소속 클래스가 없는 학생은 배정된 퀴즈가 없으므로 통계·오답·최근 결과가 전부 빈다. **값이 0인 카드를 보여주지 않는다** — 해당 바닥을 렌더하지 않고 세 바닥만 남긴다.

1. **가입 히어로** (진행 히어로 자리) — 초대 코드 6자리 입력칸 + `가입` 버튼. 대시보드에서 바로 입력하게 하고 모달로 띄우지 않는다.
2. **샘플 퀴즈 카드** — `/quiz/example` 로 연결. 클래스 없이도 6가지 유형을 체험할 수 있는 진입점.
3. **나만의 단어장** — 클래스 없이도 쓰이므로 유지.

렌더하지 않는 것: 통계 3분할(연속 학습·정답률·복습 대기), 오답 노트 카드, 최근 결과 섹션, 하단 클래스 가입 배너(히어로와 중복).

데스크톱도 같은 세 바닥을 한 컬럼으로 둔다 (시안 **7d**) — 오른쪽 사이드레일은 담을 내용이 없어 렌더하지 않고, 본문은 640px로 묶어 넓은 화면에서 카드가 늘어지지 않게 한다. 체험·단어장은 2열로 나란히.

사이드바는 12-1의 코드대로 "내 클래스" 항목이 `클래스 가입`으로 바뀌며 그룹 헤드는 유지한다. 여기에 더해 **`오늘의 복습`·`오답노트`·`전체 퀴즈`도 감춘다** — 가입 전에는 데이터가 생길 수 없는 항목이다. `학습` 그룹에는 `단어장`만 남는다.

---

## 체크리스트

- [ ] `MyClass.tsx` 신규 + `/my-class` 라우트 등록 (`App.tsx`)
- [ ] `AppSidebar.tsx` — `studentClassItems` 를 `/my-class`, 라벨은 클래스 이름, 미소속 시 `클래스 가입`
- [ ] `AppSidebar.tsx` — `학습` 그룹에 `전체 퀴즈`(`/my-quizzes`, `ListChecks`) 추가
- [ ] 대시보드의 모든 `전체 보기` 링크를 `/my-quizzes` 로 연결
- [ ] `MyQuizzes.tsx` 테이블형 전환 + 점수 미니 바
- [ ] `MobileBottomNav.tsx` 는 변경 없음 확인
- [ ] 클래스 0개 / 1개 / 2개 이상 세 경우 모두 확인
- [ ] 클래스 미가입 대시보드(12-5) — 통계·오답·최근 결과 바닥이 렌더되지 않는지 확인
- [ ] 모바일 — 내 클래스(7b) · 전체 퀴즈(7c) 버튼 통짝 영역 44px 이상
