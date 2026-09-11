# 02 — 퀴즈 라이브러리 (2a)

`src/pages/SharedQuizzes.tsx`

## 무엇을 바꾸는가

| 기존 | 변경 |
|---|---|
| 표 헤더 6칸 + 얇은 행 | 넉넉한 리스트 행 (제목 19px) |
| 미리보기 = 팝업만 | 행 인라인 확장 (팝업 제거) |
| 제목 검색만 | 단어까지 검색 + 자동완성 + 걸린 단어 표시 |
| 레벨 필터 | 레벨 + 퀴즈 유형 + 정렬 |

핵심: 제목이 보조 정보와 같은 크기였던 게 "밋밋함"의 원인. 색을 더하지 말고 **타이프 위계**로 해결한다.

## 행 컴포넌트

```tsx
function LibraryRow({ quiz, expanded, onToggle, matchedWords }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto] items-center gap-5 px-6 py-5 hover:bg-secondary/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <LevelBadge level={quiz.level} />
            <span className="truncate text-[19px] font-extrabold tracking-tight">{quiz.title}</span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <span>{quiz.teacher_name} 선생님</span><Dot />
            <span>단어 {quiz.word_count}개</span><Dot />
            <span>{formatKoreanDate(quiz.created_at)}</span>
            {quiz.copy_count > 0 && (<><Dot /><span className="font-semibold text-primary">복사 {quiz.copy_count}회</span></>)}
          </div>

          {matchedWords.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-muted-foreground">검색어 포함 단어</span>
              {matchedWords.map((w) => (
                <span key={w} className="rounded-md bg-accent px-2 py-0.5 text-[11.5px] font-extrabold text-primary">{w}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={onToggle}>
            문장 보기 <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
          <Button onClick={() => copyQuiz(quiz.id)}>내 퀴즈로 복사</Button>
        </div>
      </div>

      {expanded && <LibraryRowDetail quiz={quiz} />}
    </div>
  );
}

const Dot = () => <span className="text-border">·</span>;
```

`expanded`는 **Set**으로 관리한다 (여러 퀴즈를 동시에 펼쳐 비교하는 것이 이 설계의 목적):

```tsx
const [expanded, setExpanded] = useState<Set<string>>(new Set());
const toggle = (id: string) =>
  setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
```

## 확장 영역

```tsx
function LibraryRowDetail({ quiz }: { quiz: SharedQuiz }) {
  const { data: preview } = useQuizPreview(quiz.id);   // 펼칠 때만 fetch
  return (
    <div className="border-t border-border bg-secondary/40 px-6 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-extrabold text-muted-foreground">포함 유형</span>
        {quiz.stages.map((s) => <StageChip key={s} stage={s} />)}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {preview?.slice(0, 4).map((p) => (
          <div key={p.id} className="flex items-baseline gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11.5px] font-extrabold text-primary">{p.word}</span>
            <span className="text-[13px] leading-snug text-foreground/80">{p.sentence}</span>
          </div>
        ))}
      </div>

      <button className="mt-3 text-xs font-semibold text-primary tabular-nums">
        문장 {quiz.word_count}개 전체 보기 →
      </button>
    </div>
  );
}
```

유형 칩은 `--type-*` 토큰을 씀 (`STAGE_LABELS` + `type-{stage}` 클래스):

```tsx
const StageChip = ({ stage }: { stage: BaseStage }) => (
  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-0.5 text-[11.5px] font-semibold">
    <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage]}`} />
    {STAGE_LABELS[stage]}
  </span>
);
```

## ⚠ 유형 색 클래스는 정적 목록으로

`bg-type-${stage}` 같은 동적 클래스는 **Tailwind가 버린다** (JIT가 소스에서 문자열을 모든다). 항상 정적 맵을 쓴다 — `src/types/quiz.ts` 옆에 둔다:

```ts
export const STAGE_DOT: Record<BaseStage, string> = {
  fill_blank:      'bg-type-fill-blank',
  matchup:         'bg-type-matchup',
  type_answer:     'bg-type-type-answer',
  word_magnet:     'bg-type-word-magnet',
  sentence_making: 'bg-type-sentence-making',
  recording:       'bg-type-recording',
};

export const STAGE_TEXT: Record<BaseStage, string> = {
  fill_blank:      'text-type-fill-blank',
  matchup:         'text-type-matchup',
  type_answer:     'text-type-type-answer',
  word_magnet:     'text-type-word-magnet',
  sentence_making: 'text-type-sentence-making',
  recording:       'text-type-recording',
};
```

토큰은 `src/index.css`에 이미 있고(`--type-*`) `tailwind.config.ts`에 `type.*`로 들어가 있다. 새 색을 만들지 말 것.

## 검색

```tsx
const [query, setQuery] = useState('');
const debounced = useDebounce(query, 200);
```

두 가지가 필요하다:

1. **자동완성** — 입력값으로 단어/제목을 나눠 제안. 흐름 안에서 아래로 밀어내는 형태(absolute overlay 금지 — 아래 필터 칩과 겹친다).
2. **걸린 단어 표시** — 결과 행에 어떤 단어가 매치됐는지. 쿼리에서 함께 받아야 한다 (snippets/07).

```tsx
{suggestions.length > 0 && (
  <div className="mt-2 rounded-xl border border-border bg-card p-1.5 shadow-lg">
    {suggestions.map((s) => (
      <button key={s.key} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-secondary">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
          s.kind === 'word' ? 'bg-accent text-primary' : 'bg-secondary text-foreground/70'
        }`}>
          {s.kind === 'word' ? '단어' : '제목'}
        </span>
        <span className="text-[13.5px]">{s.label}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">퀴즈 {s.count}개</span>
      </button>
    ))}
  </div>
)}
```

## 필터 바

```tsx
<div className="mt-5 flex flex-wrap items-center gap-2">
  <Select>레벨 전체</Select>

  {selectedStages.map((s) => (
    <button key={s} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-accent px-3.5 py-2.5 text-xs font-semibold text-primary">
      <span className={`h-1.5 w-1.5 rounded-full bg-type-${kebab(s)}`} />
      {STAGE_LABELS[s]} 포함
      <X className="h-3 w-3" />
    </button>
  ))}
  <StagePicker>유형 추가 +</StagePicker>

  <div className="flex-1" />
  <Select>복사 많은 순</Select>   {/* 최신순 · 복사 많은 순 · 단어 많은 순 */}
</div>
```

## 제거할 것

- 미리보기 `Dialog` 전체 (`previewQuiz` state, `QuizPreviewDialog` 사용처)
- `Table` / `TableHeader` / `TableRow` import
