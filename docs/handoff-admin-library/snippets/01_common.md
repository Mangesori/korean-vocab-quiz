# 01 — 공통 유틸 / 패턴

## 날짜 포맷터

`src/lib/format.ts`에 추가:

```ts
const KOREAN_DATE = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric',
});

/** 2026년 8월 25일 — 표 셀에서 줄바꿈되지 않는 한 줄 형태 */
export function formatKoreanDate(value: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return KOREAN_DATE.format(d).replace(/\s+/g, ' ');
}

/** 오늘 · 어제 · 3일 전 · 3주 전 · 활동 없음 */
export function formatRelativeKo(value: string | null): string {
  if (!value) return '활동 없음';
  const d = new Date(value);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 35) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}
```

표 셀에는 `formatKoreanDate`, "마지막 활동" 열에는 `formatRelativeKo`.

## 지표 스트립 (카드 4개 대체)

```tsx
type Stat = { label: string; value: string; note?: string; noteClass?: string };

function StatStrip({ stats, children }: { stats: Stat[]; children?: ReactNode }) {
  return (
    <div className="flex divide-x divide-border rounded-xl border border-border bg-card">
      {stats.map((s) => (
        <div key={s.label} className="flex-1 px-5 py-4">
          <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
          <div className="mt-1 text-[26px] font-extrabold tracking-tight tabular-nums">{s.value}</div>
          {s.note && <div className={`text-xs ${s.noteClass ?? 'text-muted-foreground'}`}>{s.note}</div>}
        </div>
      ))}
      {children /* 역할 구성 스택 바 등 마지막 칸 */}
    </div>
  );
}
```

역할 구성 스택 바(도넛 차트 대체):

```tsx
<div className="flex-[1.3] px-5 py-4">
  <div className="text-xs font-medium text-muted-foreground">역할 구성</div>
  <div className="mt-3 flex h-[9px] overflow-hidden rounded-full">
    <div className="bg-primary" style={{ width: `${studentPct}%` }} />
    <div className="bg-info"    style={{ width: `${teacherPct}%` }} />
    <div className="bg-destructive" style={{ width: `${adminPct}%` }} />
  </div>
  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
    <Legend className="bg-primary">학생 {counts.student}</Legend>
    <Legend className="bg-info">선생님 {counts.teacher}</Legend>
    <Legend className="bg-destructive">관리자 {counts.admin}</Legend>
  </div>
</div>
```

```tsx
const Legend = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <span className={`h-[7px] w-[7px] rounded-full ${className}`} />
    {children}
  </span>
);
```

## 표 행 (64px)

기존 `TableRow` + `TableCell`의 기본 패딩이 78px를 만든다. 행 높이를 고정하고 셀 패딩을 줄인다:

```tsx
<TableRow className="h-16 hover:bg-secondary/60">
  <TableCell className="py-0 font-semibold">{u.name}</TableCell>
  <TableCell className="py-0 text-muted-foreground truncate">{u.email}</TableCell>
  <TableCell className="py-0 tabular-nums text-muted-foreground">
    {formatKoreanDate(u.created_at)}
  </TableCell>
  <TableCell className="py-0 text-right">…</TableCell>
</TableRow>
```

헤더:

```tsx
<TableHeader>
  <TableRow className="bg-secondary/70 hover:bg-secondary/70">
    <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">
      이름
    </TableHead>
    …
  </TableRow>
</TableHeader>
```

`truncate`가 동작하려면 부모에 `table-fixed`와 열 너비가 필요하다. 컬럼 폭은 각 스니펫 참조.

## 행 액션 (주 동작 1 + ⋯)

```tsx
<div className="flex items-center justify-end gap-2">
  <Button variant="outline" size="sm" className="h-8" onClick={…}>수정</Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-muted-foreground">⋯</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem className="text-destructive" onClick={…}>삭제</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

## 상태 배너 (승인 대기 등)

`border-l-4` 쓰지 않는다. 전체 테두리 + 옅은 배경:

```tsx
<div className="overflow-hidden rounded-xl border border-warning/40 bg-card">
  <div className="flex items-center gap-3 border-b border-warning/20 bg-warning/5 px-5 py-4">
    <div className="flex-1 text-[15px] font-extrabold">
      선생님 권한 신청 {pending.length}건 — 승인하면 즉시 선생님으로 전환됩니다
    </div>
    <Button variant="outline" size="sm">모두 승인</Button>
  </div>
  {/* 신청자별 행 */}
</div>
```

건수가 1이든 N이든 **같은 컴포넌트**를 쓴다 (1건 전용 레이아웃을 따로 만들지 않는다).

## 누락 값 표시

빈 값은 공백으로 두지 않고 `—`(em dash)를 `text-warning`으로 렌더한다. 값이 있으면 평상 색.

```tsx
const Missing = () => <span className="font-semibold text-warning">—</span>;

{row.translation ? <span className="text-muted-foreground">{row.translation}</span> : <Missing />}
```

이렇게 하면 배지("번역 없음")를 따로 붙이지 않아도 누락이 한눈에 보인다. 배지는 구조적 문제(문장 1개뿐 등)에만 쓴다.

단, **없어도 정상인 값에는 `Missing`을 쓰지 않는다** — 문장 은행의 힌트가 그렇다(부사 등 힌트가 필요 없는 단어가 있다). 그 자리는 중립색 `—`로 둔다:

```tsx
<span className="font-semibold text-muted-foreground">—</span>
```
