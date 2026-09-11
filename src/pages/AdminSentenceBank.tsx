import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { formatDateShort } from '@/lib/formatDate';

type SentenceBankRow = {
  id: string;
  word: string;
  meaning: string | null;
  level: string;
  seq: number;
  sentence: string;
  answer: string;
  hint: string | null;
  translation: string | null;
  source: string;
  batch_label: string | null;
  created_by: string | null;
  created_at: string;
};

type CoverageRow = { level: string; total_words: number; words_with_2plus: number };
type WordStatsRow = { word: string; level: string; sentence_count: number };

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const PAGE_SIZE = 50;
type MissFilter = 'none' | 'translation' | 'meaning' | 'hint' | 'single';

// 검색어 디바운스 — 300ms 안에 다시 입력하면 이전 타이머를 취소한다.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** 문장에서 정답 범위를 찾아 [앞, 정답, 뒤]로 나눈다. */
function splitAnswer(sentence: string, answer: string) {
  if (!answer) return { pre: sentence, ans: '', post: '' };
  const i = sentence.indexOf(answer);
  if (i === -1) {
    if (import.meta.env.DEV) {
      console.warn('[AdminSentenceBank] 정답이 문장에서 발견되지 않음:', { sentence, answer });
    }
    return { pre: sentence, ans: '', post: '' };
  }
  return {
    pre: sentence.slice(0, i),
    ans: answer,
    post: sentence.slice(i + answer.length),
  };
}

const Missing = () => <span className="font-semibold text-warning">—</span>;

