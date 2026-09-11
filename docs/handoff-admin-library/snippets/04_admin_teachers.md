# 04 — 선생님 관리 (4a)

`src/pages/AdminTeachers.tsx`

## 무엇을 바꾸는가

1. **신청 줄에 판단 근거를 넣는다.** 이름·이메일만으로는 승인 여부를 판단할 수 없다. 가입 시점과 학생으로서의 활동을 함께 보여준다.
2. **1건/N건 레이아웃을 통일한다.** 대기 건수에 따라 다른 컴포넌트를 쓰지 않는다.
3. **목록의 축을 가입일 → 마지막 활동으로 바꾼다.** 관리자가 궁금한 것은 "이 선생님이 쓰고 있는지"다. 기본 정렬도 활동순.
4. **휴면 표시.** 퀴즈를 한 번도 만들지 않은 계정에 조용한 배지.

## 승인 대기

```tsx
{pending.length > 0 && (
  <div className="overflow-hidden rounded-xl border border-warning/40 bg-card">
    <div className="flex items-center gap-3 border-b border-warning/20 bg-warning/5 px-5 py-4">
      <div className="flex-1 text-[14.5px] font-extrabold">
        선생님 권한 신청 {pending.length}건 — 승인하면 즉시 선생님으로 전환됩니다
      </div>
      {pending.length > 1 && (
        <Button variant="outline" size="sm" onClick={approveAll}>모두 승인</Button>
      )}
    </div>

    {pending.map((p) => (
      <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-5 border-b border-warning/10 px-5 py-4 last:border-0 hover:bg-warning/[0.03]">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="whitespace-nowrap text-[14.5px] font-semibold">{p.name}</span>
            <span className="truncate text-xs text-muted-foreground">{p.email}</span>
          </div>
          <div className="mt-1 text-xs tabular-nums text-foreground/70">
            {formatKoreanDate(p.applied_at)} 신청
            <span className="mx-1.5 text-border">·</span>
            가입 {formatKoreanDate(p.created_at)}
            <span className="mx-1.5 text-border">·</span>
            {p.submission_count > 0
              ? `학생으로 제출 ${p.submission_count}건`
              : '아직 클래스 없음'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reject(p.id)}>거절</Button>
          <Button size="sm" onClick={() => approve(p.id)}>승인</Button>
        </div>
      </div>
    ))}
  </div>
)}
```

승인 근거로 쓰는 두 값은 쿼리에서 함께 받아야 한다 (snippets/07의 `admin_teacher_applications`).

## 계정 목록

컬럼: `이름 | 이메일 | 마지막 활동 | 운영 현황 | 관리`

```tsx
<colgroup>
  <col className="w-[172px]" /><col /><col className="w-[120px]" />
  <col className="w-[232px]" /><col className="w-[128px]" />
</colgroup>
```

```tsx
<TableRow className="h-16 hover:bg-secondary/60">
  <TableCell className="py-0">
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold">{t.name}</span>
      {t.quiz_count === 0 && (
        <span className="shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-[10.5px] font-extrabold text-warning">
          휴면
        </span>
      )}
    </div>
  </TableCell>

  <TableCell className="py-0 truncate text-muted-foreground">{t.email}</TableCell>

  <TableCell className={`py-0 font-semibold tabular-nums ${activityColor(t.last_active_at)}`}>
    {formatRelativeKo(t.last_active_at)}
  </TableCell>

  <TableCell className="py-0">
    <div className="text-xs tabular-nums text-foreground/80">
      클래스 {t.class_count}<Dot />퀴즈 {t.quiz_count}<Dot />학생 {t.student_count}명
    </div>
    <div className="mt-0.5 text-[11.5px] tabular-nums text-muted-foreground">
      {formatKoreanDate(t.created_at)} 가입
    </div>
  </TableCell>

  <TableCell className="py-0">
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" className="h-8" asChild>
        <Link to={`/admin/teachers/${t.id}`}>자세히</Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-muted-foreground">⋯</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => demote(t.id)}>학생으로 변경</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => confirmDelete(t)}>
            계정 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </TableCell>
</TableRow>
```

```ts
/** 오늘=primary, 최근=기본, 오래됨=흐림, 없음=warning */
function activityColor(last: string | null) {
  if (!last) return 'text-warning';
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  if (days <= 0) return 'text-primary';
  if (days < 14) return '';
  return 'text-muted-foreground';
}
```

## 툴바

```tsx
<div className="flex items-center gap-3.5 border-b border-border px-6 py-4">
  <div className="text-base font-extrabold">계정 목록</div>
  <div className="flex-1" />
  <SearchInput className="w-[240px]" placeholder="이름 또는 이메일" />
  <Button variant="outline" size="sm" onClick={() => setDormantOnly((v) => !v)}
          className={dormantOnly ? 'border-warning/50 text-warning' : ''}>
    휴면만 보기
  </Button>
  <Select value={sort} onValueChange={setSort}>최근 활동순</Select>
</div>
```

헤더 우측 요약:

```tsx
<div className="text-xs tabular-nums text-muted-foreground">
  선생님 <b className="text-foreground">{total}명</b>
  · 최근 30일 활동 <b className="text-foreground">{active30}명</b>
  · 휴면 <b className="text-warning">{dormant}명</b>
</div>
```
