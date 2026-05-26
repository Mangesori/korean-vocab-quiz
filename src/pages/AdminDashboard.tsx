import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, GraduationCap, BookOpen, Shield, Search, RefreshCw, BarChart3, FileText } from 'lucide-react';
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

interface QuizMeta {
  difficulty: string | null;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_user_profiles_with_email');

      if (profilesError) throw profilesError;

      const usersWithProfiles = (profilesData?.map(p => ({
        user_id: p.user_id,
        role: p.role as 'admin' | 'teacher' | 'student',
        created_at: p.created_at,
        email: p.email,
        profile: { name: p.name }
      })) || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const admins = usersWithProfiles.filter(u => u.role === 'admin').length;
      const teachers = usersWithProfiles.filter(u => u.role === 'teacher').length;
      const students = usersWithProfiles.filter(u => u.role === 'student').length;

      const [
        { count: classCount },
        { data: quizzesData },
        { count: totalResults },
        { data: scoresData },
      ] = await Promise.all([
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('quizzes').select('difficulty, sentence_making_enabled, recording_enabled'),
        supabase.from('quiz_results').select('*', { count: 'exact', head: true }),
        supabase.from('quiz_results').select('score, total_questions').not('score', 'is', null).not('total_questions', 'is', null),
      ]);

      const quizzes: QuizMeta[] = quizzesData || [];

      const avgScore = scoresData && scoresData.length > 0
        ? Math.round(
            scoresData.reduce((sum, r) => {
              const tq = r.total_questions as number;
              return sum + (tq > 0 ? ((r.score as number) / tq) * 100 : 0);
            }, 0) / scoresData.length
          )
        : 0;

      return {
        users: usersWithProfiles,
        stats: {
          totalUsers: usersWithProfiles.length,
          admins,
          teachers,
          students,
          totalClasses: classCount || 0,
          totalQuizzes: quizzes.length,
        } as Stats,
        report: {
          totalResults: totalResults || 0,
          avgScore,
          quizzes,
        },
      };
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  const users = data?.users ?? [];
  const stats = data?.stats ?? {
    totalUsers: 0, admins: 0, teachers: 0, students: 0, totalClasses: 0, totalQuizzes: 0,
  };
  const report = data?.report ?? { totalResults: 0, avgScore: 0, quizzes: [] as QuizMeta[] };

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

      queryClient.setQueryData(['adminDashboard'], (prev: typeof data) => {
        if (!prev) return prev;

        const oldUser = prev.users.find(u => u.user_id === userId);
        if (!oldUser) return prev;

        const newUsers = prev.users.map(u =>
          u.user_id === userId ? { ...u, role: newRole } : u
        );

        const newStats = { ...prev.stats };
        if (oldUser.role === 'admin') newStats.admins--;
        else if (oldUser.role === 'teacher') newStats.teachers--;
        else newStats.students--;

        if (newRole === 'admin') newStats.admins++;
        else if (newRole === 'teacher') newStats.teachers++;
        else newStats.students++;

        return { ...prev, users: newUsers, stats: newStats };
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
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const teacherUsers = users.filter(u => u.role === 'teacher');
  const filteredTeachers = teacherUsers.filter(u =>
    u.profile?.name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase())
  );

  // Role distribution
  const total = stats.totalUsers || 1;
  const adminPct = Math.round((stats.admins / total) * 100);
  const teacherPct = Math.round((stats.teachers / total) * 100);
  const studentPct = Math.round((stats.students / total) * 100);

  // CEFR distribution
  const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const totalQ = report.quizzes.length || 1;
  const cefrCounts = cefrLevels.reduce((acc, level) => {
    acc[level] = report.quizzes.filter(q => q.difficulty === level).length;
    return acc;
  }, {} as Record<string, number>);

  // Quiz type distribution
  const fillBlankOnly = report.quizzes.filter(q => !q.sentence_making_enabled && !q.recording_enabled).length;
  const withSentence = report.quizzes.filter(q => q.sentence_making_enabled && !q.recording_enabled).length;
  const allThree = report.quizzes.filter(q => q.sentence_making_enabled && q.recording_enabled).length;

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

  function UserTable({ list, emptyMsg }: { list: UserWithRole[]; emptyMsg: string }) {
    return isLoading ? (
      <div className="flex justify-center py-8"><LoadingSpinner /></div>
    ) : list.length === 0 ? (
      <p className="text-center py-8 text-muted-foreground">{emptyMsg}</p>
    ) : (
      <>
        {/* Desktop table */}
        <div className="hidden md:block rounded-md border">
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
              {list.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    {u.profile?.name || '(이름 없음)'}
                    {u.user_id === user?.id && (
                      <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{u.email || '(이메일 없음)'}</TableCell>
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
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="teacher">선생님</SelectItem>
                          <SelectItem value="student">학생</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Mobile card stack */}
        <div className="md:hidden flex flex-col gap-3">
          {list.map((u) => (
            <div key={u.user_id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {u.profile?.name || '(이름 없음)'}
                    {u.user_id === user?.id && (
                      <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email || '(이메일 없음)'}</p>
                </div>
                {getRoleBadge(u.role)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  가입일: {new Date(u.created_at).toLocaleDateString('ko-KR')}
                </span>
                {u.user_id === user?.id ? (
                  <span className="text-sm text-muted-foreground">변경 불가</span>
                ) : (
                  <Select
                    value={u.role}
                    onValueChange={(value) => handleRoleChange(u.user_id, value as 'admin' | 'teacher' | 'student')}
                    disabled={updatingUserId === u.user_id}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">관리자</SelectItem>
                      <SelectItem value="teacher">선생님</SelectItem>
                      <SelectItem value="student">학생</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
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

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams(v === "dashboard" ? {} : { tab: v })}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />대시보드
            </TabsTrigger>
            <TabsTrigger value="teachers" className="gap-2">
              <GraduationCap className="h-4 w-4" />선생님 관리
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2">
              <FileText className="h-4 w-4" />시스템 리포트
            </TabsTrigger>
          </TabsList>

          {/* ── 대시보드 탭 ── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 사용자</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalUsers}</div>
                  <div className="font-ui text-[11px] text-muted-foreground mt-[5px]">관리자 {stats.admins} · 선생님 {stats.teachers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 선생님</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.teachers}</div>
                  <div className="font-ui text-[11px] text-success mt-[5px]">퀴즈 생성 가능</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 클래스</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalClasses}</div>
                  <div className="font-ui text-[11px] text-success mt-[5px]">개설된 클래스</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 퀴즈</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalQuizzes}</div>
                  <div className="font-ui text-[11px] text-success mt-[5px]">생성된 퀴즈</div>
                </CardContent>
              </Card>
            </div>

            {/* Role distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">역할 분포</CardTitle>
                <CardDescription>전체 사용자 {stats.totalUsers}명 기준</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-destructive" />관리자
                    </span>
                    <span className="text-muted-foreground">{stats.admins}명 ({adminPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${adminPct}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-3.5 w-3.5 text-primary" />선생님
                    </span>
                    <span className="text-muted-foreground">{stats.teachers}명 ({teacherPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${teacherPct}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />학생
                    </span>
                    <span className="text-muted-foreground">{stats.students}명 ({studentPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-muted-foreground/50 transition-all" style={{ width: `${studentPct}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All users */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>전체 사용자</CardTitle>
                    <CardDescription>사용자 역할을 확인하고 변경합니다</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="이름 또는 이메일 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UserTable
                  list={filteredUsers}
                  emptyMsg={searchTerm ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 선생님 관리 탭 ── */}
          <TabsContent value="teachers">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>선생님 관리</CardTitle>
                    <CardDescription>선생님 계정 목록 및 역할 변경</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="이름 또는 이메일 검색..."
                        value={teacherSearchTerm}
                        onChange={(e) => setTeacherSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UserTable
                  list={filteredTeachers}
                  emptyMsg={teacherSearchTerm ? '검색 결과가 없습니다' : '등록된 선생님이 없습니다'}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 시스템 리포트 탭 ── */}
          <TabsContent value="report" className="space-y-6">
            {/* KPI cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">총 제출 수</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{report.totalResults}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">평균 정답률</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-primary">{report.avgScore}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">총 학생 수</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.students}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">총 퀴즈 수</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalQuizzes}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* CEFR distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CEFR 레벨 분포</CardTitle>
                  <CardDescription>퀴즈 {report.quizzes.length}개 기준</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cefrLevels.map((level) => {
                    const count = cefrCounts[level] || 0;
                    const pct = Math.round((count / totalQ) * 100);
                    const colors: Record<string, string> = {
                      A1: 'bg-[#15803D]', A2: 'bg-[#0E7490]',
                      B1: 'bg-[#1D4ED8]', B2: 'bg-[#6D28D9]',
                      C1: 'bg-[#9D174D]', C2: 'bg-[#854D0E]',
                    };
                    return (
                      <div key={level} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-mono font-semibold">{level}</span>
                          <span className="text-muted-foreground">{count}개 ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${colors[level]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Quiz type distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">퀴즈 유형 분포</CardTitle>
                  <CardDescription>활성화된 퀴즈 유형 기준</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: '빈칸만', count: fillBlankOnly },
                    { label: '빈칸 + 문장 만들기', count: withSentence },
                    { label: '빈칸 + 문장 + 말하기', count: allThree },
                  ].map(({ label, count }) => {
                    const pct = Math.round((count / totalQ) * 100);
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{label}</span>
                          <span className="text-muted-foreground">{count}개 ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
