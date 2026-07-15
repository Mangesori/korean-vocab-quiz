import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Plus,
  Search,
  Star,
  StarOff,
  Trash2,
  BookMarked,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface VocabularyItem {
  id: string;
  word: string;
  meaning: string | null;
  example_sentence: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
}

export default function VocabularyList() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState({ word: '', meaning: '', example_sentence: '', notes: '' });
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

  const filteredVocabulary = vocabulary?.filter((item) => {
    const matchesSearch =
      item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.meaning?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFavorite = !showFavoritesOnly || item.is_favorite;
    return matchesSearch && matchesFavorite;
  });

  const isFiltering = !!searchTerm || showFavoritesOnly;

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/dashboard'))}
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookMarked className="h-6 w-6 text-primary" />
              나만의 단어장
            </h1>
            <p className="text-muted-foreground mt-1">
              저장한 단어 {vocabulary?.length || 0}개
              {isFiltering && ` · 표시 중 ${filteredVocabulary?.length || 0}개`}
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

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
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
        </div>

        {filteredVocabulary?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookMarked className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || showFavoritesOnly
                  ? '검색 결과가 없습니다.'
                  : '아직 저장한 단어가 없습니다. 단어를 추가해보세요!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredVocabulary?.map((item) => (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.word}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          toggleFavoriteMutation.mutate({
                            id: item.id,
                            is_favorite: item.is_favorite,
                          })
                        }
                      >
                        {item.is_favorite ? (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.meaning && (
                    <p className="text-muted-foreground mb-2">{item.meaning}</p>
                  )}
                  {item.example_sentence && (
                    <p className="text-sm text-muted-foreground italic">
                      "{item.example_sentence}"
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                      {item.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