const SourceBadge = ({ source }: { source: string }) => (
  <span
    className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold ${
      source === 'import' ? 'bg-info/10 text-info' : 'bg-secondary text-muted-foreground'
    }`}
  >
    {source === 'import' ? '일괄 등록' : '퀴즈'}
  </span>
);

/** 일괄 등록 → 배치 라벨, 퀴즈 등 그 외 → 생성일로 폴백 (origin_quiz_id 컬럼이 없어 퀴즈 제목 표기는 생략). */
const sourceLabel = (row: SentenceBankRow) =>
  row.source === 'import' && row.batch_label ? row.batch_label : formatDateShort(row.created_at);

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary/60'
      }`}
    >
      {children}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export default function AdminSentenceBank() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const location = useLocation();

  // QuizImport에서 "방금 저장한 것 확인하기"로 넘어오면 그 단어들만 우선 보여준다.
  const batchWords = (location.state as { words?: string[] } | null)?.words ?? null;
  const [batchFilterActive, setBatchFilterActive] = useState(!!batchWords && batchWords.length > 0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [levelFilter, setLevelFilter] = useState<'all' | (typeof LEVELS)[number]>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'import' | 'quiz'>('all');
  const [batchLabelFilter, setBatchLabelFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'word_asc'>('created_desc');
  const [missFilter, setMissFilter] = useState<MissFilter>('none');
  const [page, setPage] = useState(0);

  // 필터가 바뀌면 첫 페이지로.
  useEffect(() => {
    setPage(0);
  }, [search, levelFilter, sourceFilter, batchLabelFilter, creatorFilter, batchFilterActive, sortBy, missFilter]);

  // ── 일괄 선택 ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatchingActive, setSelectAllMatchingActive] = useState(false);
  // 페이지·필터·정렬이 바뀌면 화면에 안 보이는 행이 선택된 채로 남지 않게 초기화.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMatchingActive(false);
  }, [search, levelFilter, sourceFilter, batchLabelFilter, creatorFilter, batchFilterActive, sortBy, missFilter, page]);

  const enabled = !!user && can(PERMISSIONS.MANAGE_USERS);

  // ── 배치 라벨 목록 (필터 드롭다운용) ──
  const { data: batchLabels = [] } = useQuery({
    queryKey: ['sentenceBankBatchLabels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sentence_bank')
        .select('batch_label')
        .not('batch_label', 'is', null)
        .order('batch_label');
      if (error) throw error;
      const unique = [...new Set((data ?? []).map((r) => r.batch_label as string))];
      return unique;
    },
    enabled,
  });

  // ── 작성자 목록 (필터 드롭다운용) ──
  const { data: creatorOptions = [] } = useQuery({
    queryKey: ['sentenceBankCreatorOptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sentence_bank')
        .select('created_by')
        .not('created_by', 'is', null);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.created_by as string))];
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    },
    enabled,
  });

  // ── 커버리지 위젯 ──
  const { data: coverage = [], isLoading: coverageLoading } = useQuery({
    queryKey: ['sentenceBankCoverage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sentence_bank_coverage');
      if (error) throw error;
      return (data ?? []) as CoverageRow[];
    },
    enabled,
  });

  // ── 단어별 문장 수 (문장 1개뿐 배지·필터용) ──
  const { data: wordStats = [] } = useQuery({
    queryKey: ['sentenceBankWordStats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sentence_bank_word_stats').select('word, level, sentence_count');
      if (error) throw error;
      return (data ?? []) as WordStatsRow[];
    },
    enabled,
  });
  const sentenceCountByKey = useMemo(() => {
    const m = new Map<string, number>();
    wordStats.forEach((w) => m.set(`${w.word}__${w.level}`, w.sentence_count));
    return m;
  }, [wordStats]);
  const singleSentenceWordKeys = useMemo(
    () => new Set(wordStats.filter((w) => w.sentence_count === 1).map((w) => `${w.word}__${w.level}`)),
    [wordStats],
  );

  // ── 목록 ──
  const {
    data: listResult,
    isLoading: listLoading,
    isFetching: listFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: [
      'sentenceBankList',
      levelFilter,
      sourceFilter,
      batchLabelFilter,
      creatorFilter,
      search,
      page,
      batchFilterActive,
      batchWords,
      sortBy,
      missFilter,
      creatorOptions,
    ],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase.from('sentence_bank').select('*', { count: 'exact' });

      // created_at만으로는 대량 임포트 시 같은 시각을 가진 행이 수백 개라 순서가
      // 안정적이지 않다(페이지네이션 시 행이 겹치거나 빠질 수도 있음). word/level/seq를
      // 보조 정렬로 추가해 동률을 항상 같은 순서로 깨뜨린다.
      query =
        sortBy === 'word_asc'
          ? query.order('word', { ascending: true }).order('level', { ascending: true }).order('seq', { ascending: true })
          : query
              .order('created_at', { ascending: false })
              .order('word', { ascending: true })
              .order('level', { ascending: true })
              .order('seq', { ascending: true });

      if (batchFilterActive && batchWords && batchWords.length > 0) query = query.in('word', batchWords);
      if (search.trim()) {
        // 검색은 "단어 또는 작성자"다. 작성자 이름은 sentence_bank에 없으므로, 전체 작성자
        // 목록(creatorOptions)에서 이름이 일치하는 id를 먼저 찾아 word.ilike와 or로 묶는다.
        const q = search.trim();
        const matchingCreatorIds = creatorOptions
          .filter((c) => (c.name ?? '').toLowerCase().includes(q.toLowerCase()))
          .map((c) => c.user_id);
        const orParts = [`word.ilike.%${q}%`];
        if (matchingCreatorIds.length > 0) {
          orParts.push(`created_by.in.(${matchingCreatorIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }
      if (levelFilter !== 'all') query = query.eq('level', levelFilter);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (batchLabelFilter !== 'all') query = query.eq('batch_label', batchLabelFilter);
      if (creatorFilter !== 'all') query = query.eq('created_by', creatorFilter);

      // 누락 필터(번역/뜻/힌트 없음, 문장 1개뿐)는 단어 수 집계(sentence_bank_word_stats)가
      // 섞여 있어 서버 컬럼만으로 표현하기 어렵다. 페이지 단위 조회 후 클라이언트에서
      // 한 번 더 걸러낸다 — 목록 규모가 크지 않은 관리자 화면이라 허용 가능한 트레이드오프.
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as SentenceBankRow[], count: count ?? 0 };
    },
    enabled,
  });

  const rawRows = listResult?.rows ?? [];
  const totalCount = listResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── 작성자 이름 (현재 페이지에 등장하는 created_by만 조회) ──
  const creatorIds = [...new Set(rawRows.map((r) => r.created_by).filter((id): id is string => !!id))].sort();
  const { data: creatorProfiles = [] } = useQuery({
    queryKey: ['sentenceBankCreators', creatorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', creatorIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && creatorIds.length > 0,
  });
  const creatorNameById = new Map(creatorProfiles.map((p) => [p.user_id, p.name] as const));
  const getCreatorName = (createdBy: string | null) =>
    (createdBy && creatorNameById.get(createdBy)) || '—';

  const missCounts = useMemo(() => {
    let noTranslation = 0;
    let noMeaning = 0;
    let noHint = 0;
    let single = 0;
    rawRows.forEach((r) => {
      if (!r.translation) noTranslation++;
      if (!r.meaning) noMeaning++;
      if (!r.hint) noHint++;
      if (singleSentenceWordKeys.has(`${r.word}__${r.level}`)) single++;
    });
    return { noTranslation, noMeaning, noHint, single };
  }, [rawRows, singleSentenceWordKeys]);

  const rows = useMemo(() => {
    return rawRows.filter((r) => {
      switch (missFilter) {
        case 'translation':
          return !r.translation;
        case 'meaning':
          return !r.meaning;
        case 'hint':
          return !r.hint;
        case 'single':
          return singleSentenceWordKeys.has(`${r.word}__${r.level}`);
        default:
          return true;
      }
    });
  }, [rawRows, missFilter, singleSentenceWordKeys]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sentenceBankList'] });
    queryClient.invalidateQueries({ queryKey: ['sentenceBankCoverage'] });
    queryClient.invalidateQueries({ queryKey: ['sentenceBankWordStats'] });
    queryClient.invalidateQueries({ queryKey: ['sentenceBankBatchLabels'] });
    queryClient.invalidateQueries({ queryKey: ['sentenceBankCreatorOptions'] });
  };

  // ── 인라인 수정 ──
  const [editingRow, setEditingRow] = useState<SentenceBankRow | null>(null);
  const [editForm, setEditForm] = useState({ sentence: '', answer: '', hint: '', translation: '', meaning: '' });
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = (row: SentenceBankRow) => {
    setEditingRow(row);
    setEditForm({
      sentence: row.sentence,
      answer: row.answer,
      hint: row.hint ?? '',
      translation: row.translation ?? '',
      meaning: row.meaning ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('sentence_bank')
        .update({
          sentence: editForm.sentence,
          answer: editForm.answer,
          hint: editForm.hint || null,
          translation: editForm.translation || null,
          meaning: editForm.meaning || null,
        })
        .eq('id', editingRow.id);
      if (error) throw error;

      invalidateAll();
      toast.success('문장을 저장했어요');
      setEditingRow(null);
    } catch (e) {
      console.error('Error updating sentence bank row:', e);
      toast.error('저장하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  // ── 삭제 ──
  const [deletingRow, setDeletingRow] = useState<SentenceBankRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteRow = async () => {
    if (!deletingRow) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('sentence_bank').delete().eq('id', deletingRow.id);
      if (error) throw error;

      invalidateAll();
      toast.success('문장을 삭제했어요');
      setDeletingRow(null);
    } catch (e) {
      console.error('Error deleting sentence bank row:', e);
      toast.error('삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 일괄 삭제 ──
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase.from('sentence_bank').delete().in('id', [...selectedIds]);
      if (error) throw error;

      invalidateAll();
      toast.success(`${selectedIds.size}개 문장을 삭제했어요`);
      setSelectedIds(new Set());
      setSelectAllMatchingActive(false);
      setBulkDeleteOpen(false);
    } catch (e) {
      console.error('Error bulk deleting sentence bank rows:', e);
      toast.error('일괄 삭제에 실패했어요');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectAllMatchingActive(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectAllMatchingActive(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedOnPage = rows.filter((r) => selectedIds.has(r.id)).length;
  const allOnPageSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  // "검색 결과 전체 선택" — 서버에서 현재 필터에 맞는 id를 모두 가져온다(누락 필터·이름
  // 검색은 클라이언트 조건이라 페이지 단위로 순회하며 매칭 여부를 확인).
  const [selectAllMatchingLoading, setSelectAllMatchingLoading] = useState(false);
  const handleSelectAllMatching = async () => {
    setSelectAllMatchingLoading(true);
    try {
      let query = supabase.from('sentence_bank').select('*');
      if (batchFilterActive && batchWords && batchWords.length > 0) query = query.in('word', batchWords);
      if (levelFilter !== 'all') query = query.eq('level', levelFilter);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (batchLabelFilter !== 'all') query = query.eq('batch_label', batchLabelFilter);
      if (creatorFilter !== 'all') query = query.eq('created_by', creatorFilter);
      if (search.trim()) {
        const q = search.trim();
        const matchingCreatorIds = creatorOptions
          .filter((c) => (c.name ?? '').toLowerCase().includes(q.toLowerCase()))
          .map((c) => c.user_id);
        const orParts = [`word.ilike.%${q}%`];
        if (matchingCreatorIds.length > 0) {
          orParts.push(`created_by.in.(${matchingCreatorIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }

      const { data, error } = await query;
      if (error) throw error;
      const all = (data ?? []) as SentenceBankRow[];
      const matched = all.filter((r) => {
        switch (missFilter) {
          case 'translation':
            return !r.translation;
          case 'meaning':
            return !r.meaning;
          case 'hint':
            return !r.hint;
          case 'single':
            return singleSentenceWordKeys.has(`${r.word}__${r.level}`);
          default:
            return true;
        }
      });
      setSelectedIds(new Set(matched.map((r) => r.id)));
      setSelectAllMatchingActive(true);
    } catch (e) {
      console.error('Error selecting all matching rows:', e);
      toast.error('전체 선택에 실패했어요');
    } finally {
      setSelectAllMatchingLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMatchingActive(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.MANAGE_USERS)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="px-[18px] sm:px-[30px] py-[26px] sm:py-8 space-y-6">
        <div className="mb-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground pl-2">문장 은행 관리</h1>
          <div className="text-xs tabular-nums text-muted-foreground pl-2">
            문장 <b className="text-foreground">{totalCount}개</b>
            {' · '}단어 <b className="text-foreground">{wordStats.length}개</b>
            {' · '}문장 2개 이상 확보{' '}
            <b className="text-foreground">
              {coverage.reduce((sum, c) => sum + c.words_with_2plus, 0)}단어
            </b>
          </div>
        </div>

        {batchFilterActive && batchWords && batchWords.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-accent px-4 py-2.5">
            <span className="text-sm text-foreground">
              방금 저장한 <span className="font-semibold">{batchWords.length}개</span> 단어만 보는 중
            </span>
            <Button variant="outline" size="sm" onClick={() => setBatchFilterActive(false)}>
              전체 보기
            </Button>
          </div>
        )}

        {/* 커버리지 스트립 */}
        <div className="flex divide-x divide-border overflow-x-auto rounded-xl border border-border bg-card">
          {LEVELS.map((level) => {
            const row = coverage.find((c) => c.level === level);
            const total = row?.total_words ?? 0;
            const ready = row?.words_with_2plus ?? 0;
            return (
              <div key={level} className="flex-1 min-w-[110px] px-[18px] py-4">
                <div className="text-[11px] font-extrabold text-muted-foreground">{level}</div>
                {coverageLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <div className="mt-0.5 text-[19px] font-extrabold tabular-nums">
                      {ready > 0 ? `${ready}단어` : '없음'}
                    </div>
                    <div
                      className={`mt-0.5 text-[11.5px] tabular-nums ${
                        total > 0 ? 'text-warning' : 'text-muted-foreground'
                      }`}
                    >
                      {total > 0 ? `${total - ready}단어 부족` : '데이터 없음'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 필터 */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="단어 또는 작성자 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="작성자" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 작성자</SelectItem>
                {creatorOptions.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as typeof levelFilter)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 레벨</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 출처</SelectItem>
                <SelectItem value="import">일괄 등록</SelectItem>
                <SelectItem value="quiz">퀴즈</SelectItem>
              </SelectContent>
            </Select>
            <Select value={batchLabelFilter} onValueChange={setBatchLabelFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="전체 배치" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 배치</SelectItem>
                {batchLabels.map((label) => (
                  <SelectItem key={label} value={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">최신순</SelectItem>
                <SelectItem value="word_asc">단어순</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetchList()} disabled={listFetching}>
              <RefreshCw className={`h-4 w-4 ${listFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={missFilter === 'translation'}
              count={missCounts.noTranslation}
              onClick={() => setMissFilter((m) => (m === 'translation' ? 'none' : 'translation'))}
            >
              번역 없음
            </FilterChip>
            <FilterChip
              active={missFilter === 'meaning'}
              count={missCounts.noMeaning}
              onClick={() => setMissFilter((m) => (m === 'meaning' ? 'none' : 'meaning'))}
            >
              뜻 없음
            </FilterChip>
            <FilterChip
              active={missFilter === 'hint'}
              count={missCounts.noHint}
              onClick={() => setMissFilter((m) => (m === 'hint' ? 'none' : 'hint'))}
            >
              힌트 없음
            </FilterChip>
            <FilterChip
              active={missFilter === 'single'}
              count={missCounts.single}
              onClick={() => setMissFilter((m) => (m === 'single' ? 'none' : 'single'))}
            >
              문장 1개뿐인 단어
            </FilterChip>
          </div>
        </div>

        {/* 선택 바 (선택이 있을 때만) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-card px-5 py-3">
            <span className="text-[13px] font-semibold tabular-nums text-primary">
              {selectAllMatchingActive
                ? `검색 결과 ${selectedIds.size}개 전체 선택됨`
                : `이 페이지에서 ${selectedIds.size}개 선택됨`}
            </span>
            {!selectAllMatchingActive && totalCount > rows.length && (
              <button
                className="text-xs font-semibold underline tabular-nums disabled:opacity-50"
                onClick={handleSelectAllMatching}
                disabled={selectAllMatchingLoading}
              >
                {selectAllMatchingLoading ? '불러오는 중…' : `검색 결과 ${totalCount}개 모두 선택`}
              </button>
            )}
            <div className="flex-1" />
            <button className="text-xs font-semibold" onClick={clearSelection}>선택 해제</button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              선택 삭제
            </Button>
          </div>
        )}

        {/* 목록 */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {listLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {search || levelFilter !== 'all' || sourceFilter !== 'all' || missFilter !== 'none'
                ? '검색 결과가 없습니다'
                : '문장이 없습니다'}
            </p>
          ) : (
            <div>
              {/* 헤더 = 전체 선택 줄 */}
              <div className="grid grid-cols-[22px_176px_1fr_116px] items-center gap-[18px] border-b border-border bg-secondary/70 px-5 py-2.5">
                <Checkbox
                  className="rounded-md"
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleSelectAllOnPage(!!checked)}
                  aria-label="이 페이지 전체 선택"
                />
                <span className="text-[11.5px] font-extrabold">이 페이지 전체 선택</span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                  {rows.length}개 중 {selectedOnPage}개 선택됨
                </span>
                <span className="text-[11px] font-extrabold tracking-wide text-muted-foreground">관리</span>
              </div>

              {rows.map((row) => {
                const { pre, ans, post } = splitAnswer(row.sentence, row.answer);
                const isSingle = singleSentenceWordKeys.has(`${row.word}__${row.level}`);
                const selected = selectedIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-[22px_176px_1fr_116px] items-start gap-[18px] border-b border-border/50 px-5 py-4 last:border-b-0 ${
                      selected ? 'bg-accent/40' : 'bg-card'
                    } hover:bg-secondary/40`}
                  >
                    <Checkbox
                      className="mt-2 rounded-md"
                      checked={selected}
                      onCheckedChange={(checked) => toggleSelectRow(row.id, !!checked)}
                      aria-label={`${row.word} 선택`}
                    />

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
                        {isSingle && (
                          <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10.5px] font-extrabold text-warning">
                            문장 1개뿐
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2열: 문장 · 번역 · 힌트/작성자 */}
                    <div className="min-w-0">
                      <div className="text-sm leading-relaxed">
                        {ans ? (
                          <>
                            {pre}
                            <span className="font-extrabold text-primary">{ans}</span>
                            {post}
                          </>
                        ) : (
                          row.sentence
                        )}
                      </div>

                      <div className="mt-1 text-xs font-semibold leading-snug">
                        {row.translation ? (
                          <span className="text-muted-foreground">{row.translation}</span>
                        ) : (
                          <Missing />
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5 text-xs">
                        <span className="flex items-baseline gap-1.5">
                          <span className="shrink-0 font-extrabold text-muted-foreground">힌트</span>
                          {row.hint ? (
                            <span className="font-semibold">{row.hint}</span>
                          ) : (
                            <span className="font-semibold text-muted-foreground">—</span>
                          )}
                        </span>
                        <span className="text-border">|</span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {getCreatorName(row.created_by)}
                          <span className="mx-1.5 text-border">·</span>
                          {sourceLabel(row)}
                        </span>
                      </div>
                    </div>

                    {/* 3열: 액션 */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(row)}>
                        수정
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingRow(row)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              전체 {totalCount}건 · {page + 1} / {totalPages} 페이지
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>문장 수정</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 flex-wrap">
              <span>{editingRow?.word} · {editingRow?.level} · 순서 {editingRow?.seq}</span>
              {editingRow && <SourceBadge source={editingRow.source} />}
              {editingRow?.created_at && (
                <span>· {formatDateShort(editingRow.created_at)} 생성</span>
              )}
              {editingRow?.batch_label && (
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] font-extrabold text-muted-foreground">
                  {editingRow.batch_label}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">문장</label>
              <Textarea
                value={editForm.sentence}
                onChange={(e) => setEditForm((f) => ({ ...f, sentence: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">단어 뜻</label>
              <Input
                value={editForm.meaning}
                onChange={(e) => setEditForm((f) => ({ ...f, meaning: e.target.value }))}
                placeholder="예: close"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">정답</label>
              <Input
                value={editForm.answer}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">힌트</label>
              <Input
                value={editForm.hint}
                onChange={(e) => setEditForm((f) => ({ ...f, hint: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">번역</label>
              <Textarea
                value={editForm.translation}
                onChange={(e) => setEditForm((f) => ({ ...f, translation: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)} disabled={isSaving}>취소</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deletingRow} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>문장을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deletingRow?.word}</span>
              {' '}({deletingRow?.level}) 문장이 은행에서 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteRow(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 일괄 삭제 확인 */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.size}개 문장을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 문장이 은행에서 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
