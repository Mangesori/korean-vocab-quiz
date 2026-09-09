import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { TeacherDetailDialog } from '@/components/admin/TeacherDetailDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Search, Trash2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateShort, formatRelativeKo } from '@/lib/formatDate';
import { useAdminQueue } from '@/hooks/useAdminQueue';
import type { AdminUser } from '@/components/admin/adminTypes';

// admin_teacher_stats 뷰(공급: supabase/migrations/20260904141229_add_admin_library_views_and_signals.sql)
// 컬럼: user_id, name, created_at, class_count, quiz_count, student_count, last_active_at.
// profiles.user_id 기준(= profiles.id 아님). 이메일 컬럼이 없어 이 페이지가 이미 쓰던
// get_user_profiles_with_email RPC로 별도 조회해 병합한다.
// 아직 supabase generate-types를 다시 돌리지 않아 이 뷰가 src/integrations/supabase/types.ts의
// Views에 없다 — 타입 캐스트로 우회한다(as any).
interface TeacherStatsRow {
  user_id: string;
  name: string | null;
  created_at: string;
  class_count: number;
  quiz_count: number;
  student_count: number;
  last_active_at: string | null;
}

interface TeacherRow extends TeacherStatsRow {
  email: string | null;
}

// 승인 대기 신청 줄 — teacher_applications(id, user_id, created_at) + 신청자 프로필/이메일 +
// "학생으로서의 활동"(quiz_results.student_id 건수, snippets/04의 submission_count 대용).
interface PendingRow {
  applicationId: string;
  userId: string;
  name: string;
  email: string;
  appliedAt: string;
  createdAt: string;
  submissionCount: number;
}

/** 오늘=primary, 최근=기본, 오래됨=흐림, 없음=warning */
function activityColor(last: string | null) {
  if (!last) return 'text-warning';
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  if (days <= 0) return 'text-primary';
  if (days < 14) return '';
  return 'text-muted-foreground';
}

const Dot = () => <span className="mx-1 text-border">·</span>;

type SortKey = 'activity' | 'created' | 'name';

