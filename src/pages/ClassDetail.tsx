import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  FileText, // Added for quiz icon
  Calendar, // Added for date icon
  BarChart2, // Added for results icon
  ChevronDown,
  ChevronUp,
  ChevronRight // Added ChevronRight
} from 'lucide-react';
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
  };
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]); // Added assignments state
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchClassData();
    }
  }, [user, id]);

  const fetchClassData = async () => {
    // Fetch class
    const { data: cls, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cls) {
      toast.error('클래스를 찾을 수 없습니다');
      navigate('/classes');
      return;
    }

    setClassData(cls);
    setEditName(cls.name);

    // Fetch members with profiles
    const { data: membersData } = await supabase
      .from('class_members')
      .select(`
        id,
        student_id,
        joined_at
      `)
      .eq('class_id', id);

    if (membersData) {
      // Fetch profiles for members
      const memberIds = membersData.map(m => m.student_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', memberIds);

      const membersWithProfiles = membersData.map(m => ({
        ...m,
        profile: profiles?.find(p => p.user_id === m.student_id),
      }));

      setMembers(membersWithProfiles);
      setMembers(membersWithProfiles);
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
          words
        )
      `)
      .eq('class_id', id)
      .order('assigned_at', { ascending: false });

    if (assignmentsData) {
      // @ts-ignore: Supabase types complexity
      setAssignments(assignmentsData);
    }

    setIsLoading(false);
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

      setClassData({ ...classData, name: editName.trim() });
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

      setMembers(members.filter(m => m.id !== memberId));
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

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-muted/50 px-3 h-10 rounded-lg border">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">초대 코드:</span>
                <span className="font-mono font-bold text-primary tracking-wider">{classData.invite_code}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={copyInviteCode}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <Button variant="destructive" onClick={handleDeleteClass}>
                <Trash2 className="w-4 h-4 mr-2" /> 클래스 삭제
              </Button>
            </div>
          </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Members Card */}
          <Card>
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
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 가입한 학생이 없습니다</p>
                  <p className="text-sm mt-1">상단의 초대 코드를 학생들에게 공유해주세요</p>
                </div>
              ) : (
                <div className="space-y-2.5 pr-2">
                  {members.slice(0, 7).map((member) => (
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

          {/* Assigned Quizzes Card */}
          <Card>
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
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 배정된 퀴즈가 없습니다</p>
                  <p className="text-sm mt-1">퀴즈 상세 페이지에서 이 클래스에 퀴즈를 배정해보세요</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                    {assignments.slice(0, 6).map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="group relative flex flex-col p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card hover:shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                            {assignment.quizzes?.title || '삭제된 퀴즈'}
                          </h4>
                          <LevelBadge level={assignment.quizzes?.difficulty || 'A1'} className="text-[10px] px-2 py-0.5" />
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                           {assignment.quizzes?.words?.slice(0, 5).join(', ')}
                           {(assignment.quizzes?.words?.length || 0) > 5 ? '...' : ''}
                        </div>

                        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground border-t">
                          <div className="flex items-center bg-muted/50 px-2 py-1 rounded">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(new Date(assignment.assigned_at), 'yyyy.MM.dd', { locale: ko })}
                          </div>
                          <div className="flex gap-1 ml-auto">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-2 text-xs"
                              onClick={() => navigate(`/quiz/${assignment.quiz_id}`)}
                            >
                              문제 보기
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-7 px-2 text-xs"
                              onClick={() => navigate(`/quiz/${assignment.quiz_id}?tab=results`)}
                            >
                              결과 확인 
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <StudentHistoryDialog
          isOpen={!!selectedStudentForHistory}
          onClose={() => setSelectedStudentForHistory(null)}
          studentId={selectedStudentForHistory?.id || ""}
          studentName={selectedStudentForHistory?.name || ""}
          classId={id || ""}
        />
      </div>
    </AppLayout>
  );
}
