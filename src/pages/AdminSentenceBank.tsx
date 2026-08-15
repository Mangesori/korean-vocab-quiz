import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Library, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const PAGE_SIZE = 50;

// 검색어 디바운스 — 300ms 안에 다시 입력하면 이전 타이머를 취소한다.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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
  const [sortBy, setSortBy] = useState<'created_desc' | 'word_asc'>('created_desc');
  const [page, setPage] = useState(0);

  // 필터가 바뀌면 첫 페이지로.
  useEffect(() => {
    setPage(0);
  }, [search, levelFilter, sourceFilter, batchLabelFilter, batchFilterActive, sortBy]);

  // ── 일괄 선택 ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 페이지·필터·정렬이 바뀌면 화면에 안 보이는 행이 선택된 채로 남지 않게 초기화.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, levelFilter, sourceFilter, batchLabelFilter, batchFilterActive, sortBy, page]);

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

  // ── 목록 ──
  const {
    data: listResult,
    isLoading: listLoading,
    isFetching: listFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['sentenceBankList', levelFilter, sourceFilter, batchLabelFilter, search, page, batchFilterActive, batchWords, sortBy],
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
      query = query.range(from, to);

      if (batchFilterActive && batchWords && batchWords.length > 0) query = query.in('word', batchWords);
      if (search.trim()) query = query.ilike('word', `%${search.trim()}%`);
      if (levelFilter !== 'all') query = query.eq('level', levelFilter);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (batchLabelFilter !== 'all') query = query.eq('batch_label', batchLabelFilter);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as SentenceBankRow[], count: count ?? 0 };
    },
    enabled,
  });

  const rows = listResult?.rows ?? [];
  const totalCount = listResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sentenceBankList'] });
    queryClient.invalidateQueries({ queryKey: ['sentenceBankCoverage'] });
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
      setBulkDeleteOpen(false);
    } catch (e) {
      console.error('Error bulk deleting sentence bank rows:', e);
      toast.error('일괄 삭제에 실패했어요');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

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
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            문장 은행 관리
          </h1>
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

        {/* 커버리지 위젯 */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {LEVELS.map((level) => {
            const row = coverage.find((c) => c.level === level);
            const total = row?.total_words ?? 0;
            const with2plus = row?.words_with_2plus ?? 0;
            return (
              <Card key={level}>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">{level}</div>
                  {coverageLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : total === 0 ? (
                    <div className="text-sm text-muted-foreground">데이터 없음</div>
                  ) : (
                    <>
                      <div className="font-mono font-bold text-[20px] leading-none text-foreground">
                        {with2plus}개
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5">문장 2개 이상 확보</div>
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5">(전체 {total}단어 중)</div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 목록 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>문장 목록</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="단어 검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9 w-full sm:w-56"
                  />
                </div>
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
                    <SelectItem value="import">import</SelectItem>
                    <SelectItem value="quiz">quiz</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={batchLabelFilter} onValueChange={setBatchLabelFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="전체 배치" /></SelectTrigger>
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
                {selectedIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {selectedIds.size}개 삭제
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={() => refetchList()} disabled={listFetching}>
                  <RefreshCw className={`h-4 w-4 ${listFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : rows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {search || levelFilter !== 'all' || sourceFilter !== 'all' ? '검색 결과가 없습니다' : '문장이 없습니다'}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={(checked) => toggleSelectAllOnPage(!!checked)}
                            aria-label="이 페이지 전체 선택"
                          />
                        </TableHead>
                        <TableHead className="w-[100px]">단어</TableHead>
                        <TableHead className="w-[70px]">레벨</TableHead>
                        <TableHead className="w-[35%]">문장</TableHead>
                        <TableHead className="w-[120px]">정답</TableHead>
                        <TableHead className="w-[30%]">번역</TableHead>
                        <TableHead className="w-[60px] text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => openEdit(row)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={(checked) => toggleSelectRow(row.id, !!checked)}
                              aria-label={`${row.word} 선택`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{row.word}</TableCell>
                          <TableCell>{row.level}</TableCell>
                          <TableCell className="line-clamp-2 whitespace-normal break-words">{row.sentence}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{row.answer}</TableCell>
                          <TableCell className="line-clamp-2 whitespace-normal break-words text-muted-foreground">{row.translation || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeletingRow(row); }}
                              aria-label="문장 삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between mt-4">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>문장 수정</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 flex-wrap">
              <span>{editingRow?.word} · {editingRow?.level} · 순서 {editingRow?.seq}</span>
              {editingRow && (
                <Badge variant={editingRow.source === 'import' ? 'default' : 'secondary'} className="text-xs">
                  {editingRow.source}
                </Badge>
              )}
              {editingRow?.created_at && (
                <span>· {formatDateShort(editingRow.created_at)} 생성</span>
              )}
              {editingRow?.batch_label && (
                <Badge variant="outline" className="text-xs">{editingRow.batch_label}</Badge>
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
