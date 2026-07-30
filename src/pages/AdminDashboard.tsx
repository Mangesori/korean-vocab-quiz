import { useState, useMemo, type ReactNode } from 'react';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
import { Users, GraduationCap, Shield, Search, RefreshCw, FileText, Download, Check, X, Clock, Trash2, MessageSquare, Star } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { getCombinedScore, type CombinableResult } from '@/lib/quizScore';
import { LevelBadge } from '@/components/ui/level-badge';
import { formatDateShort, formatDateFull } from '@/lib/formatDate';
import { STAGE_ORDER, STAGE_LABELS, isStageEnabled, type BaseStage } from '@/types/quiz';

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
  id: string;
  difficulty: string | null;
  fill_blank_enabled: boolean;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
  matchup_enabled: boolean;
  type_answer_enabled: boolean;
  word_magnet_enabled: boolean;
  created_at?: string;
}

interface ResultRow extends CombinableResult {
  quiz_id: string;
  student_id: string | null;
  is_anonymous: boolean | null;
  completed_at: string;
}

interface Growth {
  users: number;
  teachers: number;
  classes: number;
  quizzes: number;
}

// 사이드바로 전환되는 현재 뷰에 맞춘 페이지 헤더 (본문 탭 바 제거 후 위치 안내 역할)
// 아이콘 색은 전 페이지 공통 규격(text-primary)이라 h1에서 한 번만 적용한다.
const PAGE_HEADINGS = {
  dashboard: { icon: Shield, title: "관리자 대시보드" },
  teachers: { icon: GraduationCap, title: "선생님 관리" },
  report: { icon: FileText, title: "시스템 리포트" },
  feedback: { icon: MessageSquare, title: "피드백" },
} as const;

const CONTEXT_LABEL: Record<string, string> = {
  quiz_result: '퀴즈 결과',
  share_result: '공유 퀴즈 결과',
  footer: '푸터',
  pricing_enterprise: '요금(기관 문의)',
  help_center: '도움말 센터',
  help_search_empty: '도움말 검색(결과 없음)',
  help_article: '도움말 문서',
  not_found: '404 페이지',
};

// 역할 분포 도넛 색 — 역할(role) 축 전용.
// 퀴즈 유형(--type-*)·CEFR(.level-*)과 의미가 다르므로 그 팔레트를 재사용하지 않는다.
// (역할용 시맨틱 토큰이 index.css에 아직 없어 값은 하드코딩 유지)
const ROLE_COLORS = {
  student: '#1E6B47',
  teacher: '#1D4ED8',
  admin: '#C13B2E',
} as const;

// 퀴즈 유형 막대 색 — index.css의 --type-* 토큰(tailwind `type-*`)에서만 가져온다.
// Tailwind JIT가 스캔할 수 있도록 클래스명을 정적 문자열로 둔다.
const QUIZ_TYPE_BAR_CLASS: Record<BaseStage, string> = {
  matchup: 'bg-type-matchup',
  type_answer: 'bg-type-type-answer',
  fill_blank: 'bg-type-fill-blank',
  word_magnet: 'bg-type-word-magnet',
  sentence_making: 'bg-type-sentence-making',
  recording: 'bg-type-recording',
};

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '미지정'] as const;

// KPI 라벨. unfiltered=true면 기간 필터를 따르지 않는 카드라는 뜻이라
// "· 전체 기간" 캡션을 붙여 필터를 타는 카드와 구분한다.
const KpiLabel = ({ children, unfiltered = false }: { children: ReactNode; unfiltered?: boolean }) => (
  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">
    {children}
    {unfiltered && <span className="ml-1 text-[10px] text-muted-foreground/60">· 전체 기간</span>}
  </div>
);

