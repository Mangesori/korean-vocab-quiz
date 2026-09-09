/**
 * 나만의 단어장 — 학생이 스스로 담은 단어 목록.
 *
 * 2026-09 개편(handoff-landing-srs/05_student_srs.md, 5c):
 *   카드 그리드 → 목록 행(테이블)으로 바꾸고, 복습 단계·다음 복습 열을 추가했다.
 *   지금까지 이 화면은 vocabulary_lists만 봤고 wrong_answer_progress(복습 진행)는
 *   전혀 몰랐다 — 같은 단어를 다루면서 두 화면이 서로 연결되지 않는 문제였다.
 *   두 테이블 다 (student_id, word)로 식별되고 FK 관계는 없어서, 클라이언트에서
 *   두 쿼리를 받아 word로 매칭한다(새 마이그레이션/RPC 없이 가능 — RLS가 이미
 *   본인 행 select를 허용한다).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  BookMarked,
} from 'lucide-react';
import { toast } from 'sonner';
import { MASTER_STAGE } from '@/lib/korean/reviewSchedule';
import { SRS_STAGE_LABELS } from '@/lib/korean/srsStageLabels';

interface VocabularyItem {
  id: string;
  word: string;
  meaning: string | null;
  example_sentence: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface ReviewProgress {
  word: string;
  stage: number;
  due_at: string | null;
  mastered_at: string | null;
}

type SortOption = 'recent' | 'stage' | 'alpha' | 'due';
type StageFilter = 'all' | number;

const STAGE_FILTER_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: 'all', label: '복습 단계 전체' },
  ...Object.entries(SRS_STAGE_LABELS).map(([stage, label]) => ({
    value: Number(stage) as StageFilter,
    label,
  })),
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: '최근 추가순' },
  { value: 'stage', label: '단계순' },
  { value: 'alpha', label: '가나다순' },
  { value: 'due', label: '다음 복습 임박순' },
];

function formatDue(due_at: string | null, mastered_at: string | null): { label: string; overdue: boolean } {
  if (mastered_at) return { label: '마스터', overdue: false };
  if (!due_at) return { label: '—', overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_at);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return { label: '오늘', overdue: false };
  if (diffDays > 0) return { label: `${diffDays}일 후`, overdue: false };
  return { label: `${Math.abs(diffDays)}일 지남`, overdue: true };
}

export default function VocabularyList() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState({ word: '', meaning: '', example_sentence: '', notes: '' });
  const [editingItem, setEditingItem] = useState<VocabularyItem | null>(null);
  const [editDraft, setEditDraft] = useState({ meaning: '', example_sentence: '', notes: '' });
  const [deletingItem, setDeletingItem] = useState<VocabularyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: vocabulary, isLoading } = useQuery({
    queryKey: ['vocabulary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vocabulary_lists')
        .select('id, word, meaning, example_sentence, notes, is_favorite, created_at')
        .eq('student_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VocabularyItem[];
    },
    enabled: !!user?.id,
  });

  // 복습 진행 — vocabulary_lists와 FK로 안 이어져 있어 word로 매칭한다.
  const { data: reviewProgress } = useQuery({
    queryKey: ['wa-progress-for-vocab', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wrong_answer_progress')
        .select('word, stage, due_at, mastered_at')
        .eq('student_id', user!.id);
      if (error) throw error;
      return data as ReviewProgress[];
    },
    enabled: !!user?.id,
  });

  const progressByWord = useMemo(() => {
    const map = new Map<string, ReviewProgress>();
    reviewProgress?.forEach((p) => map.set(p.word, p));
    return map;
  }, [reviewProgress]);

  const addMutation = useMutation({
    mutationFn: async (wordData: typeof newWord) => {
      const { error } = await supabase.from('vocabulary_lists').insert({
        student_id: user!.id,
        word: wordData.word,
        meaning: wordData.meaning || null,
        example_sentence: wordData.example_sentence || null,
        notes: wordData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      setIsAddDialogOpen(false);
      setNewWord({ word: '', meaning: '', example_sentence: '', notes: '' });
      toast.success('단어를 추가했어요');
    },
    onError: () => {
      toast.error('단어를 추가하지 못했어요');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: typeof editDraft }) => {
      const { error } = await supabase
        .from('vocabulary_lists')
        .update({
          meaning: draft.meaning || null,
          example_sentence: draft.example_sentence || null,
          notes: draft.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      setEditingItem(null);
      toast.success('단어를 수정했어요');
    },
    onError: () => {
      toast.error('단어를 수정하지 못했어요');
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from('vocabulary_lists')
        .update({ is_favorite: !is_favorite })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
    onError: () => {
      toast.error('즐겨찾기를 변경하지 못했어요');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vocabulary_lists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      toast.success('단어를 삭제했어요');
    },
    onError: () => {
      toast.error('단어를 삭제하지 못했어요');
    },
  });

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    } catch (e) {
      // 실패 토스트는 deleteMutation.onError에서 처리 — 재시도할 수 있게 다이얼로그는 열어 둔다
      console.error('Error deleting vocabulary item:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (item: VocabularyItem) => {
    setEditingItem(item);
    setEditDraft({
      meaning: item.meaning ?? '',
      example_sentence: item.example_sentence ?? '',
      notes: item.notes ?? '',
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'student') {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredVocabulary = (vocabulary ?? [])
    .filter((item) => {
      const matchesSearch =
        item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.meaning?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorite = !showFavoritesOnly || item.is_favorite;
      const progress = progressByWord.get(item.word);
      const stage = progress?.mastered_at ? MASTER_STAGE : progress?.stage ?? null;
      const matchesStage = stageFilter === 'all' || stage === stageFilter;
      return matchesSearch && matchesFavorite && matchesStage;
    })
    .sort((a, b) => {
      const pa = progressByWord.get(a.word);
      const pb = progressByWord.get(b.word);
      switch (sortOption) {
        case 'alpha':
          return a.word.localeCompare(b.word, 'ko');
        case 'stage': {
          const sa = pa?.mastered_at ? MASTER_STAGE : pa?.stage ?? -1;
          const sb = pb?.mastered_at ? MASTER_STAGE : pb?.stage ?? -1;
          return sb - sa;
        }
        case 'due': {
          const da = pa?.mastered_at ? Infinity : pa?.due_at ? new Date(pa.due_at).getTime() : Infinity;
          const db = pb?.mastered_at ? Infinity : pb?.due_at ? new Date(pb.due_at).getTime() : Infinity;
          return da - db;
        }
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const totalCount = vocabulary?.length ?? 0;
  const graduatedCount = vocabulary?.filter((v) => progressByWord.get(v.word)?.mastered_at).length ?? 0;
  const reviewingCount = vocabulary?.filter((v) => {
    const p = progressByWord.get(v.word);
    return p && !p.mastered_at;
  }).length ?? 0;

  const isFiltering = !!searchTerm || showFavoritesOnly || stageFilter !== 'all';

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold pl-2">
              나만의 단어장
            </h1>
            <p className="text-muted-foreground mt-1">
              저장한 단어 {totalCount}개 · 복습 중 {reviewingCount}개 · 졸업 {graduatedCount}개
              {isFiltering && ` · 표시 중 ${filteredVocabulary.length}개`}
            </p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                단어 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 단어 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="word">단어 *</Label>
                  <Input
                    id="word"
                    value={newWord.word}
                    onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                    placeholder="한국어 단어"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meaning">의미</Label>
                  <Input
                    id="meaning"
                    value={newWord.meaning}
                    onChange={(e) => setNewWord({ ...newWord, meaning: e.target.value })}
                    placeholder="단어의 뜻"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="example">예문</Label>
                  <Textarea
                    id="example"
                    value={newWord.example_sentence}
                    onChange={(e) => setNewWord({ ...newWord, example_sentence: e.target.value })}
                    placeholder="예문을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">메모</Label>
                  <Textarea
                    id="notes"
                    value={newWord.notes}
                    onChange={(e) => setNewWord({ ...newWord, notes: e.target.value })}
                    placeholder="추가 메모"
                  />
                </div>
                <Button
                  onClick={() => addMutation.mutate(newWord)}
                  disabled={!newWord.word || addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  추가하기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="단어 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Star className="h-4 w-4 mr-2" />
            즐겨찾기
          </Button>
          <Select
            value={String(stageFilter)}
            onValueChange={(v) => setStageFilter(v === 'all' ? 'all' : Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredVocabulary.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookMarked className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isFiltering
                  ? '검색 결과가 없습니다.'
                  : '아직 저장한 단어가 없습니다. 단어를 추가해보세요!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {/* 헤더 행 — 문서 지정 열 폭: 168 | 1fr | 96 | 108 | 76, gap 14px */}
            <div
              className="hidden md:grid px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/60 bg-muted/30"
              style={{ gridTemplateColumns: '168px minmax(0,1fr) 96px 108px 76px', gap: '14px' }}
            >
              <span>단어</span>
              <span>뜻 · 예문</span>
              <span>복습 단계</span>
              <span>다음 복습</span>
              <span />
            </div>

            <div className="divide-y divide-border/60">
              {filteredVocabulary.map((item) => {
                const progress = progressByWord.get(item.word);
                const stage = progress?.mastered_at ? MASTER_STAGE : progress?.stage;
                const stageLabel = stage !== undefined ? SRS_STAGE_LABELS[stage] : null;
                const isAdvanced = stage === MASTER_STAGE || stage === 5;
                const due = progress ? formatDue(progress.due_at, progress.mastered_at) : null;
                const missingSentence = !item.example_sentence;

                return (
                  <div
                    key={item.id}
                    className="grid gap-x-3.5 gap-y-1.5 items-start px-4 py-3 group"
                    style={{ gridTemplateColumns: '168px minmax(0,1fr) 96px 108px 76px' }}
                  >
                      <button
                        type="button"
                        onClick={() =>
                          toggleFavoriteMutation.mutate({ id: item.id, is_favorite: item.is_favorite })
                        }
                        className="flex items-center gap-1.5 text-left min-w-0"
                      >
                        <Star
                          className={`h-4 w-4 shrink-0 ${
                            item.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                          }`}
                        />
                        <span className="font-medium text-foreground truncate">{item.word}</span>
                      </button>

                      <div className="min-w-0">
                        {item.meaning && (
                          <p className="text-sm text-foreground truncate">{item.meaning}</p>
                        )}
                        {item.example_sentence && (
                          <p className="text-xs text-muted-foreground truncate italic">
                            "{item.example_sentence}"
                          </p>
                        )}
                        {missingSentence && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            ⓘ 예문이 없어 복습에서 빠져요
                          </p>
                        )}
                      </div>

                      <div>
                        {stageLabel ? (
                          <span
                            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={
                              isAdvanced
                                ? { backgroundColor: '#DCF0E4', color: '#1F6B48' }
                                : { backgroundColor: '#F4F0EA', color: '#6B635E' }
                            }
                          >
                            {stageLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      <div>
                        {due ? (
                          <span
                            className="text-xs font-medium tabular-nums"
                            style={due.overdue ? { color: '#B4831C' } : undefined}
                          >
                            {due.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-40 hover:opacity-100 transition-opacity"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-40 hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 수정 다이얼로그 — 단어 자체는 안 바뀌게(복습 진행이 word로 연결돼 있어서) 뜻·예문·메모만 */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem?.word} 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-meaning">의미</Label>
              <Input
                id="edit-meaning"
                value={editDraft.meaning}
                onChange={(e) => setEditDraft({ ...editDraft, meaning: e.target.value })}
                placeholder="단어의 뜻"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-example">예문</Label>
              <Textarea
                id="edit-example"
                value={editDraft.example_sentence}
                onChange={(e) => setEditDraft({ ...editDraft, example_sentence: e.target.value })}
                placeholder="예문을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">메모</Label>
              <Textarea
                id="edit-notes"
                value={editDraft.notes}
                onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                placeholder="추가 메모"
              />
            </div>
            <Button
              onClick={() => editingItem && editMutation.mutate({ id: editingItem.id, draft: editDraft })}
              disabled={editMutation.isPending}
              className="w-full"
            >
              {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>단어를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deletingItem?.word}</span>
              {' '}단어가 뜻·예문·메모와 함께 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