export default function AdminTeachers() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [dormantOnly, setDormantOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('activity');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingTeacher, setViewingTeacher] = useState<AdminUser | null>(null);
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);

  // 이메일은 profiles에 컬럼이 없어 기존 방식(get_user_profiles_with_email RPC)으로 조회.
  const { data: emailByUserId = {} } = useQuery({
    queryKey: ['admin', 'userEmails'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_profiles_with_email');
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const p of data ?? []) map[p.user_id] = p.email;
      return map;
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  const { data: teacherStats = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'teacherStats'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('admin_teacher_stats' as never) as unknown as {
        select: (columns: string) => PromiseLike<{ data: TeacherStatsRow[] | null; error: unknown }>;
      }).select('user_id, name, created_at, class_count, quiz_count, student_count, last_active_at');
      if (error) throw error;
      return (data ?? []) as TeacherStatsRow[];
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  const teacherUsers: TeacherRow[] = useMemo(
    () => teacherStats.map((t) => ({ ...t, email: emailByUserId[t.user_id] ?? null })),
    [teacherStats, emailByUserId]
  );

  const { data: queue } = useAdminQueue();
  const pendingApplications = queue?.pendingApplications ?? [];

  // 승인 대기 신청 줄에 필요한 이름/이메일/가입일/학생 활동 건수를 모아 조회.
  const { data: pendingRows = [] } = useQuery({
    queryKey: ['admin', 'pendingTeacherRows', pendingApplications.map((a) => a.id).join(',')],
    queryFn: async (): Promise<PendingRow[]> => {
      if (pendingApplications.length === 0) return [];
      const userIds = pendingApplications.map((a) => a.user_id);

      const [{ data: profileRows, error: profileError }, { data: resultRows, error: resultError }] =
        await Promise.all([
          supabase.from('profiles').select('user_id, name, created_at').in('user_id', userIds),
          supabase.from('quiz_results').select('student_id').in('student_id', userIds),
        ]);
      if (profileError) throw profileError;
      if (resultError) throw resultError;

      const submissionCounts = new Map<string, number>();
      for (const r of resultRows ?? []) {
        if (!r.student_id) continue;
        submissionCounts.set(r.student_id, (submissionCounts.get(r.student_id) ?? 0) + 1);
      }
      const profileByUserId = new Map((profileRows ?? []).map((p) => [p.user_id, p]));

      return pendingApplications.map((app) => {
        const profile = profileByUserId.get(app.user_id);
        return {
          applicationId: app.id,
          userId: app.user_id,
          name: profile?.name || '(이름 없음)',
          email: emailByUserId[app.user_id] || '(이메일 없음)',
          appliedAt: app.created_at,
          createdAt: profile?.created_at || app.created_at,
          submissionCount: submissionCounts.get(app.user_id) ?? 0,
        };
      });
    },
    enabled: pendingApplications.length > 0,
  });

  const filteredTeachers = useMemo(() => {
    const term = teacherSearchTerm.toLowerCase();
    let list = teacherUsers.filter(
      (t) =>
        (t.name?.toLowerCase().includes(term) ?? false) ||
        (t.email?.toLowerCase().includes(term) ?? false)
    );
    if (dormantOnly) list = list.filter((t) => t.quiz_count === 0);

    const sorted = [...list];
    if (sort === 'activity') {
      sorted.sort((a, b) => {
        const at = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
        const bt = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
        return bt - at;
      });
    } else if (sort === 'created') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }
    return sorted;
  }, [teacherUsers, teacherSearchTerm, dormantOnly, sort]);

  const total = teacherUsers.length;
  const active30 = teacherUsers.filter((t) => {
    if (!t.last_active_at) return false;
    const days = Math.floor((Date.now() - new Date(t.last_active_at).getTime()) / 86_400_000);
    return days <= 30;
  }).length;
  const dormant = teacherUsers.filter((t) => t.quiz_count === 0).length;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'teacherStats'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'pendingTeacherRows'] });
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'teacher' | 'student') => {
    if (userId === user?.id) {
      toast.error('자신의 역할은 바꿀 수 없어요');
      return;
    }
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
      if (error) throw error;
      invalidateAll();
      toast.success('역할을 변경했어요');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('역할을 변경하지 못했어요');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // ── 선생님 신청 승인/거절 ──
  const handleApproveTeacher = async (userId: string, applicationId: string) => {
    setReviewingAppId(applicationId);
    try {
      const { error: roleError } = await supabase.from('profiles').update({ role: 'teacher' }).eq('user_id', userId);
      if (roleError) throw roleError;

      const { error: appError } = await supabase
        .from('teacher_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', applicationId);
      if (appError) throw appError;

      invalidateAll();
      toast.success('선생님으로 승인했어요');
    } catch (error) {
      console.error('Error approving teacher:', error);
      toast.error('승인하지 못했어요');
    } finally {
      setReviewingAppId(null);
    }
  };

  const handleApproveAll = async () => {
    setReviewingAppId('all');
    try {
      for (const p of pendingRows) {
        const { error: roleError } = await supabase.from('profiles').update({ role: 'teacher' }).eq('user_id', p.userId);
        if (roleError) throw roleError;
        const { error: appError } = await supabase
          .from('teacher_applications')
          .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
          .eq('id', p.applicationId);
        if (appError) throw appError;
      }
      invalidateAll();
      toast.success('모든 신청을 승인했어요');
    } catch (error) {
      console.error('Error approving all teachers:', error);
      toast.error('일부 신청을 승인하지 못했어요');
    } finally {
      setReviewingAppId(null);
    }
  };

  const handleRejectTeacher = async (applicationId: string) => {
    setReviewingAppId(applicationId);
    try {
      const { error } = await supabase
        .from('teacher_applications')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', applicationId);
      if (error) throw error;

      invalidateAll();
      toast.success('신청을 거절했어요');
    } catch (error) {
      console.error('Error rejecting teacher:', error);
      toast.error('거절 처리에 실패했어요');
    } finally {
      setReviewingAppId(null);
    }
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

      invalidateAll();
      toast.success('계정을 삭제했어요');
      setDeletingUser(null);
    } catch (e) {
      console.error('Error deleting user:', e);
      toast.error('계정을 삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
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
    <AdminPageShell title="선생님 관리">
      <div className="space-y-6">
        {/* 승인 대기 — 1건/N건 같은 컴포넌트 */}
        {pendingRows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-warning/40 bg-card">
            <div className="flex items-center gap-3 border-b border-warning/20 bg-warning/5 px-5 py-4">
              <div className="flex-1 text-[14.5px] font-extrabold">
                선생님 권한 신청 {pendingRows.length}건 — 승인하면 즉시 선생님으로 전환됩니다
              </div>
              {pendingRows.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApproveAll}
                  disabled={reviewingAppId === 'all'}
                >
                  모두 승인
                </Button>
              )}
            </div>

            {pendingRows.map((p) => (
              <div
                key={p.applicationId}
                className="grid grid-cols-[1fr_auto] items-center gap-5 border-b border-warning/10 px-5 py-4 last:border-0 hover:bg-warning/[0.03]"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="whitespace-nowrap text-[14.5px] font-semibold">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.email}</span>
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-foreground/70">
                    {formatDateShort(p.appliedAt)} 신청
                    <span className="mx-1.5 text-border">·</span>
                    가입 {formatDateShort(p.createdAt)}
                    <span className="mx-1.5 text-border">·</span>
                    {p.submissionCount > 0
                      ? `학생으로 제출 ${p.submissionCount}건`
                      : '학생 활동 없음'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectTeacher(p.applicationId)}
                    disabled={reviewingAppId === p.applicationId || reviewingAppId === 'all'}
                  >
                    거절
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveTeacher(p.userId, p.applicationId)}
                    disabled={reviewingAppId === p.applicationId || reviewingAppId === 'all'}
                  >
                    승인
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-border px-6 py-4">
            <div className="text-base font-extrabold">계정 목록</div>
            <div className="text-xs tabular-nums text-muted-foreground">
              선생님 <b className="text-foreground">{total}명</b>
              <Dot />최근 30일 활동 <b className="text-foreground">{active30}명</b>
              <Dot />휴면 <b className="text-warning">{dormant}명</b>
            </div>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름 또는 이메일"
                value={teacherSearchTerm}
                onChange={(e) => setTeacherSearchTerm(e.target.value)}
                className="pl-9 w-[240px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setDormantOnly((v) => !v)}
              className={dormantOnly ? 'border-warning/40 bg-warning/10 text-warning' : ''}
            >
              휴면 계정만 보기
            </Button>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">최근 활동순</SelectItem>
                <SelectItem value="created">가입일순</SelectItem>
                <SelectItem value="name">이름순</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {teacherSearchTerm || dormantOnly ? '검색 결과가 없습니다' : '등록된 선생님이 없습니다'}
            </p>
          ) : (
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[172px]" /><col /><col className="w-[120px]" />
                <col className="w-[232px]" /><col className="w-[128px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-secondary/70 hover:bg-secondary/70">
                  <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">이름</TableHead>
                  <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">이메일</TableHead>
                  <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">마지막 활동</TableHead>
                  <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">운영 현황</TableHead>
                  <TableHead className="h-10 text-[11px] font-extrabold tracking-wide text-muted-foreground">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((t) => (
                  <TableRow key={t.user_id} className="h-16 hover:bg-secondary/60">
                    <TableCell className="py-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold">{t.name || '(이름 없음)'}</span>
                        {t.quiz_count === 0 && (
                          <span className="shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-[10.5px] font-extrabold text-warning">
                            휴면
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-0 truncate text-muted-foreground">{t.email || '(이메일 없음)'}</TableCell>

                    <TableCell className={`py-0 font-semibold tabular-nums ${activityColor(t.last_active_at)}`}>
                      {formatRelativeKo(t.last_active_at)}
                    </TableCell>

                    <TableCell className="py-0">
                      <div className="text-xs tabular-nums text-foreground/80">
                        클래스 {t.class_count}<Dot />퀴즈 {t.quiz_count}<Dot />학생 {t.student_count}명
                      </div>
                      <div className="mt-0.5 text-[11.5px] tabular-nums text-muted-foreground">
                        {formatDateShort(t.created_at)} 가입
                      </div>
                    </TableCell>

                    <TableCell className="py-0">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            setViewingTeacher({
                              user_id: t.user_id,
                              role: 'teacher',
                              created_at: t.created_at,
                              email: t.email,
                              profile: { name: t.name || '' },
                            })
                          }
                        >
                          자세히
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground"
                              disabled={updatingUserId === t.user_id}
                            >
                              ⋯
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRoleChange(t.user_id, 'student')}>
                              <UserMinus className="w-4 h-4 mr-2" />
                              학생으로 변경
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                setDeletingUser({
                                  user_id: t.user_id,
                                  role: 'teacher',
                                  created_at: t.created_at,
                                  email: t.email,
                                  profile: { name: t.name || '' },
                                })
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              계정 삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

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

      <TeacherDetailDialog
        teacher={viewingTeacher}
        open={!!viewingTeacher}
        onOpenChange={(open) => !open && setViewingTeacher(null)}
      />
    </AdminPageShell>
  );
}
