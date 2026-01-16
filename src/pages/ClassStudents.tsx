import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Loader2,
  UserMinus,
  Clock,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { StudentHistoryDialog } from '@/components/class/StudentHistoryDialog';

interface ClassData {
  id: string;
  name: string;
}

interface Member {
  id: string;
  student_id: string;
  joined_at: string;
  profile?: {
    name: string;
  };
}

export default function ClassStudents() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
    // Fetch class name
    const { data: cls, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error || !cls) {
      toast.error('클래스를 찾을 수 없습니다');
      navigate('/classes');
      return;
    }

    setClassData(cls);

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
    }

    setIsLoading(false);
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

  if (!classData) return null;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(`/class/${id}`)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> 클래스로 돌아가기
        </Button>

        <div className="flex items-center gap-2 mb-8">
          <h1 className="text-2xl font-bold">{classData.name} 학생 목록</h1>
          <span className="text-muted-foreground">({members.length}명)</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              전체 학생
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>가입한 학생이 없습니다</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-all"
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
                          {format(new Date(member.joined_at), 'yyyy.MM.dd 가입', { locale: ko })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost" 
                        size="icon"
                        title="활동 기록"
                        onClick={() => setSelectedStudentForHistory({ id: member.student_id, name: member.profile?.name || '이름 없음' })}
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title="내보내기"
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
