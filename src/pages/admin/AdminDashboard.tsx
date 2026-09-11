import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { RoleBadge } from '@/components/admin/RoleBadge';
import { StatStrip, StatStripLegend, type Stat } from '@/components/admin/StatStrip';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminQueue } from '@/hooks/useAdminQueue';
import { formatDateShort, formatRelativeKo } from '@/lib/formatDate';
import { pct } from '@/lib/utils';

// 예전 /admin?tab=xxx 북마크·외부 링크 보호용 리다이렉트.
const TAB_REDIRECT: Record<string, string> = {
  teachers: '/admin/teachers',
  report: '/admin/report',
  feedback: '/admin/feedback',
  users: '/admin/users',
};

// 역할 구성 스택 바 색 — StatStrip 범례 전용. 퀴즈 유형(--type-*)·CEFR(.level-*)과
// 의미가 다르므로 그 팔레트를 재사용하지 않는다.
const ROLE_BAR = {
  student: 'bg-primary',
  teacher: 'bg-info',
  admin: 'bg-destructive',
} as const;

interface RecentSignup {
  id: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
}

interface AdminSignals {
  total_quizzes: number;
  zero_submission: number;
  total_teachers: number;
  idle_teachers: number;
  total_students: number;
  active_students_30: number;
}

export default function AdminDashboard() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  if (tab && TAB_REDIRECT[tab]) {
    return <Navigate to={TAB_REDIRECT[tab]} replace />;
  }
  return <AdminDashboardContent />;
}

