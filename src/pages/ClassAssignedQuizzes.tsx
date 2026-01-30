import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Calendar, Loader2, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { LevelBadge } from '@/components/ui/level-badge';
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

interface Assignment {
  id: string;
  quiz_id: string;
  assigned_at: string;
  quizzes: {
    id: string;
    title: string;
    difficulty: string;
    words: string[];
    words_per_set: number;
  };
}

export default function ClassAssignedQuizzes() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['classAssignedQuizzes', id],
    queryFn: async () => {
      // Fetch class name
      const { data: cls, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', id)
        .single();

      if (classError || !cls) {
        throw new Error('클래스를 찾을 수 없습니다');
      }

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('quiz_assignments')
        .select(`
          id,
          quiz_id,
          assigned_at,
          quizzes (
            id,
            title,
            difficulty,
            words,
            words_per_set
          )
        `)
        .eq('class_id', id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) {
        throw new Error('퀴즈 목록을 불러오지 못했습니다');
      }

      return {
        className: cls.name,
        assignments: (assignmentsData || []) as Assignment[],
      };
    },
    enabled: !!user && !!id,
  });

  const className = data?.className ?? '';
  const assignments = data?.assignments ?? [];

  const handleDeleteClick = (assignment: Assignment) => {
    setAssignmentToDelete(assignment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!assignmentToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .delete()
        .eq('id', assignmentToDelete.id);

      if (error) throw error;

      toast.success('퀴즈 할당이 삭제되었습니다');

      // Update cache
      queryClient.setQueryData(['classAssignedQuizzes', id], (prev: typeof data) => prev ? {
        ...prev,
        assignments: prev.assignments.filter(a => a.id !== assignmentToDelete.id)
      } : prev);
      
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.VIEW_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate(`/class/${id}`)} className="self-start mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> 클래스로 돌아가기
          </Button>

          <div className="flex items-center gap-2">
             <div className="bg-primary/10 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{className}</h1>
              <p className="text-muted-foreground">배정된 퀴즈 목록 ({assignments.length}개)</p>
            </div>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/10">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
             <p className="text-lg font-medium text-muted-foreground">배정된 퀴즈가 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="group">
                <Card className="hover:shadow-lg transition-all hover:border-primary/50 h-full">
                  <CardContent className="p-5">
                    {/* Icon + Badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <LevelBadge level={assignment.quizzes?.difficulty || 'A1'} />
                    </div>
                    
                    {/* Title */}
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
                      {assignment.quizzes?.title || '삭제된 퀴즈'}
                    </h3>
                    
                    {/* Word count · Sets */}
                    <p className="text-sm text-muted-foreground mb-3">
                      {assignment.quizzes?.words?.length || 0}개 단어 · {Math.ceil((assignment.quizzes?.words?.length || 0) / (assignment.quizzes?.words_per_set || 1))}세트
                    </p>
                    
                    {/* Word tags */}
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      {assignment.quizzes?.words?.slice(0, 5).map((word, idx) => (
                        <span 
                          key={idx} 
                          className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                        >
                          {word}
                        </span>
                      ))}
                      {(assignment.quizzes?.words?.length || 0) > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{(assignment.quizzes?.words?.length || 0) - 5}
                        </span>
                      )}
                    </div>
                    
                    {/* Date + Buttons */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(new Date(assignment.assigned_at), 'yyyy년 M월 d일', { locale: ko })}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs"
                          onClick={() => navigate(`/quiz/${assignment.quiz_id}`)}
                        >
                          문제 보기
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 text-xs"
                          onClick={() => navigate(`/quiz/${assignment.quiz_id}?tab=results`)}
                        >
                          결과 확인
                        </Button>

                        <Button variant="destructive" size="sm" 
                          className="h-8 text-xs"
                          onClick={() => handleDeleteClick(assignment)}>
                          삭제
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>퀴즈 할당 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{assignmentToDelete?.quizzes?.title}" 퀴즈의 할당을 삭제하시겠습니까?
              <br />
              <span className="text-destructive font-medium">이 작업은 되돌릴 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
