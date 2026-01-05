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
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

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

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

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

  if (!user || role !== 'teacher') {
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
          <div className="flex-1 min-w-0">
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
            {classData.description && (
              <p className="text-muted-foreground mt-1">{classData.description}</p>
            )}
          </div>

          <Button variant="destructive" onClick={handleDeleteClass} className="shrink-0">
            <Trash2 className="w-4 h-4 mr-2" /> 클래스 삭제
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Invite Code Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">초대 코드</CardTitle>
              <CardDescription>학생들에게 이 코드를 공유하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <span className="font-mono text-2xl font-bold text-primary tracking-wider">
                  {classData.invite_code}
                </span>
                <Button variant="ghost" size="icon" onClick={copyInviteCode}>
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                생성일: {format(new Date(classData.created_at), 'yyyy년 M월 d일', { locale: ko })}
              </p>
            </CardContent>
          </Card>

          {/* Members Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                학생 목록
                <span className="text-muted-foreground font-normal">({members.length}명)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 가입한 학생이 없습니다</p>
                  <p className="text-sm mt-1">초대 코드를 학생들에게 공유해주세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
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
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