const GrowthNote = ({ n, unit }: { n: number; unit: string }) => (
  <div className={`font-ui text-[11px] mt-[5px] ${n > 0 ? 'text-success' : 'text-muted-foreground'}`}>
    {n > 0 ? `이번 달 +${n}${unit}` : '이번 달 신규 없음'}
  </div>
);

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const PageHeading = PAGE_HEADINGS[activeTab as keyof typeof PAGE_HEADINGS] ?? PAGE_HEADINGS.dashboard;
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d' | 'month'>('all');

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
        { data: classesData },
        { data: quizzesData },
        { data: resultsData },
        { data: applicationsData },
      ] = await Promise.all([
        supabase.from('classes').select('created_at'),
        supabase.from('quizzes').select('id, difficulty, fill_blank_enabled, sentence_making_enabled, recording_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, created_at'),
        supabase.from('quiz_results').select('quiz_id, student_id, is_anonymous, completed_at, score, total_questions, fill_blank_score, fill_blank_total, matchup_score, matchup_total, type_answer_score, type_answer_total, word_magnet_score, word_magnet_total, sentence_making_score, sentence_making_total, recording_score, recording_total'),
        supabase.from('teacher_applications').select('id, user_id, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      const quizzes: QuizMeta[] = quizzesData || [];
      const classes = classesData || [];

      // 이번 달 신규 증가량 (created_at 기준, 월초 00:00부터)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const som = startOfMonth.getTime();
      const isThisMonth = (d?: string | null) => !!d && new Date(d).getTime() >= som;
      const growth: Growth = {
        users: usersWithProfiles.filter(u => isThisMonth(u.created_at)).length,
        teachers: usersWithProfiles.filter(u => u.role === 'teacher' && isThisMonth(u.created_at)).length,
        classes: classes.filter(c => isThisMonth(c.created_at)).length,
        quizzes: quizzes.filter(q => isThisMonth(q.created_at)).length,
      };

      return {
        users: usersWithProfiles,
        stats: {
          totalUsers: usersWithProfiles.length,
          admins,
          teachers,
          students,
          totalClasses: classes.length,
          totalQuizzes: quizzes.length,
        } as Stats,
        growth,
        report: {
          results: (resultsData || []) as ResultRow[],
          quizzes,
        },
        pendingApplications: (applicationsData as unknown as { id: string; user_id: string; created_at: string }[] | null) || [],
      };
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  // 피드백 목록 (피드백 탭)
  const { data: feedbackList = [], isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery({
    queryKey: ['adminFeedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, message, email, rating, context, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as {
        id: string; message: string; email: string | null; rating: number | null; context: string | null; created_at: string;
      }[]) || [];
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS) && activeTab === 'feedback',
  });

  const users = data?.users ?? [];
  const stats = data?.stats ?? {
    totalUsers: 0, admins: 0, teachers: 0, students: 0, totalClasses: 0, totalQuizzes: 0,
  };
  const growth = data?.growth ?? { users: 0, teachers: 0, classes: 0, quizzes: 0 };
  const report = data?.report ?? { results: [] as ResultRow[], quizzes: [] as QuizMeta[] };
  const pendingApplications = data?.pendingApplications ?? [];

  // 신청 user_id → 사용자 정보 매핑 (이름·이메일 표시용)
  const pendingTeachers = pendingApplications.map((app) => {
    const u = users.find((x) => x.user_id === app.user_id);
    return {
      applicationId: app.id,
      userId: app.user_id,
      name: u?.profile?.name || '(이름 없음)',
      email: u?.email || '(이메일 없음)',
      createdAt: app.created_at,
    };
  });

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'teacher' | 'student') => {
    if (userId === user?.id) {
      toast.error('자신의 역할은 바꿀 수 없어요');
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

      toast.success('역할을 변경했어요');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('역할을 변경하지 못했어요');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // ── 선생님 신청 승인/거절 ──
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);

  const handleApproveTeacher = async (userId: string, applicationId: string) => {
    setReviewingAppId(applicationId);
    try {
      // 1) 역할 승격
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'teacher' })
        .eq('user_id', userId);
      if (roleError) throw roleError;

      // 2) 신청 처리 기록
      const { error: appError } = await supabase
        .from('teacher_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', applicationId);
      if (appError) throw appError;

      // 캐시 갱신: 대기 목록에서 제거 + 역할/통계 반영
      queryClient.setQueryData(['adminDashboard'], (prev: typeof data) => {
        if (!prev) return prev;
        const wasStudent = prev.users.find((u) => u.user_id === userId)?.role === 'student';
        return {
          ...prev,
          users: prev.users.map((u) => (u.user_id === userId ? { ...u, role: 'teacher' as const } : u)),
          stats: {
            ...prev.stats,
            teachers: prev.stats.teachers + 1,
            students: wasStudent ? prev.stats.students - 1 : prev.stats.students,
          },
          pendingApplications: prev.pendingApplications.filter((a) => a.id !== applicationId),
        };
      });

      toast.success('선생님으로 승인했어요');
    } catch (error) {
      console.error('Error approving teacher:', error);
      toast.error('승인하지 못했어요');
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

      queryClient.setQueryData(['adminDashboard'], (prev: typeof data) => {
        if (!prev) return prev;
        return { ...prev, pendingApplications: prev.pendingApplications.filter((a) => a.id !== applicationId) };
      });

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

      const removedRole = deletingUser.role;
      queryClient.setQueryData(['adminDashboard'], (prev: typeof data) => {
        if (!prev) return prev;
        const newStats = { ...prev.stats, totalUsers: prev.stats.totalUsers - 1 };
        if (removedRole === 'admin') newStats.admins--;
        else if (removedRole === 'teacher') newStats.teachers--;
        else newStats.students--;
        return {
          ...prev,
          users: prev.users.filter((u) => u.user_id !== targetId),
          stats: newStats,
          pendingApplications: prev.pendingApplications.filter((a) => a.user_id !== targetId),
        };
      });

      toast.success('계정을 삭제했어요');
      setDeletingUser(null);
    } catch (e) {
      console.error('Error deleting user:', e);
      toast.error('계정을 삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── CSV 내보내기 ──
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM: Excel 한글
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const roleLabel = (r: string) => (r === "admin" ? "관리자" : r === "teacher" ? "선생님" : "학생");

  const exportUsersCsv = () => {
    if (users.length === 0) { toast.error("내보낼 사용자가 없어요"); return; }
    const rows = users.map((u) => [
      u.profile?.name || "",
      u.email || "",
      roleLabel(u.role),
      new Date(u.created_at).toLocaleDateString("ko-KR"),
    ]);
    downloadCsv(`나무_사용자_${new Date().toISOString().slice(0, 10)}.csv`, ["이름", "이메일", "역할", "가입일"], rows);
    toast.success(`사용자 ${users.length}명을 내보냈어요`);
  };

  const [exportingResults, setExportingResults] = useState(false);
  const exportResultsCsv = async () => {
    setExportingResults(true);
    try {
      const [{ data: results, error }, { data: quizRows }] = await Promise.all([
        supabase
          .from("quiz_results")
          .select("quiz_id, student_id, anonymous_name, is_anonymous, completed_at, score, total_questions, fill_blank_score, fill_blank_total, matchup_score, matchup_total, type_answer_score, type_answer_total, word_magnet_score, word_magnet_total, sentence_making_score, sentence_making_total, recording_score, recording_total")
          .order("completed_at", { ascending: false }),
        supabase.from("quizzes").select("id, title"),
      ]);
      if (error) throw error;
      if (!results || results.length === 0) { toast.error("내보낼 퀴즈 결과가 없어요"); return; }

      const quizTitle: Record<string, string> = {};
      for (const q of quizRows || []) quizTitle[q.id] = q.title;
      const userName: Record<string, string> = {};
      for (const u of users) userName[u.user_id] = u.profile?.name || u.email || "";

      const rows = results.map((r) => {
        const student = r.is_anonymous ? (r.anonymous_name || "익명") : (r.student_id ? userName[r.student_id] || "(알 수 없음)" : "익명");
        const { score, total } = getCombinedScore(r);
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        return [
          student,
          quizTitle[r.quiz_id] || "(삭제된 퀴즈)",
          new Date(r.completed_at).toLocaleDateString("ko-KR"),
          score,
          total,
          `${pct}%`,
        ];
      });
      downloadCsv(`나무_퀴즈결과_${new Date().toISOString().slice(0, 10)}.csv`, ["학생", "퀴즈", "완료일", "점수", "총문항", "정답률"], rows);
      toast.success(`퀴즈 결과 ${rows.length}건을 내보냈어요`);
    } catch (e) {
      console.error("Error exporting results:", e);
      toast.error("퀴즈 결과를 내보내지 못했어요");
    } finally {
      setExportingResults(false);
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

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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

  // Role distribution donut — 학생 > 선생님 > 관리자 순, 의미색 고정
  const DONUT_R = 56;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  const roleSegments = [
    { label: '학생', count: stats.students, pct: studentPct, color: ROLE_COLORS.student },
    { label: '선생님', count: stats.teachers, pct: teacherPct, color: ROLE_COLORS.teacher },
    { label: '관리자', count: stats.admins, pct: adminPct, color: ROLE_COLORS.admin },
  ];
  let donutOffset = 0;
  const donutArcs = roleSegments.map((seg) => {
    const len = (seg.count / total) * DONUT_C;
    const arc = { ...seg, len, offset: -donutOffset };
    donutOffset += len;
    return arc;
  });

  // ── 시스템 리포트 파생 지표 ──
  const results = report.results;
  const quizzes = report.quizzes;

  // 기간 경계
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const somDate = new Date();
  somDate.setDate(1);
  somDate.setHours(0, 0, 0, 0);
  const somMs = somDate.getTime();

  // periodFilter 적용된 배열
  const { filteredResults, filteredQuizzes } = useMemo(() => {
    if (periodFilter === 'all') {
      return { filteredResults: results, filteredQuizzes: quizzes };
    }
    const boundary = periodFilter === '30d' ? thirtyDaysAgo : somMs;
    return {
      filteredResults: results.filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= boundary),
      filteredQuizzes: quizzes.filter((q) => q.created_at && new Date(q.created_at).getTime() >= boundary),
    };
  }, [results, quizzes, periodFilter, thirtyDaysAgo, somMs]);

  const totalResults = filteredResults.length;
  const avgScore = useMemo(() => {
    const agg = filteredResults.reduce(
      (acc, r) => {
        const { score, total } = getCombinedScore(r);
        acc.score += score;
        acc.total += total;
        return acc;
      },
      { score: 0, total: 0 }
    );
    return agg.total > 0 ? Math.round((agg.score / agg.total) * 100) : 0;
  }, [filteredResults]);

  // CEFR distribution (filteredQuizzes 기준, '미지정' 포함)
  const totalQ = filteredQuizzes.length || 1;
  const cefrCounts = useMemo(
    () =>
      CEFR_LEVELS.reduce((acc, level) => {
        acc[level] = level === '미지정'
          ? filteredQuizzes.filter((q) => q.difficulty == null).length
          : filteredQuizzes.filter((q) => q.difficulty === level).length;
        return acc;
      }, {} as Record<string, number>),
    [filteredQuizzes]
  );

  // Quiz type distribution — 유형별 포함 퀴즈 수.
  // 순서·라벨·활성 판정은 모두 src/types/quiz.ts의 단일 소스를 따른다
  // (fill_blank만 DEFAULT true라 판정이 다른데, isStageEnabled가 그 차이를 흡수한다).
  const quizTypeStats = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        count: filteredQuizzes.filter((q) =>
          isStageEnabled(stage, q as unknown as Record<string, unknown>)
        ).length,
      })),
    [filteredQuizzes]
  );

  // 고정 창 지표 (periodFilter와 무관)
  const thisMonthResults = results.filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= somMs).length;

  // 월별 추이 (최근 6개월)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, label: `${d.getMonth() + 1}월`, count: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i] as const));
    for (const r of results) {
      if (!r.completed_at) continue;
      const d = new Date(r.completed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const i = idx.get(key);
      if (i !== undefined) buckets[i].count++;
    }
    return buckets;
  }, [results]);
  const monthlyMax = Math.max(1, ...monthlyTrend.map((m) => m.count));

  // 방치 지표
  const resultQuizIds = new Set(results.map((r) => r.quiz_id));
  const emptyQuizCount = quizzes.filter((q) => !resultQuizIds.has(q.id)).length;
  const activeStudentCount = new Set(
    results
      .filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= thirtyDaysAgo && !r.is_anonymous && r.student_id)
      .map((r) => r.student_id)
  ).size;

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
                <TableHead className="w-[120px]">현재 역할</TableHead>
                <TableHead className="w-[100px]">가입일</TableHead>
                <TableHead className="w-[130px]">역할 변경</TableHead>
                <TableHead className="w-[60px] text-right">관리</TableHead>
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
                    {formatDateShort(u.created_at)}
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
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="teacher">선생님</SelectItem>
                          <SelectItem value="student">학생</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingUser(u)}
                        aria-label="계정 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                  가입일: {formatDateShort(u.created_at)}
                </span>
                {u.user_id === user?.id ? (
                  <span className="text-sm text-muted-foreground">변경 불가</span>
                ) : (
                  <div className="flex items-center gap-2">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setDeletingUser(u)}
                      aria-label="계정 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PageHeading.icon className="h-6 w-6 text-primary" />
            {PageHeading.title}
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams(v === "dashboard" ? {} : { tab: v })}>
          {/* ── 대시보드 탭 ── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 사용자</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalUsers}</div>
                  <GrowthNote n={growth.users} unit="명" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 선생님</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.teachers}</div>
                  <GrowthNote n={growth.teachers} unit="명" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 클래스</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalClasses}</div>
                  <GrowthNote n={growth.classes} unit="개" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-[18px]">
                  <div className="font-ui text-[11px] text-muted-foreground mb-[6px]">전체 퀴즈</div>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalQuizzes}</div>
                  <GrowthNote n={growth.quizzes} unit="개" />
                </CardContent>
              </Card>
            </div>

            {/* 메인(사용자) 좌측 + 사이드 레일(사용자 분포·퀵 액션) 우측 */}
            <div className="grid lg:grid-cols-4 gap-6 items-start">
              {/* LEFT: All users */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>전체 사용자</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="이름 또는 이메일 검색..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 w-full sm:w-64"
                        />
                      </div>
                      <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 역할</SelectItem>
                          <SelectItem value="student">학생</SelectItem>
                          <SelectItem value="teacher">선생님</SelectItem>
                          <SelectItem value="admin">관리자</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <UserTable
                    list={filteredUsers}
                    emptyMsg={searchTerm || roleFilter !== 'all' ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                  />
                </CardContent>
              </Card>

              {/* RIGHT rail: 사용자 분포(위) + 퀵 액션(아래) */}
              <div className="space-y-6">
                {/* 사용자 분포 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">사용자 분포</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    {/* 도넛 차트 */}
                    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
                      <circle cx="70" cy="70" r={DONUT_R} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
                      {donutArcs.map((arc) => (
                        <circle
                          key={arc.label}
                          cx="70" cy="70" r={DONUT_R}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth="18"
                          strokeDasharray={`${arc.len} ${DONUT_C - arc.len}`}
                          strokeDashoffset={arc.offset}
                          transform="rotate(-90 70 70)"
                        />
                      ))}
                      <text x="70" y="68" textAnchor="middle" className="font-mono font-bold" fontSize="22" fill="hsl(var(--foreground))">{stats.totalUsers}</text>
                      <text x="70" y="86" textAnchor="middle" className="font-ui" fontSize="10" fill="hsl(var(--muted-foreground))">전체 사용자</text>
                    </svg>
                    {/* 범례 */}
                    <div className="w-full space-y-2.5">
                      {donutArcs.map((arc) => (
                        <div key={arc.label} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: arc.color }} />
                            {arc.label}
                          </span>
                          <span className="font-mono font-semibold">
                            {arc.count} <span className="text-muted-foreground font-normal">· {arc.pct}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 퀵 액션 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">내보내기</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" className="justify-start gap-2" onClick={exportUsersCsv}>
                      <Download className="h-4 w-4" />사용자 목록 내보내기
                    </Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={exportResultsCsv} disabled={exportingResults}>
                      {exportingResults ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      퀴즈 결과 내보내기
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── 선생님 관리 탭 ── */}
          <TabsContent value="teachers" className="space-y-6">
            {/* 검토 대기 신청 */}
            {pendingTeachers.length > 0 && (
              <Card className="border-warning/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-warning" />
                    검토 대기
                    <Badge variant="secondary" className="ml-1">{pendingTeachers.length}</Badge>
                  </CardTitle>
                  <CardDescription>선생님 권한을 신청한 사용자입니다. 승인하면 즉시 선생님으로 전환됩니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingTeachers.map((t) => (
                    <div
                      key={t.applicationId}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          신청일: {formatDateShort(t.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => handleApproveTeacher(t.userId, t.applicationId)}
                          disabled={reviewingAppId === t.applicationId}
                        >
                          <Check className="h-4 w-4" />승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleRejectTeacher(t.applicationId)}
                          disabled={reviewingAppId === t.applicationId}
                        >
                          <X className="h-4 w-4" />거절
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>계정 목록</CardTitle>
                    <CardDescription>등록된 선생님 {teacherUsers.length}명 · 역할 변경 가능</CardDescription>
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
            {/* 기간 필터 + CSV 내보내기 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as typeof periodFilter)}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기간</SelectItem>
                  <SelectItem value="30d">최근 30일</SelectItem>
                  <SelectItem value="month">이번 달</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={exportResultsCsv} disabled={exportingResults}>
                {exportingResults ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                CSV 내보내기
              </Button>
            </div>

            {/* KPI + 방치 지표 통합 그리드 (3열×2행, 빈 공간 없이 한 블록) */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel>총 제출 수</KpiLabel>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{totalResults}</div>
                  <GrowthNote n={thisMonthResults} unit="건" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel>평균 정답률</KpiLabel>
                  <div className="font-mono font-bold text-[26px] leading-none text-primary">{avgScore}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel unfiltered>최근 30일 활동 학생</KpiLabel>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{activeStudentCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel unfiltered>총 학생 수</KpiLabel>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.students}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel unfiltered>총 퀴즈 수</KpiLabel>
                  <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalQuizzes}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-[18px]">
                  <KpiLabel unfiltered>제출 0건 퀴즈</KpiLabel>
                  <div className={`font-mono font-bold text-[26px] leading-none ${emptyQuizCount > 0 ? 'text-warning' : 'text-foreground'}`}>
                    {emptyQuizCount}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* CEFR distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CEFR 레벨 분포</CardTitle>
                  <CardDescription>퀴즈 {filteredQuizzes.length}개 기준</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 레벨 색은 LevelBadge(.level-a1~.level-c2)가 단일 소스.
                      막대는 크기만 나타내는 중립색이라 유형 색과 의미가 겹치지 않는다. */}
                  {CEFR_LEVELS.map((level) => {
                    const count = cefrCounts[level] || 0;
                    const pct = Math.round((count / totalQ) * 100);
                    return (
                      <div key={level} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <LevelBadge
                            level={level}
                            className={level === '미지정' ? 'bg-muted text-muted-foreground' : undefined}
                          />
                          <span className="text-muted-foreground">{count}개 ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
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
                  <CardDescription>유형별 포함 퀴즈 수 · 전체 {filteredQuizzes.length}개</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quizTypeStats.map(({ stage, label, count }) => {
                    const pct = Math.round((count / totalQ) * 100);
                    const barClass = QUIZ_TYPE_BAR_CLASS[stage];
                    return (
                      <div key={stage} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-sm ${barClass}`} />
                            {label}
                          </span>
                          <span className="text-muted-foreground">{count}개 ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* 월별 제출 추이 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">월별 제출 추이</CardTitle>
                <CardDescription>최근 6개월</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {monthlyTrend.map((m) => {
                  const pct = Math.round((m.count / monthlyMax) * 100);
                  return (
                    <div key={m.key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-mono">{m.label}</span>
                        <span className="text-muted-foreground">{m.count}건</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 피드백 탭 ── */}
          <TabsContent value="feedback" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>의견 목록</CardTitle>
                    <CardDescription>사용자가 퀴즈 결과·푸터·요금 페이지에서 남긴 의견 ({feedbackList.length}건)</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => refetchFeedback()} disabled={feedbackLoading}>
                    <RefreshCw className={`h-4 w-4 ${feedbackLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {feedbackLoading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : feedbackList.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">아직 받은 피드백이 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {feedbackList.map((f) => (
                      <div key={f.id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {f.rating != null && (
                              <span className="flex items-center gap-0.5">
                                {Array.from({ length: f.rating }).map((_, i) => (
                                  <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
                                ))}
                              </span>
                            )}
                            {f.context && (
                              <Badge variant="secondary" className="text-xs">{CONTEXT_LABEL[f.context] ?? f.context}</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateFull(f.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{f.message}</p>
                        {f.email && (
                          <p className="text-xs text-muted-foreground">↳ {f.email}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
    </AppLayout>
  );
}
