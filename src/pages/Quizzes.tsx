import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  FileText,
  Clock,
  Search,
  Loader2,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LevelBadge } from '@/components/ui/level-badge';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { QuizResultsDialog } from "@/components/quiz/QuizResultsDialog";
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

interface Quiz {
  id: string;
  title: string;
  words: string[];
  words_per_set: number;
  difficulty: string;
  created_at: string;
}

export default function Quizzes() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedQuizForResult, setSelectedResult] = useState<Quiz | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['quizzes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quizzes')
        .select('id, title, words, words_per_set, difficulty, created_at')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as Quiz[];
    },
    enabled: !!user && can(PERMISSIONS.CREATE_QUIZ),
  });

  const handleDeleteClick = (e: React.MouseEvent, quiz: Quiz) => {
    e.preventDefault();
    e.stopPropagation();
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizToDelete.id);

      if (error) throw error;

      toast.success('퀴즈가 삭제되었습니다');

      // Update cache
      queryClient.setQueryData(['quizzes', user?.id], (prev: Quiz[] | undefined) =>
        prev?.filter(q => q.id !== quizToDelete.id) ?? []
      );
      
      setDeleteDialogOpen(false);
      setQuizToDelete(null);
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('퀴즈 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
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

  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.words.some(word => word.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">퀴즈 목록</h1>
            <p className="text-muted-foreground mt-1">생성한 모든 퀴즈를 관리하세요</p>
          </div>
          <Link to="/quiz/create">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              새 퀴즈 만들기
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="퀴즈 제목 또는 단어로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? '검색 결과가 없습니다' : '아직 생성된 퀴즈가 없습니다'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? '다른 검색어로 시도해보세요' : 'AI를 활용해 첫 번째 퀴즈를 만들어보세요'}
              </p>
              {!searchQuery && (
                <Link to="/quiz/create">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    새 퀴즈 만들기
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredQuizzes.map((quiz) => (
              <Link key={quiz.id} to={`/quiz/${quiz.id}`}>
                <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <LevelBadge level={quiz.difficulty} />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      {quiz.words.slice(0, 5).map((word, idx) => (
                        <span 
                          key={idx} 
                          className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                        >
                          {word}
                        </span>
                      ))}
                      {quiz.words.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{quiz.words.length - 5}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(new Date(quiz.created_at), 'yyyy년 M월 d일', { locale: ko })}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedResult(quiz);
                          }}
                        >
                          결과 확인
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={(e) => handleDeleteClick(e, quiz)}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <QuizResultsDialog 
        quizId={selectedQuizForResult?.id || null}
        quizTitle={selectedQuizForResult?.title || ""}
        open={!!selectedQuizForResult}
        onOpenChange={(open) => !open && setSelectedResult(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>퀴즈 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 "{quizToDelete?.title || '이 퀴즈'}"를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 모든 할당 정보와 결과도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
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