// 5a — docs/handoff-admin-library/snippets/03_admin_dashboard_users.md.
// 표·차트 없음: 처리할 일 큐 → 지표 스트립 → 눈여겨볼 신호 / 최근 가입.
// 전체 사용자 표는 /admin/users(AdminUsers.tsx)로 옮겨갔다.
function AdminDashboardContent() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const enabled = !!user && can(PERMISSIONS.MANAGE_USERS);

  const { data: queue } = useAdminQueue();
  const pendingApplications = queue?.pendingApplications ?? [];
  const unreadFeedbackCount = queue?.unreadFeedbackCount ?? 0;

  // 신청자 이름 표시용 — teacher_applications엔 user_id만 있어 profiles와 조인해야 한다.
  const { data: applicantNames } = useQuery({
    queryKey: ['admin', 'queueApplicantNames', pendingApplications.map((a) => a.user_id)],
    queryFn: async () => {
      const ids = pendingApplications.map((a) => a.user_id);
      if (ids.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase.from('profiles').select('user_id, name').in('user_id', ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.name])) as Record<string, string>;
    },
    enabled: enabled && pendingApplications.length > 0,
  });

  const { data: signals } = useQuery({
    queryKey: ['admin', 'signals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_signals');
      if (error) throw error;
      return data as unknown as AdminSignals;
    },
    enabled,
  });

  const { data: coverage } = useQuery({
    queryKey: ['admin', 'sentenceBankCoverage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sentence_bank_coverage');
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

  const { data: recentSignups = [] } = useQuery({
    queryKey: ['admin', 'recentSignups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.user_id,
        name: p.name,
        role: p.role as RecentSignup['role'],
        created_at: p.created_at,
      })) as RecentSignup[];
    },
    enabled,
  });

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

  // ── 처리할 일 큐 ──
  type QueueItem = {
    label: string; count: number; unit: string;
    desc: string; cta: string; to: string; toLabel: string;
  };

  const queueItems: QueueItem[] = [
    pendingApplications.length > 0 && {
      label: '선생님 권한 신청',
      count: pendingApplications.length,
      unit: '건',
      desc: pendingApplications
        .slice(0, 3)
        .map((p) => applicantNames?.[p.user_id] || '(이름 없음)')
        .join(' · '),
      cta: '검토하기',
      to: '/admin/teachers',
      toLabel: '선생님 관리',
    },
    unreadFeedbackCount > 0 && {
      label: '읽지 않은 피드백',
      count: unreadFeedbackCount,
      unit: '건',
      desc: `현재 ${unreadFeedbackCount}건이 대기 중입니다`,
      cta: '읽기',
      to: '/admin/feedback',
      toLabel: '피드백',
    },
  ].filter(Boolean) as QueueItem[];

  // ── 지표 스트립 ──
  const totalUsers = (signals?.total_students ?? 0) + (signals?.total_teachers ?? 0);
  // 관리자 수는 신호 RPC에 없어 학생+선생님만으로 역할 구성을 그린다 — 관리자는
  // 소수라 스택 바에서 무시해도 되지만 배지 색만은 미리 맞춰둔다.
  const studentCount = signals?.total_students ?? 0;
  const teacherCount = signals?.total_teachers ?? 0;
  const roleTotal = studentCount + teacherCount || 1;
  const studentPct = pct(studentCount, roleTotal);
  const teacherPct = pct(teacherCount, roleTotal);

  const stats: Stat[] = [
    { label: '전체 사용자', value: `${totalUsers}명` },
    { label: '전체 퀴즈', value: `${signals?.total_quizzes ?? 0}개` },
    { label: '최근 30일 활동 학생', value: `${signals?.active_students_30 ?? 0}명` },
  ];

  // ── 눈여겨볼 신호 ──
  const emptyLevels = (coverage ?? [])
    .filter((c) => c.words_with_2plus === 0)
    .map((c) => c.level);
  const thinLevelNote = emptyLevels.length > 0 ? '학습 문장이 없는 레벨' : '모든 레벨에 문장 있음';

  const signalRows = [
    {
      label: '제출이 한 번도 없는 퀴즈',
      value: `${signals?.zero_submission ?? 0}개`,
      note: `전체 ${signals?.total_quizzes ?? 0}개의 ${pct(signals?.zero_submission ?? 0, signals?.total_quizzes ?? 0)}%`,
      warn: (signals?.zero_submission ?? 0) > 0,
    },
    {
      label: '퀴즈를 만들지 않은 선생님',
      value: `${signals?.idle_teachers ?? 0}명`,
      note: `선생님 ${signals?.total_teachers ?? 0}명 중`,
      warn: (signals?.idle_teachers ?? 0) > 0,
    },
    {
      label: '문장이 없는 레벨',
      value: emptyLevels.join(' · ') || '없음',
      note: thinLevelNote,
      warn: emptyLevels.length > 0,
    },
    {
      label: '최근 30일 활동 학생',
      value: `${signals?.active_students_30 ?? 0}명`,
      note: `전체 학생 ${signals?.total_students ?? 0}명 중 ${pct(signals?.active_students_30 ?? 0, signals?.total_students ?? 0)}%`,
      warn: false,
    },
  ];

  return (
    <AdminPageShell title="관리자 대시보드">
      <div className="space-y-6">
        {/* 처리할 일 큐 */}
        <div>
          <p className="mb-2.5 text-sm text-muted-foreground">
            {queueItems.length > 0 ? `처리할 일 ${queueItems.length}건이 기다리고 있습니다` : '모두 확인했습니다'}
          </p>
          {queueItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <div className="text-[15px] font-extrabold">지금 처리할 일이 없습니다</div>
              <div className="mt-1 text-xs text-muted-foreground">새 신청이나 피드백이 오면 여기에 표시됩니다</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {queueItems.map((q) => (
                <div
                  key={q.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-xl border border-border bg-card px-6 py-[18px] hover:border-primary/25"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[15.5px] font-extrabold">{q.label}</span>
                      <span className="text-[15.5px] font-extrabold tabular-nums text-primary">
                        {q.count}{q.unit}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{q.desc}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11.5px] text-muted-foreground">{q.toLabel}에서</span>
                    <Button asChild>
                      <Link to={q.to}>{q.cta}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 지표 스트립 */}
        <StatStrip stats={stats}>
          <div className="flex-[1.3] px-5 py-4">
            <div className="text-xs font-medium text-muted-foreground">역할 구성</div>
            <div className="mt-3 flex h-[9px] overflow-hidden rounded-full bg-muted">
              <div className={ROLE_BAR.student} style={{ width: `${studentPct}%` }} />
              <div className={ROLE_BAR.teacher} style={{ width: `${teacherPct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
              <StatStripLegend className={ROLE_BAR.student}>학생 {studentCount}</StatStripLegend>
              <StatStripLegend className={ROLE_BAR.teacher}>선생님 {teacherCount}</StatStripLegend>
            </div>
          </div>
        </StatStrip>

        {/* 눈여겨볼 신호 / 최근 가입 */}
        <div className="grid gap-6 md:grid-cols-2 items-start">
          <div className="rounded-xl border border-border bg-card px-6 pb-4 pt-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">눈여겨볼 신호</div>
              <Link to="/admin/report" className="text-[11.5px] text-muted-foreground">
                자세한 추이는 시스템 리포트
              </Link>
            </div>
            <div className="mt-3">
              {signalRows.map((s) => (
                <div
                  key={s.label}
                  className="flex items-baseline justify-between gap-3.5 border-b border-border/50 py-2.5 last:border-0"
                >
                  <span className="text-[13px] text-foreground/80">{s.label}</span>
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className={`text-[15px] font-extrabold tabular-nums ${s.warn ? 'text-warning' : ''}`}>
                      {s.value}
                    </span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">{s.note}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 pb-4 pt-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">최근 가입</div>
              <Link to="/admin/users" className="text-[11.5px] font-semibold text-primary">
                사용자 관리에서 전체 보기 →
              </Link>
            </div>
            <div className="mt-3">
              {recentSignups.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">최근 가입한 사용자가 없습니다</p>
              )}
              {recentSignups.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/50 py-2.5 last:border-0"
                >
                  <span className="truncate text-[13.5px] font-semibold">{u.name || '(이름 없음)'}</span>
                  <RoleBadge role={u.role} />
                  <span className="w-11 text-right text-xs tabular-nums text-muted-foreground" title={formatDateShort(u.created_at)}>
                    {formatRelativeKo(u.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
