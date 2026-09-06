# 03 — 관리자 대시보드 (5a) + 사용자 관리 (5b)

## 왜 나누는가

선생님 관리는 이미 별도 페이지인데 전체 사용자 목록만 대시보드에 박혀 있어 규칙이 어긋났다. 학생/선생님 대시보드와 같은 구조로: **대시보드 = 지금 뭘 해야 하나**, **목록 = 각 관리 페이지**.

---

# 5a — 관리자 대시보드

`src/pages/AdminDashboard.tsx`

구성: 처리할 일 큐 → 지표 스트립 → 눈여겨볼 신호 / 최근 가입 (2열)

**표는 없다.** 차트도 없다 (시스템 리포트가 담당).

## 처리할 일 큐

```tsx
type QueueItem = {
  label: string; count: number; unit: string;
  desc: string; cta: string; to: string; toLabel: string;
};

const queue: QueueItem[] = [
  pendingApplications.length && {
    label: '선생님 권한 신청', count: pendingApplications.length, unit: '건',
    desc: pendingApplications.slice(0, 3).map((p) => p.name).join(' · '),
    cta: '검토하기', to: '/admin/teachers', toLabel: '선생님 관리',
  },
  unreadFeedback.length && {
    label: '읽지 않은 피드백', count: unreadFeedback.length, unit: '건',
    desc: `가장 오래된 건 ${formatKoreanDate(unreadFeedback.at(-1)?.created_at)} 접수`,
    cta: '읽기', to: '/admin/feedback', toLabel: '피드백',
  },
].filter(Boolean) as QueueItem[];
```

```tsx
<div className="flex flex-col gap-2.5">
  {queue.map((q) => (
    <div key={q.label} className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-xl border border-border bg-card px-6 py-4.5 hover:border-primary/25">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15.5px] font-extrabold">{q.label}</span>
          <span className="text-[15.5px] font-extrabold tabular-nums text-primary">{q.count}{q.unit}</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{q.desc}</div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[11.5px] text-muted-foreground">{q.toLabel}에서</span>
        <Button asChild><Link to={q.to}>{q.cta}</Link></Button>
      </div>
    </div>
  ))}
</div>
```

**빈 상태**: `queue.length === 0`이면 카드 하나로 대체.

```tsx
<div className="rounded-xl border border-border bg-card px-6 py-5">
  <div className="text-[15px] font-extrabold">지금 처리할 일이 없습니다</div>
  <div className="mt-1 text-xs text-muted-foreground">새 신청이나 피드백이 오면 여기에 표시됩니다</div>
</div>
```

헤더 부제도 건수에 따라: `처리할 일 {n}건이 기다리고 있습니다` / `모두 확인했습니다`.

## 눈여겨볼 신호

차트가 아니라 **이상하면 손대야 하는 숫자**만. 값이 정상이면 기본색, 주의가 필요하면 `text-warning`.

```tsx
const signals = [
  { label: '제출이 한 번도 없는 퀴즈', value: `${zeroSubmission}개`, note: `전체 ${totalQuizzes}개의 ${pct(zeroSubmission, totalQuizzes)}`, warn: zeroSubmission > 0 },
  { label: '퀴즈를 만들지 않은 선생님', value: `${idleTeachers}명`, note: `선생님 ${totalTeachers}명 중`, warn: idleTeachers > 0 },
  { label: '문장이 없는 레벨', value: emptyLevels.join(' · ') || '없음', note: thinLevelNote, warn: emptyLevels.length > 0 },
  { label: '최근 30일 활동 학생', value: `${activeStudents}명`, note: `전체 학생 ${totalStudents}명 중 ${pct(activeStudents, totalStudents)}`, warn: false },
];
```

