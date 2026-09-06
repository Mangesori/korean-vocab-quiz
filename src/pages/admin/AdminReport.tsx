import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getCombinedScore, type CombinableResult } from '@/lib/quizScore';
import { LevelBadge } from '@/components/ui/level-badge';
import { STAGE_ORDER, STAGE_LABELS, isStageEnabled, type BaseStage } from '@/types/quiz';
import { pct } from '@/lib/utils';

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

// 보조 지표 스트립의 한 칸. warn=true면 값이 0보다 클 때만 경고색.
const Cell = ({
  label,
  value,
  warn = false,
  suffix,
}: {
  label: string;
  value: number;
  warn?: boolean;
  suffix?: string;
}) => (
  <div className="flex-1 px-6 py-4">
    <div className="text-xs font-semibold text-muted-foreground">{label}</div>
    <div
      className={`mt-0.5 text-xl font-bold tabular-nums ${
        warn && value > 0 ? 'text-warning' : 'text-foreground'
      }`}
    >
      {value}
    </div>
    {suffix && <div className="text-xs text-muted-foreground">{suffix}</div>}
  </div>
);

// 원래 AdminDashboard.tsx의 ?tab=report 그대로.
export default function AdminReport() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d' | 'month'>('all');
  const [exportingResults, setExportingResults] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin', 'report'],
    queryFn: async () => {
      const [{ data: quizzesData }, { data: resultsData }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.from('quizzes').select('id, difficulty, fill_blank_enabled, sentence_making_enabled, recording_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, created_at'),
        supabase.from('quiz_results').select('quiz_id, student_id, is_anonymous, completed_at, score, total_questions, fill_blank_score, fill_blank_total, matchup_score, matchup_total, type_answer_score, type_answer_total, word_magnet_score, word_magnet_total, sentence_making_score, sentence_making_total, recording_score, recording_total'),
        supabase.rpc('get_user_profiles_with_email'),
      ]);
      if (profilesError) throw profilesError;

      const quizzes: QuizMeta[] = quizzesData || [];
      const results = (resultsData || []) as ResultRow[];
      const profiles = profilesData || [];
      const students = profiles.filter((p) => p.role === 'student').length;
      const userName: Record<string, string> = {};
      for (const p of profiles) userName[p.user_id] = p.name || p.email || '';

      return { quizzes, results, students, totalQuizzes: quizzes.length, userName };
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  const quizzes = data?.quizzes ?? [];
  const results = data?.results ?? [];
  const studentsCount = data?.students ?? 0;
  const totalQuizzes = data?.totalQuizzes ?? 0;
  const userName = data?.userName ?? {};

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
  const monthlyMaxLabels = monthlyTrend.filter((m) => m.count === monthlyMax && m.count > 0).map((m) => m.label);

  // 방치 지표
  const resultQuizIds = new Set(results.map((r) => r.quiz_id));
  const emptyQuizCount = quizzes.filter((q) => !resultQuizIds.has(q.id)).length;
  const activeStudentCount = new Set(
    results
      .filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= thirtyDaysAgo && !r.is_anonymous && r.student_id)
      .map((r) => r.student_id)
  ).size;

  // 정렬(값 내림차순)된 분포 행 — 0값은 막대 없이 "없음"만 표시
  const cefrRows = useMemo(
    () => CEFR_LEVELS.map((level) => ({ level, count: cefrCounts[level] || 0 })).sort((a, b) => b.count - a.count),
    [cefrCounts]
  );
  const typeRows = useMemo(
    () => [...quizTypeStats].sort((a, b) => b.count - a.count),
    [quizTypeStats]
  );

  const pctLabel = (count: number, total: number) => (total > 0 ? `${pct(count, total)}%` : '—');

  // ── CSV 내보내기 ──
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM: Excel 한글
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportResultsCsv = async () => {
    setExportingResults(true);
    try {
      const [{ data: resultsFull, error }, { data: quizRows }] = await Promise.all([
        supabase
          .from('quiz_results')
          .select('quiz_id, student_id, anonymous_name, is_anonymous, completed_at, score, total_questions, fill_blank_score, fill_blank_total, matchup_score, matchup_total, type_answer_score, type_answer_total, word_magnet_score, word_magnet_total, sentence_making_score, sentence_making_total, recording_score, recording_total')
          .order('completed_at', { ascending: false }),
        supabase.from('quizzes').select('id, title'),
      ]);
      if (error) throw error;
      if (!resultsFull || resultsFull.length === 0) { toast.error('내보낼 퀴즈 결과가 없어요'); return; }

      const quizTitle: Record<string, string> = {};
      for (const q of quizRows || []) quizTitle[q.id] = q.title;

      const rows = resultsFull.map((r) => {
        const student = r.is_anonymous ? (r.anonymous_name || '익명') : (r.student_id ? userName[r.student_id] || '(알 수 없음)' : '익명');
        const { score, total } = getCombinedScore(r as CombinableResult);
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        return [
          student,
          quizTitle[r.quiz_id] || '(삭제된 퀴즈)',
          new Date(r.completed_at).toLocaleDateString('ko-KR'),
          score,
          total,
          `${pct}%`,
        ];
      });
      downloadCsv(`나무_퀴즈결과_${new Date().toISOString().slice(0, 10)}.csv`, ['학생', '퀴즈', '완료일', '점수', '총문항', '정답률'], rows);
      toast.success(`퀴즈 결과 ${rows.length}건을 내보냈어요`);
    } catch (e) {
      console.error('Error exporting results:', e);
      toast.error('퀴즈 결과를 내보내지 못했어요');
    } finally {
      setExportingResults(false);
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
    <AdminPageShell title="시스템 리포트">
      <div className="space-y-6">
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

        {/* 주지표 3 */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card px-6 py-5">
            <div className="text-xs font-semibold text-muted-foreground">총 제출 수</div>
            <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums">{totalResults}</div>
            <div className={`text-xs ${thisMonthResults > 0 ? 'text-success' : 'text-muted-foreground'}`}>
              {thisMonthResults > 0 ? `이번 달 +${thisMonthResults}건` : '이번 달 신규 없음'}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 py-5">
            <div className="text-xs font-semibold text-muted-foreground">평균 정답률</div>
            <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums text-primary">
              {avgScore}%
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${avgScore}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 py-5">
            <div className="text-xs font-semibold text-muted-foreground">최근 30일 활동 학생</div>
            <div className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums">{activeStudentCount}</div>
            <div className="text-xs tabular-nums text-muted-foreground">
              전체 학생 {studentsCount}명 중 {pctLabel(activeStudentCount, studentsCount)}
            </div>
          </div>
        </div>

        {/* 보조 지표 스트립 */}
        <div className="flex divide-x divide-border overflow-x-auto rounded-xl border border-border bg-card">
          <Cell label="총 학생 수" value={studentsCount} />
          <Cell label="총 퀴즈 수" value={totalQuizzes} />
          <Cell
            label="제출 0건 퀴즈"
            value={emptyQuizCount}
            warn
            suffix={`전체의 ${pctLabel(emptyQuizCount, totalQuizzes)}`}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CEFR distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CEFR 레벨 분포</CardTitle>
              <CardDescription>퀴즈 {filteredQuizzes.length}개 기준</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 레벨 색은 LevelBadge(.level-a1~.level-c2)가 단일 소스. 값 내림차순 정렬, 0값은 막대 없이 "없음"만. */}
              {cefrRows.map(({ level, count }) => (
                <div key={level} className="grid grid-cols-[104px_1fr_78px] items-center gap-3">
                  <LevelBadge
                    level={level}
                    className={level === '미지정' ? 'bg-muted text-muted-foreground' : undefined}
                  />
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    {count > 0 && (
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct(count, totalQ)}%` }} />
                    )}
                  </div>
                  <span
                    className={`text-right text-xs tabular-nums ${
                      count > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'
                    }`}
                  >
                    {count > 0 ? `${count}개 ${pctLabel(count, totalQ)}` : '없음'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quiz type distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">퀴즈 유형 분포</CardTitle>
              <CardDescription>유형별 포함 퀴즈 수 · 전체 {filteredQuizzes.length}개</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {typeRows.map(({ stage, label, count }) => {
                const barClass = QUIZ_TYPE_BAR_CLASS[stage];
                return (
                  <div key={stage} className="grid grid-cols-[104px_1fr_78px] items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span className={`h-1.5 w-1.5 rounded-full ${barClass}`} />
                      {label}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      {count > 0 && (
                        <div className={`h-full ${barClass}`} style={{ width: `${pct(count, totalQ)}%` }} />
                      )}
                    </div>
                    <span
                      className={`text-right text-xs tabular-nums ${
                        count > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'
                      }`}
                    >
                      {count > 0 ? `${count}개 ${pctLabel(count, totalQ)}` : '없음'}
                    </span>
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
            <CardDescription>
              최근 6개월
              {monthlyMaxLabels.length > 0 && ` · 최고 ${monthlyMax}건 · ${monthlyMaxLabels.join(', ')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[132px] items-end gap-3.5 border-b border-border pt-1.5">
              {monthlyTrend.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span
                    className={`text-[11.5px] font-semibold tabular-nums ${
                      m.count === monthlyMax && m.count > 0
                        ? 'text-foreground'
                        : m.count === 0
                          ? 'text-muted-foreground/50'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {m.count}건
                  </span>
                  {m.count > 0 && (
                    <div
                      className={`w-full max-w-[46px] rounded-t-md ${
                        m.count === monthlyMax ? 'bg-primary' : 'bg-primary/25'
                      }`}
                      style={{ height: `${(m.count / monthlyMax) * 100}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3.5">
              {monthlyTrend.map((m) => (
                <span key={m.key} className="flex-1 text-center text-[11.5px] text-muted-foreground">
                  {m.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
