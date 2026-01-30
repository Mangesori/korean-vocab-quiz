import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Users,
  Copy,
  Trash2,
  Loader2,
  UserMinus,
  Edit2,
  Check,
  X,
  Clock,
  FileText,
  Calendar,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Megaphone
} from 'lucide-react';
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
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { StudentHistoryDialog } from '@/components/class/StudentHistoryDialog';
import { LevelBadge } from '@/components/ui/level-badge';

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
}

interface Member {
  id: string;
  student_id: string;
  joined_at: string;
  profile?: {
    name: string;
  };
}

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

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<{ id: string; name: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['classDetail', id],
    queryFn: async () => {
      // Fetch class
      const { data: cls, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !cls) {
        throw new Error('클래스를 찾을 수 없습니다');
      }

      // Fetch members with profiles
      const { data: membersData } = await supabase
        .from('class_members')
        .select(`
          id,
          student_id,
          joined_at
        `)
        .eq('class_id', id);

      let membersWithProfiles: Member[] = [];
      if (membersData) {
        const memberIds = membersData.map(m => m.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', memberIds);

        membersWithProfiles = membersData.map(m => ({
          ...m,
          profile: profiles?.find(p => p.user_id === m.student_id),
        }));
      }

      // Fetch assignments
      const { data: assignmentsData } = await supabase
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

      return {
        classData: cls as ClassData,
        members: membersWithProfiles,
        assignments: (assignmentsData || []) as Assignment[],
      };
    },
    enabled: !!user && !!id,
  });

  const classData = data?.classData ?? null;
  const members = data?.members ?? [];
  const assignments = data?.assignments ?? [];

  // Set editName when classData changes
  if (classData && editName === '' && !isEditing) {
    setEditName(classData.name);
  }

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
      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        assignments: prev.assignments.filter(a => a.id !== assignmentToDelete.id)
      } : prev);
      
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('퀴즈 할당 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyInviteCode = () => {
    if (classData) {
      navigator.clipboard.writeText(classData.invite_code);
      toast.success('초대 코드가 복사되었습니다');
    }
  };

  const handleUpdateName = async () => {
    if (!classData || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({ name: editName.trim() })
        .eq('id', classData.id);

      if (error) throw error;

      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        classData: { ...prev.classData, name: editName.trim() }
      } : prev);
      setIsEditing(false);
      toast.success('클래스 이름이 변경되었습니다');
    } catch (error) {
      toast.error('변경에 실패했습니다');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('정말 이 학생을 클래스에서 제외하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        members: prev.members.filter(m => m.id !== memberId)
      } : prev);
      toast.success('학생이 제외되었습니다');
    } catch (error) {
      toast.error('제외에 실패했습니다');
    }
  };

  const handleDeleteClass = async () => {
    if (!classData || !confirm('정말 이 클래스를 삭제하시겠습니까? 모든 학생이 클래스에서 제외됩니다.')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classData.id);

      if (error) throw error;

      toast.success('클래스가 삭제되었습니다');
      navigate('/classes');
    } catch (error) {
      toast.error('삭제에 실패했습니다');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.EDIT_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!classData) return null;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/classes')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> 클래스 목록
        </Button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-xl sm:text-2xl font-bold h-10 sm:h-12"
                    />
                    <Button size="icon" onClick={handleUpdateName}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{classData.name}</h1>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                </div>

              {classData.description && (
                <p className="text-muted-foreground">{classData.description}</p>
              )}
              
              <p className="text-xs text-muted-foreground">
                생성일: {format(new Date(classData.created_at), 'yyyy년 M월 d일', { locale: ko })}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 bg-muted/50 px-3 h-10 rounded-lg border">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">초대 코드:</span>
                <span className="font-mono font-bold text-primary tracking-wider">{classData.invite_code}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={copyInviteCode}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <Button variant="outline" onClick={() => navigate(`/class/${id}/announcements`)}>
                <Megaphone className="w-4 h-4 mr-2" /> 공지사항
              </Button>
              <Button variant="destructive" onClick={handleDeleteClass}>
                <Trash2 className="w-4 h-4 mr-2" /> 클래스 삭제
              </Button>
            </div>
          </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Assigned Quizzes Card - 2/3 (Left) */}
          <Card className="lg:col-span-2 flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="w-5 h-5" />
                배정된 퀴즈
                <span className="text-muted-foreground font-normal">({assignments.length}개)</span>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/class/${id}/quizzes`)}
              >
                전체 퀴즈 보기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>아직 배정된 퀴즈가 없습니다</p>
                  <p className="text-sm mt-1">퀴즈 상세 페이지에서 이 클래스에 퀴즈를 배정해보세요</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                    {assignments.slice(0, 6).map((assignment) => (
                      <Card key={assignment.id} className="hover:shadow-lg transition-all hover:border-primary/50 h-full">
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
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-8 text-xs"
                                onClick={() => handleDeleteClick(assignment)}
                              >
                                삭제
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Members Card - 1/3 (Right) */}
          <Card className="lg:col-span-1 flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Users className="w-5 h-5" />
                학생 목록
                <span className="text-muted-foreground font-normal">({members.length}명)</span>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/class/${id}/students`)}
              >
                전체 학생 보기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 가입한 학생이 없습니다</p>
                  <p className="text-sm mt-1">상단의 초대 코드를 학생들에게 공유해주세요</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {members.slice(0, 10).map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="font-medium text-primary">
                            {(member.profile?.name || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.profile?.name || '이름 없음'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(member.joined_at), 'M월 d일 가입', { locale: ko })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedStudentForHistory({ id: member.student_id, name: member.profile?.name || '이름 없음' })}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>퀴즈 할당 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 "{assignmentToDelete?.quizzes?.title || '이 퀴즈'}" 할당을 삭제하시겠습니까?
                <br />
                이 작업은 되돌릴 수 없습니다.
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

        {/* Student History Dialog */}
        {selectedStudentForHistory && (
          <StudentHistoryDialog
            isOpen={!!selectedStudentForHistory}
            onClose={() => setSelectedStudentForHistory(null)}
            studentId={selectedStudentForHistory.id}
            studentName={selectedStudentForHistory.name}
            classId={id || ""}
          />
        )}
      </div>
    </AppLayout>
  );
}
