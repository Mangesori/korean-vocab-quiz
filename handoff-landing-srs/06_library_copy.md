# 라이브러리 복사 후 처리 — B 기본 + C 옵션

**대상 파일**: `src/pages/SharedQuizzes.tsx`
**결정**: B(버튼이 "내 퀴즈에서 열기 →"로 변신)를 기본, C(배정으로 직결)를 옵션으로 얹는다.

---

## 지금 동작

`handleCopy` (SharedQuizzes.tsx:333~354)

```ts
const { error: copyError } = await (supabase.rpc as any)('copy_shared_quiz', { _quiz_id: quiz.id });
if (copyError) throw copyError;

toast.success(`"${quiz.title}"을(를) 내 퀴즈로 복사했어요`);
setCopiedIds((prev) => new Set(prev).add(quiz.id));
queryClient.invalidateQueries({ queryKey: ['quizzes'] });
queryClient.invalidateQueries({ queryKey: ['sharedQuizzes'] });
```

버튼은 `isCopied`면 `복사됨` + 체크 아이콘으로 바뀌고 `disabled`가 된다 (LibraryRow, 202~211행).
**페이지 이동이 없다.** 복사한 퀴즈를 보려면 교사가 직접 사이드바에서 `내 퀴즈`로 가야 한다.

---

## ⚠ 선행 조건 — RPC가 새 퀴즈 id를 돌려주지 않는다

`copy_shared_quiz`는 현재 `{ error }`만 쓰고 있다. B와 C 모두 **새로 만들어진 퀴즈의 id가 필요하다.**

두 가지 중 하나를 먼저 해야 한다.

1. **(권장)** `copy_shared_quiz`가 새 quiz id를 반환하도록 마이그레이션 수정 → `RETURNS uuid`
2. 반환값을 못 바꾸면, 복사 직후 `quizzes`에서 `origin_quiz_id = quiz.id AND teacher_id = 나`로 재조회

1번이 맞다. 2번은 같은 원본을 두 번 복사한 교사에게서 잘못된 행을 집을 수 있다.

> 참고: `DuplicateQuizButton.tsx`는 이미 `insert().select().single()`로 `newQuiz`를 받아서
> `navigate(`/quiz/${newQuiz.id}`)`까지 한다. 그쪽 패턴을 따르면 된다.

---

## B — 버튼이 변신한다 (기본)

`copiedIds: Set<string>`를 `copiedQuizIds: Map<string, string>`(원본 id → 새 퀴즈 id)로 바꾼다.

### 상태

```ts
const [copiedQuizIds, setCopiedQuizIds] = useState<Map<string, string>>(new Map());
```

### handleCopy

```ts
const newQuizId = await (supabase.rpc as any)('copy_shared_quiz', { _quiz_id: quiz.id });
// ...
setCopiedQuizIds((prev) => new Map(prev).set(quiz.id, newQuizId));
```

### LibraryRow

`isCopied` 대신 `copiedQuizId?: string`를 받는다.

| 상태 | 버튼 |
|---|---|
| 기본 | `내 퀴즈로 복사` · `Copy` 아이콘 · 활성 |
| 복사 중 | 스피너 · `disabled` |
| 복사 완료 | **`내 퀴즈에서 열기 →`** · `ArrowRight` 아이콘 · **활성** · `<Link to={`/quiz/${copiedQuizId}`}>` |

`disabled`를 걷는 것이 핵심이다. 지금은 복사 후 버튼이 죽어서 다음 행동이 없다.

`variant`는 `outline`으로 낮춘다 — 이미 한 일이라 강조가 필요 없고, 옆 행의 `내 퀴즈로 복사`(기본 variant)와 구분된다.

### 토스트

문구는 그대로 두고 액션만 붙인다 (sonner):

```ts
toast.success(`"${quiz.title}"을(를) 내 퀴즈로 복사했어요`, {
  action: { label: '열기', onClick: () => navigate(`/quiz/${newQuizId}`) },
});
```

토스트는 놓치면 사라지므로 **B의 버튼 변신이 본체**이고 토스트 액션은 보조다. 둘 다 넣는다.

---

## C — 배정으로 직결 (옵션)

복사하는 이유가 대개 "내 반에 쓰려고"이므로, 복사 직후 배정 다이얼로그를 띄운다.

### ⚠ 기존 다이얼로그를 그대로 쓸 수 없다

`AssignQuizDialog`는 **반 우선(class-first)** 이다.

```ts
interface AssignQuizDialogProps {
  open, onOpenChange,
  classId: string,        // ← 반이 먼저 정해져 있어야 한다
  assignedQuizIds: string[],
}
```

이 다이얼로그는 "이 반에 어떤 퀴즈를 줄까"를 고르게 한다.
C가 필요한 건 그 반대 — "이 퀴즈를 어느 반에 줄까"(**퀴즈 우선**)다.

두 가지 방법:

1. **`AssignClassDialog`를 새로 만든다** (권장) — `quizId`를 받아 교사의 반 목록을 체크박스로 보여주고, 고른 반들에 `class_quizzes` 다중 insert. `AssignQuizDialog`의 insert·invalidate 로직(88~117행)을 축만 뒤집어 재사용.
2. 반이 하나뿐인 교사에게만 `AssignQuizDialog`를 그 `classId`로 띄운다. 반이 2개 이상이면 C를 건너뛴다. 임시방편.

### 동작

복사 성공 → 다이얼로그:

```
복사했어요
"서울대 1B pt.1"이 내 퀴즈에 추가됐어요.

지금 반에 배정할까요?
  ☐ 수요일 초급반 (12명)
  ☐ 금요일 중급반 (8명)

[나중에 하기]            [배정하기]
```

- `나중에 하기` → 닫기. B의 변신한 버튼이 남아 있으므로 길이 끊기지 않는다.
- 여러 개를 연달아 복사하는 교사를 막지 않도록, **"다음부터 묻지 않기"** 체크박스를 넣고 `localStorage`에 저장한다.

C는 B 위에 얹는 것이다. C를 끄면 B만 남고, 그래도 완결된다.

---

## 작업 순서

1. `copy_shared_quiz`가 새 quiz id를 반환하도록 수정 (**선행**)
2. B — `copiedIds` → `Map`, `LibraryRow` 버튼 3상태, 토스트 액션
3. C — `AssignClassDialog` 신규 + 복사 성공 시 호출 + "다음부터 묻지 않기"

1·2만 해도 "복사한 게 어디 갔나" 문제는 해결된다.

---

## 같이 결정된 것 (참고)

- **라이브러리와 내 퀴즈는 합치지 않는다.** 내 퀴즈 = 내 자산 관리(누구에게 보냈나·결과·삭제), 라이브러리 = 남의 것 탐색·획득. 목적이 달라 탭으로 묶으면 매번 "지금 어느 모드지"를 확인해야 한다. 중복은 화면을 합치지 않고 **필터바·카드 컴포넌트만 공유**해 없앤다.
- 라이브러리 카드의 문장 맛보기(4줄 + 펼치기)는 지금 그대로 둔다.
- `내 퀴즈`에 유형 필터를 추가하지 않는다.
