import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LevelBadge } from '@/components/ui/level-badge';
import { Compass, Search, Loader2, Copy, Check, ChevronDown, Plus, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { formatDateShort } from '@/lib/formatDate';
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_DOT,
  isStageEnabled,
  type BaseStage,
} from '@/types/quiz';

type QuizRow = Database['public']['Tables']['quizzes']['Row'];

interface SharedQuiz {
  id: string;
  title: string;
  words: string[];
  difficulty: string;
  created_at: string;
  teacher_id: string;
  teacherName: string;
  stages: BaseStage[];
  copyCount: number;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

type SortOption = 'recent' | 'copies' | 'words';

const SORT_LABELS: Record<SortOption, string> = {
  recent: '최신순',
  copies: '복사 많은 순',
  words: '단어 많은 순',
};


/** 빈칸( ) 안에 정답을 채워 초록색으로 보여준다. 정답이 없으면 원문 그대로. */
function renderFilledSentence(sentence?: string, answer?: string) {
  if (!sentence) return null;
  if (!answer) return sentence;
  const parts = sentence.split(/\(\s*\)/);
  if (parts.length < 2) return sentence;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="font-bold text-primary">{answer}</span>}
        </span>
      ))}
    </>
  );
}

const Dot = () => <span className="text-border">·</span>;

