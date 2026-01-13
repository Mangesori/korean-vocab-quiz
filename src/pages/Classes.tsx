import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Users, 
  Copy,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Class {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
  member_count?: number;
}

export default function Classes() {
  const { user, role, loading } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', description: '' });

  useEffect(() => {
    // Only fetch if user is logged in and is teacher or admin
    if (user && (role === 'teacher' || role === 'admin')) {
      fetchClasses();
    } else if (!loading && user && role === 'student') {
        // If student somehow gets here (though ProtectedRoute should prevent it), 
        // stop loading so we can redirect
        setIsLoading(false);
    } else if (!loading && !user) {
        setIsLoading(false);
    }
  }, [user, role, loading]);

  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Get member counts
        // Note: Ideally use a view or join, but keeping consistent with existing pattern for now
        const classesWithCounts = await Promise.all(
          data.map(async (cls) => {
            const { count } = await supabase
              .from('class_members')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id);
            
            return { ...cls, member_count: count || 0 };
          })
        );
        
        setClasses(classesWithCounts);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      toast.error('클래스 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClass.name.trim()) {
      toast.error('클래스 이름을 입력해주세요');
      return;
    }

    setIsCreating(true);

    try {
      // Generate invite code
      const { data: codeData } = await supabase.rpc('generate_invite_code');
      
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: newClass.name.trim(),
          description: newClass.description.trim() || null,
          teacher_id: user?.id,
          invite_code: codeData,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('클래스가 생성되었습니다!');
      setClasses([{ ...data, member_count: 0 }, ...classes]);
      setDialogOpen(false);
      setNewClass({ name: '', description: '' });
    } catch (error) {
      console.error('Create error:', error);
      toast.error('클래스 생성에 실패했습니다');
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('초대 코드가 복사되었습니다');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if not authorized
  // Note: ProtectedRoute in App.tsx handles the main protection, but this is a fallback
  if (!user || (role !== 'teacher' && role !== 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
     return (
       <AppLayout>
         <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
         </div>
       </AppLayout>
     );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">클래스 관리</h1>
            <p className="text-muted-foreground mt-1">클래스를 만들고 학생을 초대하세요</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> 새 클래스
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 클래스 만들기</DialogTitle>
                <DialogDescription>클래스 정보를 입력하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="className">클래스 이름 *</Label>
                  <Input
                    id="className"
                    placeholder="예: 초급 한국어 A반"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classDesc">설명 (선택)</Label>
                  <Textarea
                    id="classDesc"
                    placeholder="클래스에 대한 간단한 설명"
                    value={newClass.description}
                    onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateClass}
                  disabled={isCreating || !newClass.name.trim()}
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  클래스 만들기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {classes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">아직 클래스가 없습니다</p>
              <p className="text-muted-foreground mb-4">첫 번째 클래스를 만들어보세요</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> 새 클래스 만들기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <Card key={cls.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{cls.name}</span>
                    <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {cls.member_count}
                    </span>
                  </CardTitle>
                  {cls.description && (
                    <CardDescription>{cls.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">초대 코드</p>
                      <p className="font-mono text-lg font-bold text-primary">{cls.invite_code}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => copyInviteCode(cls.invite_code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(cls.created_at), 'yyyy년 M월 d일', { locale: ko })}
                    </p>
                    <Link to={`/class/${cls.id}`}>
                      <Button variant="ghost" size="sm">
                        상세보기 <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
