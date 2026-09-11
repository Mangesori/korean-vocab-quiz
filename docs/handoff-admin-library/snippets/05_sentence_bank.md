# 05 — 문장 은행 관리 (4b)

`src/pages/AdminSentenceBank.tsx`

## 왜 표를 버리는가

7칸 표에서는 문장과 번역이 모두 잘렸다(`…`). 그리고 정답은 문장의 일부이므로 컬럼을 따로 두면 **같은 글자를 두 번** 쓰면서 정작 문장이 잘린다.

바꾼 것:

1. 정답 컬럼 제거 → **문장 안에서 정답 범위를 강조**
2. 문장·번역을 두 줄로 두어 **전체 길이 그대로**
3. 편집 다이얼로그에만 있던 **단어 뜻·힌트를 목록에 노출**
4. 누락은 `—`로 표시 → **한눈에 보이므로 배지 불필요**
5. 필터에 "번역 없음 / 뜻 없음 / 힌트 없음 / 문장 1개뿐인 단어"
6. 선택 후 일괄 삭제 (전체 선택 = **이 페이지만**)

## 정답 하이라이트

정답은 조사·어미를 포함한 형태다: `박물관은`, `운전할 수 없어요`, `미루면`, `분리수거를`.

```tsx
/** 문장에서 정답 범위를 찾아 [앞, 정답, 뒤]로 나눈다 */
export function splitAnswer(sentence: string, answer: string) {
  const i = sentence.indexOf(answer);
  if (i === -1) return { pre: sentence, ans: '', post: '' };
  return {
    pre: sentence.slice(0, i),
    ans: answer,
    post: sentence.slice(i + answer.length),
  };
}
```

```tsx
const { pre, ans, post } = splitAnswer(row.sentence, row.answer);

<div className="text-sm leading-relaxed">
  {pre}<span className="font-extrabold text-primary">{ans}</span>{post}
</div>
```

배경(`bg-accent`)은 넣지 않는다 — 초록 굵은 글자로 충분하고, 배경을 넣으면 조사가 떨어져 보인다.

`indexOf`가 실패하면(정규화 차이 등) 하이라이트 없이 문장만 렌더한다. 조용히 실패하되, 개발 중에는 `console.warn`으로 데이터 문제를 드러낼 것.

## 행 레이아웃

```tsx
<div className={`grid grid-cols-[22px_176px_1fr_116px] items-start gap-4.5 border-b border-border/50 px-5 py-4
                 ${selected ? 'bg-accent/40' : 'bg-card'} hover:bg-secondary/40`}>
  <Checkbox className="mt-0.5 rounded-md" checked={selected} onCheckedChange={toggle} />

  {/* 1열: 단어 · 레벨 · 뜻 · 출처 */}
  <div className="min-w-0">
    <div className="flex items-baseline gap-2">
      <span className="text-[14.5px] font-extrabold">{row.word}</span>
      <span className="text-[11px] font-extrabold text-muted-foreground">{row.level}</span>
    </div>
    <div className="mt-0.5 text-xs font-semibold">
      {row.meaning ? <span className="text-muted-foreground">{row.meaning}</span> : <Missing />}
    </div>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <SourceBadge source={row.source} />
      {row.sentence_count === 1 && (
        <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10.5px] font-extrabold text-warning">
          문장 1개뿐
        </span>
      )}
    </div>
  </div>

  {/* 2열: 문장 · 번역 · 힌트/작성자 */}
  <div className="min-w-0">
    <div className="text-sm leading-relaxed">
      {pre}<span className="font-extrabold text-primary">{ans}</span>{post}
    </div>

    <div className="mt-1 text-xs font-semibold leading-snug">
      {row.translation ? <span className="text-muted-foreground">{row.translation}</span> : <Missing />}
    </div>

    <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5 text-xs">
      <span className="flex items-baseline gap-1.5">
        <span className="shrink-0 font-extrabold text-muted-foreground">힌트</span>
        {row.hint
          ? <span className="font-semibold">{row.hint}</span>
          : <span className="font-semibold text-muted-foreground">—</span>}
      </span>
      <span className="text-border">|</span>
      <span className="text-[11.5px] text-muted-foreground">
        {row.creator_name}<span className="mx-1.5 text-border">·</span>{sourceLabel(row)}
      </span>
    </div>
  </div>

  {/* 3열: 액션 */}
  <div className="flex items-center justify-end gap-2">
    <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(row)}>수정</Button>
    <RowMenu onDelete={() => remove(row.id)} />
  </div>
</div>
```

힌트는 **있음/없음이 아니라 실제 값**을 보여준다 (`은/는`, `-(으)ㄹ 수 있다/없다 + 아/어요`, `-는`, `-(으)면`). 없으면 `—`가 남아 누락이 즉시 드러난다.

## 출처 표기

```tsx
const SourceBadge = ({ source }: { source: 'import' | 'quiz' }) => (
  <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold ${
    source === 'import' ? 'bg-info/10 text-info' : 'bg-secondary text-muted-foreground'
  }`}>
    {source === 'import' ? '일괄 등록' : '퀴즈'}
  </span>
);

/** 일괄 등록 → 배치 라벨, 퀴즈 → 퀴즈 제목 (해당 퀴즈로 링크) */
const sourceLabel = (row: BankRow) =>
  row.source === 'import' ? row.batch_label : row.origin_quiz_title;
