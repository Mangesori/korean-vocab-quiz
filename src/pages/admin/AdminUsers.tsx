import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { RoleBadge } from '@/components/admin/RoleBadge';
import { UserRoleSelect } from '@/components/admin/UserRoleSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Download, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateShort } from '@/lib/formatDate';
import type { AdminUser } from '@/components/admin/adminTypes';

const ROLE_LABEL: Record<'all' | 'admin' | 'teacher' | 'student', string> = {
  all: '전체',
  student: '학생',
  teacher: '선생님',
  admin: '관리자',
};

const PAGE_SIZE = 20;

// 5b — docs/handoff-admin-library/snippets/03_admin_dashboard_users.md.
// 원래 AdminDashboard.tsx의 ?tab=dashboard 왼쪽 표를 신규 페이지로 이관한 뒤
// 이번 단계에서 스펙대로 마크업/정보구조를 다시 짰다(표 5열 + 툴바 + 페이지네이션).
export default function AdminUsers() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [page, setPage] = useState(0);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // 선생님 → 학생 강등 확인 다이얼로그. classCount는 다이얼로그를 여는 시점에 조회한다.
  const [demoteTarget, setDemoteTarget] = useState<{ user: AdminUser; classCount: number } | null>(null);
  const [isCheckingDemote, setIsCheckingDemote] = useState<string | null>(null);

  const enabled = !!user && can(PERMISSIONS.MANAGE_USERS);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_profiles_with_email');
      if (error) throw error;
      return ((data?.map((p) => ({
        user_id: p.user_id,
        role: p.role as 'admin' | 'teacher' | 'student',
        created_at: p.created_at,
        email: p.email,
        profile: { name: p.name },
      })) || []) as AdminUser[]).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled,
  });

  const counts = useMemo(() => ({
    all: users.length,
    student: users.filter((u) => u.role === 'student').length,
    teacher: users.filter((u) => u.role === 'teacher').length,
    admin: users.filter((u) => u.role === 'admin').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !q ||
        u.profile?.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedUsers = filteredUsers.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const setSearch = (v: string) => { setSearchTerm(v); setPage(0); };
  const setRole = (r: typeof roleFilter) => { setRoleFilter(r); setPage(0); };

  const applyRoleChange = async (userId: string, newRole: 'admin' | 'teacher' | 'student') => {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
      if (error) throw error;
      queryClient.setQueryData(['admin', 'users'], (prev: AdminUser[] | undefined) =>
        prev?.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
      toast.success('역할을 변경했어요');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('역할을 변경하지 못했어요');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'teacher' | 'student') => {
    if (userId === user?.id) {
      toast.error('자신의 역할은 바꿀 수 없어요');
      return;
    }
    const target = users.find((u) => u.user_id === userId);

    // 선생님 → 학생 강등: 담당 클래스가 남는지 먼저 확인하고 경고 다이얼로그를 띄운다.
    if (target?.role === 'teacher' && newRole === 'student') {
      setIsCheckingDemote(userId);
      try {
        const { count, error } = await supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', userId)
          .is('archived_at', null);
        if (error) throw error;
        setDemoteTarget({ user: target, classCount: count ?? 0 });
      } catch (error) {
        console.error('Error checking teacher classes:', error);
        toast.error('담당 클래스 확인에 실패했어요');
      } finally {
        setIsCheckingDemote(null);
      }
      return;
    }

    await applyRoleChange(userId, newRole);
  };

  const confirmDemote = async () => {
    if (!demoteTarget) return;
    await applyRoleChange(demoteTarget.user.user_id, 'student');
    setDemoteTarget(null);
  };

  // ── 계정 삭제 ──
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    const targetId = deletingUser.user_id;
    setIsDeleting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: targetId },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      queryClient.setQueryData(['admin', 'users'], (prev: AdminUser[] | undefined) =>
        prev?.filter((u) => u.user_id !== targetId)
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] });

      toast.success('계정을 삭제했어요');
      setDeletingUser(null);
    } catch (e) {
      console.error('Error deleting user:', e);
      toast.error('계정을 삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── CSV 내보내기 (기존 AdminDashboard.tsx의 exportUsersCsv 로직 이관) ──
  const roleLabel = (r: string) => (r === 'admin' ? '관리자' : r === 'teacher' ? '선생님' : '학생');
  const exportUsersCsv = () => {
    if (filteredUsers.length === 0) { toast.error('내보낼 사용자가 없어요'); return; }
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredUsers.map((u) => [
      u.profile?.name || '',
      u.email || '',
      roleLabel(u.role),
      formatDateShort(u.created_at),
    ]);
    const csv = [['이름', '이메일', '역할', '가입일'], ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM: Excel 한글
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `나무_사용자_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`사용자 ${filteredUsers.length}명을 내보냈어요`);
  };

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
    <AdminPageShell
      title="사용자 관리"
      right={
        <div className="text-xs tabular-nums text-muted-foreground">
          전체 <b className="text-foreground">{counts.all}명</b> · 학생 {counts.student} · 선생님 {counts.teacher} · 관리자 {counts.admin}
        </div>
      }
    >
      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        {/* 툴바: 검색 + 역할 필터 + 정렬 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
          <div className="relative w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름 또는 이메일"
              value={searchTerm}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {(['all', 'student', 'teacher', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex h-10 items-center rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                  roleFilter === r
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-secondary text-foreground/80 hover:bg-secondary/70'
                }`}
              >
                {ROLE_LABEL[r]} {counts[r]}
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-border" />
            <Select value="recent">
              <SelectTrigger className="h-10 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">최근 가입순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 표 */}
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {searchTerm || roleFilter !== 'all' ? '검색 결과가 없습니다' : '사용자가 없습니다'}
          </p>
        ) : (
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[200px]" /><col /><col className="w-[116px]" />
              <col className="w-[132px]" /><col className="w-[200px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-secondary/70 hover:bg-secondary/70">
                <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">이름</TableHead>
                <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">이메일</TableHead>
                <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">현재 역할</TableHead>
                <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">가입일</TableHead>
                <TableHead className="h-10 text-center text-[11px] font-extrabold tracking-wide text-muted-foreground">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((u) => {
                const isSelf = u.user_id === user?.id;
                return (
                  <TableRow key={u.user_id} className="h-16 hover:bg-secondary/60">
                    <TableCell className="py-0 font-semibold truncate">
                      {u.profile?.name || '(이름 없음)'}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(나)</span>}
                    </TableCell>
                    <TableCell className="py-0 text-muted-foreground truncate">{u.email || '(이메일 없음)'}</TableCell>
                    <TableCell className="py-0"><RoleBadge role={u.role} /></TableCell>
                    <TableCell className="py-0 tabular-nums text-muted-foreground">
                      {formatDateShort(u.created_at)}
                    </TableCell>
                    <TableCell className="py-0 text-right">
                      <div className="flex items-center justify-center gap-2">
                        <UserRoleSelect
                          userId={u.user_id}
                          role={u.role}
                          isSelf={isSelf}
                          disabled={updatingUserId === u.user_id || isCheckingDemote === u.user_id}
                          onChange={handleRoleChange}
                          className="h-8 w-[110px] text-xs"
                        />
                        {!isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-muted-foreground">⋯</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingUser(u)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* 푸터: 페이지네이션 + 내보내기 */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportUsersCsv}>
            <Download className="h-3.5 w-3.5" />CSV 내보내기
          </Button>
          {pageCount > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">{currentPage + 1} / {pageCount}</span>
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 선생님 → 학생 강등 확인 */}
      <AlertDialog open={!!demoteTarget} onOpenChange={(open) => !open && setDemoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>학생으로 강등하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {demoteTarget?.user.profile?.name || demoteTarget?.user.email}
              </span>
              {demoteTarget && demoteTarget.classCount > 0 ? (
                <>
                  {' '}님은 현재 담당 클래스 <b className="text-foreground">{demoteTarget.classCount}개</b>를 갖고 있어요.
                  학생으로 강등해도 클래스는 삭제되지 않고 그대로 남아있게 됩니다.
                </>
              ) : (
                ' 님을 학생으로 강등합니다.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDemote}>강등</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 계정 삭제 확인 */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deletingUser?.profile?.name || deletingUser?.email}</span>
              {' '}계정과 관련된 모든 데이터(클래스·퀴즈·결과 등)가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