```tsx
<div className="rounded-xl border border-border bg-card px-6 pb-4 pt-5">
  <div className="flex items-baseline justify-between">
    <div className="text-sm font-extrabold">눈여겨볼 신호</div>
    <Link to="/admin/report" className="text-[11.5px] text-muted-foreground">자세한 추이는 시스템 리포트</Link>
  </div>
  <div className="mt-3">
    {signals.map((s) => (
      <div key={s.label} className="flex items-baseline justify-between gap-3.5 border-b border-border/50 py-2.5 last:border-0">
        <span className="text-[13px] text-foreground/80">{s.label}</span>
        <span className="flex items-baseline gap-2 whitespace-nowrap">
          <span className={`text-[15px] font-extrabold tabular-nums ${s.warn ? 'text-warning' : ''}`}>{s.value}</span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">{s.note}</span>
        </span>
      </div>
    ))}
  </div>
</div>
```

`pct()`는 분모 0에서 `Infinity%`가 나오는 기존 버그를 막아야 한다:

```ts
export const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—');
```

## 최근 가입

```tsx
<div className="rounded-xl border border-border bg-card px-6 pb-4 pt-5">
  <div className="flex items-baseline justify-between">
    <div className="text-sm font-extrabold">최근 가입</div>
    <Link to="/admin/users" className="text-[11.5px] font-semibold text-primary">사용자 관리에서 전체 보기 →</Link>
  </div>
  <div className="mt-3">
    {recentSignups.map((u) => (
      <div key={u.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/50 py-2.5 last:border-0">
        <span className="truncate text-[13.5px] font-semibold">{u.name}</span>
        <RoleBadge role={u.role} />
        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{formatRelativeKo(u.created_at)}</span>
      </div>
    ))}
  </div>
</div>
```

## 제거할 것

- 전체 사용자 `Table` 전체 → 5b로 이동
- 도넛 차트 (`recharts` PieChart) → 지표 스트립의 스택 바
- 카드 4개 (`Card` × 4) → `StatStrip`
- 우측 사이드 카드 레일
- 역할 변경 `Select`가 행마다 있던 구조 → 5b의 `역할 변경 ⌄`

---

# 5b — 사용자 관리 (신규)

`src/pages/AdminUsers.tsx` + 라우트 `/admin/users` + 사이드바 항목 (관리자 대시보드 바로 아래)

## 구조

```tsx
<AdminLayout title="사용자 관리">
  <div className="flex items-end justify-between">
    <h1 className="text-2xl font-extrabold tracking-tight">사용자 관리</h1>
    <div className="text-xs tabular-nums text-muted-foreground">
      전체 <b className="text-foreground">{total}명</b> · 학생 {counts.student} · 선생님 {counts.teacher} · 관리자 {counts.admin}
    </div>
  </div>

  <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
    {/* 툴바: 검색 + 역할 필터 + 정렬 */}
    {/* 표: 이름 | 이메일 | 현재 역할 | 가입일 | 관리 */}
    {/* 푸터: 페이지네이션 + 내보내기 */}
  </div>
</AdminLayout>
```

컬럼 폭 (`table-fixed`):

```tsx
<colgroup>
  <col className="w-[200px]" /><col /><col className="w-[116px]" />
  <col className="w-[132px]" /><col className="w-[200px]" />
</colgroup>
```

툴바:

```tsx
<div className="flex items-center gap-3 border-b border-border px-6 py-4">
  <div className="w-[280px]">
    <SearchInput placeholder="이름 또는 이메일" value={query} onChange={setQuery} />
  </div>
  <div className="flex-1" />
  <div className="flex items-center gap-1.5">
    {(['all', 'student', 'teacher', 'admin'] as const).map((r) => (
      <button key={r} onClick={() => setRole(r)}
        className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
          role === r ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-foreground/80'
        }`}>
        {ROLE_LABEL[r]} {counts[r]}
      </button>
    ))}
    <div className="mx-1 h-5.5 w-px bg-border" />
    <Select value={sort} onValueChange={setSort}>최근 가입순</Select>
  </div>
</div>
```

행 액션은 `역할 변경 ⌄` + `⋯`(삭제). 역할 변경은 확인 다이얼로그를 띄운다 — 선생님 → 학생 강등 시 담당 클래스가 남는다는 경고 필요.

**주의:** "역할 미지정" 필터/배지를 만들지 말 것. `AuthCallback.tsx:68`에서 가입 시 `role: 'student'`로 확정된다.