```

퀴즈 제목은 `/quiz/{origin_quiz_id}`로 링크할 것. 컬럼이 없으면 마이그레이션 필요 (snippets/07).

## 필터

```tsx
{/* 1행: 검색 + 드롭다운 */}
<div className="flex flex-wrap items-center gap-2">
  <SearchInput className="min-w-[200px] flex-1" placeholder="단어 또는 작성자 검색" />
  <Select>작성자</Select>
  <Select>레벨</Select>
  <Select>출처</Select>
  <Select>배치</Select>
  <Select>최신순</Select>
</div>

{/* 2행: 누락 필터 (토글) */}
<div className="mt-2.5 flex flex-wrap items-center gap-2">
  <FilterChip active={miss === 'translation'} count={counts.noTranslation} onClick={…}>번역 없음</FilterChip>
  <FilterChip active={miss === 'meaning'}     count={counts.noMeaning}     onClick={…}>뜻 없음</FilterChip>
  <FilterChip active={miss === 'hint'}        count={counts.noHint}        onClick={…}>힌트 없음</FilterChip>
  <FilterChip active={miss === 'single'}      count={counts.singleSentence} onClick={…}>문장 1개뿐인 단어</FilterChip>
</div>
```

**"힌트 없음"을 "채워야 할 것" 같은 그룹으로 묶지 말 것** — 부사처럼 힌트가 필요 없는 단어가 있어 결함으로 취급하면 오탐이다. 다른 필터와 같은 지위의 필터일 뿐이다. 같은 이유로 **행의 힌트 `—`는 중립색(`text-muted-foreground`)**이고, `text-warning`은 번역·뜻에만 쓴다 — 세 값이 모두 경고색이면 정상인 행이 결함 셋으로 읽힌다.

작성자는 검색창(자유 입력)과 드롭다운(정해진 선생님 목록) 둘 다 지원한다 — 드롭다운이 오타 없이 더 빠르다.

## 선택 / 일괄 삭제

전체 선택은 **이 페이지만**. 삭제가 붙은 동작이므로 기본이 안전해야 한다.

```tsx
{/* 표 헤더 = 전체 선택 줄 */}
<div className="grid grid-cols-[22px_176px_1fr_116px] items-center gap-4.5 border-b border-border bg-secondary/70 px-5 py-2.5">
  <Checkbox className="rounded-md" checked={allOnPage} indeterminate={someOnPage} onCheckedChange={toggleAllOnPage} />
  <span className="text-[11.5px] font-extrabold">이 페이지 전체 선택</span>
  <span className="text-[11.5px] tabular-nums text-muted-foreground">
    {rows.length}개 중 {selectedOnPage}개 선택됨
  </span>
  <span className="text-right text-[11px] font-extrabold tracking-wide text-muted-foreground">관리</span>
</div>
```

선택 바 (선택이 있을 때만):

```tsx
<div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-card px-5 py-3">
  <span className="text-[13px] font-semibold tabular-nums text-primary">
    이 페이지에서 {selectedOnPage}개 선택됨
  </span>
  <button className="text-xs font-semibold underline tabular-nums" onClick={selectAllMatching}>
    검색 결과 {totalMatching}개 모두 선택
  </button>
  <div className="flex-1" />
  <button className="text-xs font-semibold" onClick={clear}>선택 해제</button>
  <Button variant="destructive" size="sm" onClick={confirmBulkDelete}>선택 삭제</Button>
</div>
```

`검색 결과 N개 모두 선택`은 별도 한 단계 — 누르면 선택 바 문구가 `검색 결과 191개 전체 선택됨`으로 바뀌고, 삭제 확인 다이얼로그에 건수를 명시한다.

## 커버리지 스트립

퍼센트·확보 수·기준을 세 번 반복하지 않는다. **확보 수 + 부족 수**만.

```tsx
<div className="flex divide-x divide-border rounded-xl border border-border bg-card">
  {coverage.map((c) => (
    <div key={c.level} className="flex-1 px-4.5 py-4">
      <div className="text-[11px] font-extrabold text-muted-foreground">{c.level}</div>
      <div className="mt-0.5 text-[19px] font-extrabold tabular-nums">
        {c.ready > 0 ? `${c.ready}단어` : '없음'}
      </div>
      <div className={`mt-0.5 text-[11.5px] tabular-nums ${c.total > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
        {c.total > 0 ? `${c.total - c.ready}단어 부족` : '데이터 없음'}
      </div>
    </div>
  ))}
</div>
```

"문장 2개 이상 확보"라는 기준은 헤더 요약에서 한 번만 말한다:

```tsx
<div className="text-xs tabular-nums text-muted-foreground">
  문장 <b className="text-foreground">{totalSentences}개</b>
  · 단어 <b className="text-foreground">{totalWords}개</b>
  · 문장 2개 이상 확보 <b className="text-foreground">{readyWords}단어</b>
</div>
```

## 수정 다이얼로그

기존 다이얼로그를 그대로 쓴다 (문장·정답·힌트·번역·단어 뜻). 퀴즈 편집 페이지로 이동하지 않는다 — 문장 은행은 여러 퀴즈가 공유하는 자료다.

단, **이미 만들어진 퀴즈에는 반영되지 않는다**는 점을 기억할 것 (README 참고). "퀴즈 N개에 반영됩니다" 같은 문구를 넣으면 사실과 다르다.