const StageChip = ({ stage }: { stage: BaseStage }) => (
  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-0.5 text-[11.5px] font-semibold">
    <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage]}`} />
    {STAGE_LABELS[stage]}
  </span>
);

interface PreviewProblem {
  id?: string;
  word?: string;
  sentence?: string;
  answer?: string;
}

function useQuizPreview(quizId: string) {
  return useQuery({
    queryKey: ['sharedQuizPreview', quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('problems')
        .eq('id', quizId)
        .single();
      if (error) throw error;
      return ((data?.problems as PreviewProblem[]) ?? []).filter((p) => p.word && p.sentence);
    },
  });
}

function LibraryRowDetail({ quiz }: { quiz: SharedQuiz }) {
  const { data: preview = [], isLoading } = useQuizPreview(quiz.id);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? preview : preview.slice(0, 4);

  return (
    <div className="border-t border-border bg-secondary/40 px-6 pb-5 pt-4">
      {quiz.stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-extrabold text-muted-foreground">포함 유형</span>
          {quiz.stages.map((s) => (
            <StageChip key={s} stage={s} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : preview.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-muted-foreground">예문을 불러올 수 없습니다</p>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visible.map((p, i) => (
              <div
                key={p.id ?? i}
                className="flex items-baseline gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5"
              >
                <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11.5px] font-extrabold text-primary">
                  {p.word}
                </span>
                <span className="text-[13px] leading-snug text-foreground/80">
                  {renderFilledSentence(p.sentence, p.answer)}
                </span>
              </div>
            ))}
          </div>

          {preview.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-semibold text-primary tabular-nums"
            >
              {showAll ? '접기 ↑' : `문장 ${preview.length}개 전체 보기 →`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface LibraryRowProps {
  quiz: SharedQuiz;
  expanded: boolean;
  onToggle: () => void;
  isCopying: boolean;
  isCopied: boolean;
  onCopy: () => void;
}

function LibraryRow({ quiz, expanded, onToggle, isCopying, isCopied, onCopy }: LibraryRowProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-1 items-center gap-3 px-5 py-4 hover:bg-secondary/40 sm:grid-cols-[1fr_auto] sm:gap-5 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <LevelBadge level={quiz.difficulty} />
            <span className="truncate text-[17px] font-extrabold tracking-tight sm:text-[19px]">
              {quiz.title}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <span>{quiz.teacherName} 선생님</span>
            <Dot />
            <span>단어 {quiz.words.length}개</span>
            <Dot />
            <span>{formatDateShort(quiz.created_at)}</span>
            {quiz.copyCount > 0 && (
              <>
                <Dot />
                <span className="font-semibold text-primary">복사 {quiz.copyCount}회</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" onClick={onToggle}>
            문장 보기
            <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
          <Button type="button" disabled={isCopying || isCopied} onClick={onCopy}>
            {isCopying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCopied ? (
              <Check className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.9} />
            )}
            {isCopied ? '복사됨' : '내 퀴즈로 복사'}
          </Button>
        </div>
      </div>

      {expanded && <LibraryRowDetail quiz={quiz} />}
    </div>
  );
}

export default function SharedQuizzes() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [selectedStages, setSelectedStages] = useState<Set<BaseStage>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStage = (stage: BaseStage) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['sharedQuizzes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select(
          'id, title, words, difficulty, created_at, teacher_id, fill_blank_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, sentence_making_enabled, recording_enabled'
        )
        .eq('is_public', true)
        .neq('teacher_id', user?.id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Array<QuizRow & Record<string, unknown>>;
      const teacherIds = [...new Set(rows.map((r) => r.teacher_id))];
      const quizIds = rows.map((r) => r.id);

      const [{ data: profilesData }, { data: copyCountsData }] = await Promise.all([
        teacherIds.length
          ? supabase.from('profiles').select('user_id, name').in('user_id', teacherIds)
          : Promise.resolve({ data: [] as { user_id: string; name: string }[] }),
        quizIds.length
          ? // quiz_copy_counts는 마이그레이션으로 추가된 뷰라 생성된 Database 타입에는 없다.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from('quiz_copy_counts' as any) as any)
              .select('quiz_id, copy_count')
              .in('quiz_id', quizIds)
          : Promise.resolve({ data: [] as { quiz_id: string; copy_count: number }[] }),
      ]);

      const nameById = new Map((profilesData ?? []).map((p) => [p.user_id, p.name]));
      const copyCountById = new Map(
        ((copyCountsData ?? []) as { quiz_id: string; copy_count: number }[]).map((c) => [c.quiz_id, c.copy_count])
      );

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        words: r.words,
        difficulty: r.difficulty,
        created_at: r.created_at,
        teacher_id: r.teacher_id,
        teacherName: nameById.get(r.teacher_id) ?? '이름 없음',
        stages: STAGE_ORDER.filter((s) => isStageEnabled(s, r)),
        copyCount: copyCountById.get(r.id) ?? 0,
      })) as SharedQuiz[];
    },
    enabled: !!user && can(PERMISSIONS.CREATE_QUIZ),
  });

  const { data: myPublicQuizzes = [] } = useQuery({
    queryKey: ['myPublicQuizzes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title')
        .eq('teacher_id', user?.id ?? '')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && can(PERMISSIONS.CREATE_QUIZ),
  });

  const filteredQuizzes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = quizzes
      .filter((quiz) => !q || quiz.title.toLowerCase().includes(q))
      .filter((quiz) => levelFilter === 'all' || quiz.difficulty === levelFilter)
      .filter((quiz) => [...selectedStages].every((s) => quiz.stages.includes(s)));

    const sorted = [...result];
    if (sortBy === 'copies') {
      sorted.sort((a, b) => b.copyCount - a.copyCount);
    } else if (sortBy === 'words') {
      sorted.sort((a, b) => b.words.length - a.words.length);
    } else {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [quizzes, searchQuery, levelFilter, selectedStages, sortBy]);

  const handleCopy = async (quiz: SharedQuiz) => {
    if (!user) return;
    setCopyingId(quiz.id);
    try {
      // 자식 표(matchup_problems 등)의 RLS 정책이 "퀴즈 소유 선생님만 SELECT"라서
      // 클라이언트에서 직접 복사하면 항상 빈 배열이 돌아온다(빈칸 채우기 외 나머지
      // 유형이 0문제로 복사되는 버그). SECURITY DEFINER RPC로 서버에서 한 번에 복사한다.
      // copy_shared_quiz는 아직 생성된 Database 타입에 없다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: copyError } = await (supabase.rpc as any)('copy_shared_quiz', { _quiz_id: quiz.id });
      if (copyError) throw copyError;

      toast.success(`"${quiz.title}"을(를) 내 퀴즈로 복사했어요`);
      setCopiedIds((prev) => new Set(prev).add(quiz.id));
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['sharedQuizzes'] });
    } catch (error) {
      console.error('Error copying quiz:', error);
      toast.error('퀴즈 복사에 실패했습니다');
    } finally {
      setCopyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.CREATE_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  const unselectedStages = STAGE_ORDER.filter((s) => !selectedStages.has(s));
  const hasFilters = searchQuery || levelFilter !== 'all' || selectedStages.size > 0;

  return (
    <AppLayout>
      <div className="bg-[#FAF8F5] px-[18px] sm:px-[30px] py-[26px] sm:py-[30px]">
        <div className="flex items-center justify-between">
          <div className="text-[21px] font-bold tracking-[-0.4px] pl-2">퀴즈 라이브러리</div>
        </div>
        <p className="text-[12.5px] text-[#8A837D] mt-1 pl-2">
          다른 선생님이 공개한 퀴즈를 둘러보고 내 퀴즈로 복사해보세요
        </p>

        {myPublicQuizzes.length > 0 && (
          <div className="mt-4 pl-2">
            <p className="text-[11.5px] font-bold text-[#8A837D]">
              내가 공개한 퀴즈 {myPublicQuizzes.length}개
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {myPublicQuizzes.map((q) => (
                <Link
                  key={q.id}
                  to={`/quiz/${q.id}`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary bg-[#E8F1EB] border border-[#C8DED3] rounded-[8px] px-[11px] py-[6px] hover:bg-[#DCEBE1] transition-colors"
                >
                  {q.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 mt-[18px] flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A29B94]" />
            <Input
              placeholder="퀴즈 제목으로 검색…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-[#E3DCD3] rounded-[11px] text-[13px] h-auto py-[11px]"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-auto bg-white border-[#E3DCD3] rounded-[11px] text-[12.5px] font-semibold text-[#4A443F] h-auto py-[11px] px-3.5 gap-2">
              <SelectValue placeholder="레벨" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">레벨 전체</SelectItem>
              {LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[...selectedStages].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStage(s)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-accent px-3.5 py-2 text-xs font-semibold text-primary"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[s]}`} />
              {STAGE_LABELS[s]} 포함
              <X className="h-3 w-3" />
            </button>
          ))}

          {unselectedStages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary/60"
                >
                  <Plus className="h-3 w-3" />
                  유형 추가
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {unselectedStages.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={false}
                    onCheckedChange={() => toggleStage(s)}
                  >
                    <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${STAGE_DOT[s]}`} />
                    {STAGE_LABELS[s]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex-1" />

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-auto bg-white border-[#E3DCD3] rounded-[11px] text-[12.5px] font-semibold text-[#4A443F] h-auto py-2 px-3.5 gap-2">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <SelectItem key={opt} value={opt}>{SORT_LABELS[opt]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Compass className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {hasFilters ? '검색 결과가 없습니다' : '아직 공개된 퀴즈가 없습니다'}
              </h3>
              <p className="text-muted-foreground">
                {hasFilters
                  ? '다른 검색어나 필터로 시도해보세요'
                  : '선생님들이 퀴즈를 공개하면 여기에 모여요'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {filteredQuizzes.map((quiz) => (
              <LibraryRow
                key={quiz.id}
                quiz={quiz}
                expanded={expanded.has(quiz.id)}
                onToggle={() => toggleExpanded(quiz.id)}
                isCopying={copyingId === quiz.id}
                isCopied={copiedIds.has(quiz.id)}
                onCopy={() => handleCopy(quiz)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
