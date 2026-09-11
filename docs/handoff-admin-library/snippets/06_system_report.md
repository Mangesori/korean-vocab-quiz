# 06 — 시스템 리포트 (1d)

`src/pages/AdminReport.tsx`

## 무엇을 바꾸는가

같은 크기 카드 6개는 무엇이 중요한지 알려주지 않는다.

1. **주지표 3 + 보조 3으로 위계 분리** — 제출·정답률·활동 학생을 크게, 나머지는 스트립으로
2. **유형 분포를 많은 순으로 정렬**
3. **0값은 막대를 그리지 않는다** (C2, 9월) — 흐린 글자만

## 주지표 3

```tsx
<div className="grid grid-cols-3 gap-3.5">
  <div className="rounded-xl border border-border bg-card px-6 py-5">
    <div className="text-xs font-semibold text-muted-foreground">총 제출 수</div>
    <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums">{totalSubmissions}</div>
    <div className="text-xs text-muted-foreground">{monthlyDelta}</div>
  </div>

  <div className="rounded-xl border border-border bg-card px-6 py-5">
    <div className="text-xs font-semibold text-muted-foreground">평균 정답률</div>
    <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums text-primary">
      {pct(correct, attempted)}
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className="h-full bg-primary" style={{ width: pct(correct, attempted) }} />
    </div>
  </div>

  <div className="rounded-xl border border-border bg-card px-6 py-5">
    <div className="text-xs font-semibold text-muted-foreground">최근 30일 활동 학생</div>
    <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums">{active30}</div>
    <div className="text-xs tabular-nums text-muted-foreground">
      전체 학생 {totalStudents}명 중 {pct(active30, totalStudents)}
    </div>
  </div>
</div>
```

## 보조 지표 스트립

총 학생 수 · 총 퀴즈 수 · 제출 0건 퀴즈. 마지막 값만 `text-warning`.

```tsx
<div className="mt-3.5 flex divide-x divide-border rounded-xl border border-border bg-card">
  <Cell label="총 학생 수" value={totalStudents} />
  <Cell label="총 퀴즈 수" value={totalQuizzes} />
  <Cell label="제출 0건 퀴즈" value={zeroSubmission} warn
        suffix={`전체의 ${pct(zeroSubmission, totalQuizzes)}`} />
</div>
```

## 레벨 / 유형 분포

가로 바 2열. 정렬은 값 내림차순.

```tsx
const rows = [...distribution].sort((a, b) => b.count - a.count);
```

```tsx
{rows.map((r) => (
  <div key={r.key} className="grid grid-cols-[104px_1fr_78px] items-center gap-3">
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[r.key]}`} />
      {STAGE_LABELS[r.key]}
    </span>
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      {r.count > 0 && (
        <div className={`h-full ${STAGE_DOT[r.key]}`} style={{ width: pct(r.count, totalQuizzes) }} />
      )}
    </div>
    <span className={`text-right text-xs tabular-nums ${r.count > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
      {r.count > 0 ? `${r.count}개 ${pct(r.count, totalQuizzes)}` : '없음'}
    </span>
  </div>
))}
```

CEFR 분포도 같은 구조. 레벨 배지는 `.level-badge` 베이스를 쓴다.

`STAGE_DOT`은 정적 맵이다 — 동적 `bg-type-${x}`는 Tailwind JIT가 버린다. 정의는 `snippets/02` 하단 참고.

## 월별 제출 추이

`recharts` 대신 flex 막대로 충분하다 (6개 값). 0인 달은 막대를 렌더하지 않는다.

리포트에서 `recharts`를 쓰던 곳이 이 차트와 대시보드 도넛뿐이었다면 의존성을 제거할 수 있다 — `npm ls recharts`로 다른 사용처를 확인한 뒤 정리한다.

```tsx
const max = Math.max(...monthly.map((m) => m.count), 1);

<div className="flex h-[132px] items-end gap-3.5 border-b border-border pt-1.5">
  {monthly.map((m) => (
    <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
      <span className={`text-[11.5px] font-semibold tabular-nums ${
        m.count === max ? 'text-foreground' : m.count === 0 ? 'text-muted-foreground/50' : 'text-muted-foreground'
      }`}>
        {m.count}건
      </span>
      {m.count > 0 && (
        <div className={`w-full max-w-[46px] rounded-t-md ${m.count === max ? 'bg-primary' : 'bg-primary/25'}`}
             style={{ height: `${(m.count / max) * 100}%` }} />
      )}
    </div>
  ))}
</div>
<div className="mt-2 flex gap-3.5">
  {monthly.map((m) => (
    <span key={m.label} className="flex-1 text-center text-[11.5px] text-muted-foreground">{m.label}</span>
  ))}
</div>
```

최고치만 진한 primary, 나머지는 `bg-primary/25`. 최고치가 여럿이면 모두 진하게 두고, 헤더에 `최고 {max}건 · {labels}`로 병기한다.
