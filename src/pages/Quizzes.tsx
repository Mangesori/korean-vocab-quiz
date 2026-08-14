import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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
  Trash2,
  Send,
  BookOpen,
  Users,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
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
import { Dialog } from '@/components/ui/dialog';
import { ShareQuizDialogContent } from '@/components/quiz/ShareQuizDialog';
import { useQuizSharing } from '@/hooks/useQuizSharing';
import { useClasses } from '@/hooks/useClasses';
import { toast } from 'sonner';
import { formatDateShort } from '@/lib/formatDate';

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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { classes } = useClasses(user?.id);
  const [selectedQuizForResult, setSelectedResult] = useState<Quiz | null>(null);
  const [selectedQuizForShare, setSelectedQuizForShare] = useState<Quiz | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 학생별 배정 취소 — class_id 없이 개인 배정된 퀴즈(어휘 보강 퀴즈 등)는 "내 클래스"
  // 화면에 안 뜨므로, 여기서 카드를 펼쳐 배정된 학생 목록을 보고 개별 취소할 수 있게 한다.
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<{ id: string; studentName: string } | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const {
    isSending,
    sendDialogOpen,
    setSendDialogOpen,
    reassignDialogOpen,
    handleConfirmReassign,
    handleCancelReassign,
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  } = useQuizSharing(selectedQuizForShare as any, user, classes as any);

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

  // 펼친 카드의 배정 학생 목록. class_members/profiles 조인 문제(PGRST200)를 피하려고
  // ClassDetail.tsx와 같은 방식으로 두 번 조회한다.
  const { data: assignmentsForExpanded = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['quiz-assignments-for-quiz', expandedQuizId],
    queryFn: async () => {
      // class_id가 있으면 학급 전체 배정(student_id는 비어 있음), student_id가 있으면
      // 개인 배정 — 이 퀴즈 안에 두 종류가 섞여 있을 수 있다.
      const { data: rows, error } = await supabase
        .from('quiz_assignments')
        .select('id, student_id, class_id, assigned_at')
        .eq('quiz_id', expandedQuizId!)
        .order('assigned_at', { ascending: false });
      if (error) throw error;

      const studentIds = [...new Set((rows ?? []).map((r) => r.student_id).filter((v): v is string => !!v))];
      const directClassIds = [...new Set((rows ?? []).map((r) => r.class_id).filter((v): v is string => !!v))];

      const [{ data: profiles }, { data: myClasses }, { data: directClasses }] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('profiles').select('user_id, name').in('user_id', studentIds)
          : Promise.resolve({ data: [] as { user_id: string; name: string }[] }),
        supabase.from('classes').select('id').eq('teacher_id', user!.id),
        directClassIds.length > 0
          ? supabase.from('classes').select('id, name').in('id', directClassIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const nameByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));
      const classNameById = new Map((directClasses ?? []).map((c) => [c.id, c.name]));

      const myClassIds = (myClasses ?? []).map((c) => c.id);
      let classIdByStudentId = new Map<string, string>();
      if (myClassIds.length > 0 && studentIds.length > 0) {
        const { data: memberRows } = await supabase
          .from('class_members')
          .select('student_id, class_id')
          .in('student_id', studentIds)
          .in('class_id', myClassIds);
        classIdByStudentId = new Map((memberRows ?? []).map((m) => [m.student_id, m.class_id]));
      }

      return (rows ?? []).map((r) =>
        r.student_id
          ? {
              id: r.id,
              displayName: nameByUserId.get(r.student_id) ?? '이름 없음',
              classId: classIdByStudentId.get(r.student_id) ?? null,
              isClassWide: false,
            }
          : {
              id: r.id,
              displayName: `전체 학급 · ${classNameById.get(r.class_id!) ?? '알 수 없는 클래스'}`,
              classId: r.class_id,
              isClassWide: true,
            }
      );
    },
    enabled: !!expandedQuizId && !!user?.id,
  });

  const handleUnassignClick = (assignmentId: string, studentName: string) => {
    setAssignmentToUnassign({ id: assignmentId, studentName });
  };

  const handleUnassignConfirm = async () => {
    if (!assignmentToUnassign) return;
    setIsUnassigning(true);
    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .delete()
        .eq('id', assignmentToUnassign.id);
      if (error) throw error;

      toast.success('배정이 취소되었습니다');
      queryClient.setQueryData(
        ['quiz-assignments-for-quiz', expandedQuizId],
        (prev: typeof assignmentsForExpanded | undefined) =>
          prev?.filter((a) => a.id !== assignmentToUnassign.id) ?? []
      );
      setAssignmentToUnassign(null);
    } catch (error) {
      console.error('Unassign error:', error);
      toast.error('배정 취소에 실패했습니다');
    } finally {
      setIsUnassigning(false);
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              내 퀴즈
            </h1>
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
          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredQuizzes.map((quiz) => (
              <Link key={quiz.id} to={`/quiz/${quiz.id}`}>
                <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer h-full">
                  <CardContent className="p-5 flex flex-col h-full">
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
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDateShort(quiz.created_at)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-accent text-accent-foreground hover:bg-primary/15 transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedQuizForShare(quiz);
                            setSendDialogOpen(true);
                            setSelectedClassId("");
                          }}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          공유
                        </Button>
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
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedQuizId((cur) => (cur === quiz.id ? null : quiz.id));
                          }}
                        >
                          {expandedQuizId === quiz.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => handleDeleteClick(e, quiz)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedQuizId === quiz.id && (
                      <div
                        className="mt-3 pt-3 border-t border-border/60"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-2">배정된 학생</p>
                        {assignmentsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : assignmentsForExpanded.length === 0 ? (
                          <p className="text-xs text-muted-foreground">배정된 학생이 없어요</p>
                        ) : (
                          <div className="space-y-1">
                            {assignmentsForExpanded.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2 py-1"
                              >
                                <button
                                  type="button"
                                  className={a.classId ? 'hover:underline text-left' : 'text-left cursor-default'}
                                  title={a.classId ? '이 클래스로 이동' : undefined}
                                  onClick={() => a.classId && navigate(`/class/${a.classId}`)}
                                >
                                  {a.displayName}
                                </button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleUnassignClick(a.id, a.displayName)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <ShareQuizDialogContent
          classes={classes as any}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          onSendQuiz={() => handleSendQuiz(selectedClassId, () => setSelectedClassId(""))}
          isSending={isSending}
          shareUrl={shareUrl}
          allowAnonymous={allowAnonymous}
          onSetAllowAnonymous={setAllowAnonymous}
          onGenerateLink={generateShareLink}
          isGeneratingLink={isGeneratingLink}
          onCopyLink={copyToClipboard}
        />
      </Dialog>
      <QuizResultsDialog 
        quizId={selectedQuizForResult?.id || null}
        quizTitle={selectedQuizForResult?.title || ""}
        open={!!selectedQuizForResult}
        onOpenChange={(open) => !open && setSelectedResult(null)}
      />

      {/* Reassign Confirmation Dialog */}
      <AlertDialog open={reassignDialogOpen} onOpenChange={(open) => { if (!open) handleCancelReassign(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미 완료된 퀴즈입니다</AlertDialogTitle>
            <AlertDialogDescription>
              학생들이 이미 완료한 퀴즈입니다. 재할당하면 학생들이 다시 풀 수 있으며, 기존 풀이 기록은 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReassign}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>재할당</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={!!assignmentToUnassign} onOpenChange={(open) => !open && setAssignmentToUnassign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배정 취소</AlertDialogTitle>
            <AlertDialogDescription>
              "{assignmentToUnassign?.studentName}"에게 보낸 이 퀴즈 배정을 취소하시겠습니까?
              <br />
              이 배정만 취소되고, 다른 배정과 퀴즈 자체는 그대로 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigning}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassignConfirm}
              disabled={isUnassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigning ? '처리 중...' : '배정 취소'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
