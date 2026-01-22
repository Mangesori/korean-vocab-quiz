import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, GraduationCap, BookOpen, Shield, Search, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';

interface UserWithRole {
  user_id: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
  email: string | null;
  profile: {
    name: string;
  } | null;
}

interface Stats {
  totalUsers: number;
  admins: number;
  teachers: number;
  students: number;
  totalClasses: number;
  totalQuizzes: number;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    admins: 0,
    teachers: 0,
    students: 0,
    totalClasses: 0,
    totalQuizzes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user && can(PERMISSIONS.MANAGE_USERS)) {
      fetchData();
    }
  }, [user?.id, can]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all users with roles and emails using secure function
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_user_profiles_with_email');

      if (profilesError) throw profilesError;

      // Map to expected format and sort by created_at descending
      const usersWithProfiles = (profilesData?.map(p => ({
        user_id: p.user_id,
        role: p.role as 'admin' | 'teacher' | 'student',
        created_at: p.created_at,
        email: p.email,
        profile: { name: p.name }
      })) || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setUsers(usersWithProfiles);

      // Calculate stats
      const admins = usersWithProfiles.filter(u => u.role === 'admin').length;
      const teachers = usersWithProfiles.filter(u => u.role === 'teacher').length;
      const students = usersWithProfiles.filter(u => u.role === 'student').length;

      // Fetch class and quiz counts
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true });

      const { count: quizCount } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: usersWithProfiles.length,
        admins,
        teachers,
        students,
        totalClasses: classCount || 0,
        totalQuizzes: quizCount || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'teacher' | 'student') => {
    if (userId === user?.id) {
      toast.error('자신의 역할은 변경할 수 없습니다');
      return;
    }

    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));

      // Update stats
      setStats(prev => {
        const oldUser = users.find(u => u.user_id === userId);
        if (!oldUser) return prev;

        const newStats = { ...prev };
        if (oldUser.role === 'admin') newStats.admins--;
        else if (oldUser.role === 'teacher') newStats.teachers--;
        else newStats.students--;

        if (newRole === 'admin') newStats.admins++;
        else if (newRole === 'teacher') newStats.teachers++;
        else newStats.students++;

        return newStats;
      });

      toast.success('역할이 변경되었습니다');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('역할 변경에 실패했습니다');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive" className="gap-1"><Shield className="h-3 w-3" />관리자</Badge>;
      case 'teacher':
        return <Badge variant="default" className="gap-1"><GraduationCap className="h-3 w-3" />선생님</Badge>;
      case 'student':
        return <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />학생</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const filteredUsers = users.filter(u => 
    u.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.MANAGE_USERS)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-destructive" />
            관리자 대시보드
          </h1>
          <p className="text-muted-foreground mt-1">
            시스템 전체 사용자와 콘텐츠를 관리합니다
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 사용자</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    관리자 {stats.admins} · 선생님 {stats.teachers} · 학생 {stats.students}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">선생님</p>
                  <p className="text-2xl font-bold">{stats.teachers}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    퀴즈 생성 가능
                  </p>
                </div>
                <GraduationCap className="h-8 w-8 text-accent/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 클래스</p>
                  <p className="text-2xl font-bold">{stats.totalClasses}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    개설된 클래스
                  </p>
                </div>
                <Users className="h-8 w-8 text-success/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 퀴즈</p>
                  <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    생성된 퀴즈
                  </p>
                </div>
                <BookOpen className="h-8 w-8 text-warning/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>사용자 관리</CardTitle>
                <CardDescription>사용자 역할을 확인하고 변경합니다</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="이름 또는 ID 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">이름</TableHead>
                      <TableHead className="w-[200px]">이메일</TableHead>
                      <TableHead className="w-[100px]">현재 역할</TableHead>
                      <TableHead className="w-[120px]">가입일</TableHead>
                      <TableHead className="w-[150px]">역할 변경</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">
                            {u.profile?.name || '(이름 없음)'}
                            {u.user_id === user?.id && (
                              <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {u.email || '(이메일 없음)'}
                          </TableCell>
                          <TableCell>{getRoleBadge(u.role)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString('ko-KR')}
                          </TableCell>
                          <TableCell>
                            {u.user_id === user?.id ? (
                              <span className="text-sm text-muted-foreground">변경 불가</span>
                            ) : (
                              <Select
                                value={u.role}
                                onValueChange={(value) => handleRoleChange(u.user_id, value as 'admin' | 'teacher' | 'student')}
                                disabled={updatingUserId === u.user_id}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">관리자</SelectItem>
                                  <SelectItem value="teacher">선생님</SelectItem>
                                  <SelectItem value="student">학생</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}