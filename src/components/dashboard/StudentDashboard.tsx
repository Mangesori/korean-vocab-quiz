import { useState, useMemo, cloneElement } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookMarked,
  BookOpen,
  FileX,
  Home,
  Users,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { LevelBadge } from '@/components/ui/level-badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Assignment {
  id: string;
  quiz_id: string;
  class_id: string | null;
  assigned_at: string;
  quizzes: {
    id: string;
    title: string;
    words: string[];
    difficulty: string;
    sentence_making_enabled: boolean;
    recording_enabled: boolean;
  } | null;
}

interface Result {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  fill_blank_score: number | null;
  fill_blank_total: number | null;
  sentence_making_score: number | null;
  sentence_making_total: number | null;
  recording_score: number | null;
  recording_total: number | null;
  quizzes: {
    title: string;
    sentence_making_enabled: boolean;
    recording_enabled: boolean;
  } | null;
}

interface ClassMembership {
  id: string;
  class_id: string;
  classes: {
    id: string;
    name: string;
  };
}

function CircleProgress({ percent }: { percent: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0">
      <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="9" />
      <circle
        cx="52" cy="52" r={r} fill="none" stroke="white" strokeWidth="9"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 52 52)"
      />
      <text x="52" y="58" textAnchor="middle" fill="white" fontSize="22" fontWeight="700"
        fontFamily="var(--font-mono)">
        {percent}%
      </text>
    </svg>
  );
}

function ScorePill({ score, total }: { score: number | null; total: number | null }) {
  if (score === null || total === null)
    return <span className="text-muted-foreground text-xs">—</span>;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
  return <span className={`font-mono font-bold text-sm ${color}`}>{score}/{total}</span>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['studentDashboard', user?.id],
    queryFn: async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user!.id)
        .single();

      const { data: membershipData } = await supabase
        .from('class_members')
        .select(`id, class_id, classes (id, name)`)
        .eq('student_id', user!.id);

      const classIds = membershipData?.map((m) => m.class_id) || [];

      const { data: assignmentsData } = await supabase
        .from('quiz_assignments')
        .select(`
          id,
          quiz_id,
          class_id,
          assigned_at,
          quizzes (
            id,
            title,
            words,
            difficulty,
            sentence_making_enabled,
            recording_enabled
          )
        `)
        .or(`student_id.eq.${user!.id}${classIds.length ? `,class_id.in.(${classIds.join(',')})` : ''}`)
        .order('assigned_at', { ascending: false });

      const { data: resultsData } = await supabase
        .from('quiz_results')
        .select(`
          id,
          quiz_id,
          score,
          total_questions,
          completed_at,
          fill_blank_score,
          fill_blank_total,
          sentence_making_score,
          sentence_making_total,
          recording_score,
          recording_total,
          quizzes (
            title,
            sentence_making_enabled,
            recording_enabled
          )
        `)
        .eq('student_id', user!.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      const pendingAssignments = (assignmentsData || []).filter((assignment) => {
        return !resultsData?.some((r) => {
          if (r.quiz_id !== assignment.quiz_id) return false;
          if (new Date(r.completed_at) <= new Date(assignment.assigned_at)) return false;
          const q = assignment.quizzes as any;
          const smDone = !q?.sentence_making_enabled || r.sentence_making_score !== null;
          const recDone = !q?.recording_enabled || r.recording_score !== null;
          return smDone && recDone;
        });
      });

      const partialProgressMap: Record<string, boolean> = {};
      pendingAssignments.forEach((a) => {
        const hasPartial = resultsData?.some(
          (r) => r.quiz_id === a.quiz_id && new Date(r.completed_at) > new Date(a.assigned_at)
        );
        if (hasPartial) partialProgressMap[a.quiz_id] = true;
      });

      // class_id → class_name map (inline)
      const classNameMapLocal: Record<string, string> = {};
      (membershipData || []).forEach((m) => {
        classNameMapLocal[m.class_id] = (m.classes as any)?.name || '';
      });

      // quiz_id → class_name (for results table)
      const quizClassMap: Record<string, string> = {};
      (assignmentsData || []).forEach((a) => {
        if (a.quiz_id && a.class_id && classNameMapLocal[a.class_id]) {
          quizClassMap[a.quiz_id] = classNameMapLocal[a.class_id];
        }
      });

      const avgScore =
        resultsData && resultsData.length > 0
          ? Math.round(
              resultsData.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) /
                resultsData.length
            )
          : 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streak = 0;
      let checkDate = new Date(today);
      while (true) {
        const found = resultsData?.some((r) => {
          const d = new Date(r.completed_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === checkDate.getTime();
        });
        if (!found) break;
        streak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      }

      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekResults = resultsData?.filter((r) => new Date(r.completed_at) >= weekStart) || [];
      const weekScore =
        weekResults.length > 0
          ? Math.round(
              weekResults.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) /
                weekResults.length
            )
          : null;

      return {
        profileName: profileData?.name || null,
        classes: (membershipData || []) as ClassMembership[],
        assignments: pendingAssignments as Assignment[],
        results: (resultsData || []) as Result[],
        partialProgressMap,
        quizClassMap,
        stats: {
          totalClasses: membershipData?.length || 0,
          averageScore: avgScore,
          streak,
          weekScore,
        },
      };
    },
    enabled: !!user,
  });

  const profileName = data?.profileName;
  const classes = data?.classes ?? [];
  const assignments = data?.assignments ?? [];
  const results = data?.results ?? [];
  const partialProgressMap = data?.partialProgressMap ?? {};
  const quizClassMap = data?.quizClassMap ?? {};
  const stats = data?.stats ?? { totalClasses: 0, averageScore: 0, streak: 0, weekScore: null };

  const classNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((m) => { map[m.class_id] = m.classes.name; });
    return map;
  }, [classes]);

  const assignmentsByClass = useMemo(() => {
    const groups: { classId: string; className: string; items: Assignment[] }[] = [];
    const seen = new Set<string>();
    assignments.forEach((a) => {
      if (!a.quizzes) return;
      const cid = a.class_id || 'personal';
      if (!seen.has(cid)) {
        seen.add(cid);
        groups.push({
          classId: cid,
          className: cid === 'personal' ? '개인 배정' : (classNameMap[cid] || '알 수 없는 클래스'),
          items: [],
        });
      }
      groups.find((g) => g.classId === cid)!.items.push(a);
    });
    return groups;
  }, [assignments, classNameMap]);

  const heroAssignment = assignments.find((a) => a.quizzes);
  const heroProgress = heroAssignment && partialProgressMap[heroAssignment.quiz_id] ? 30 : 0;

  const heroLastResult = results.find(r => r.quiz_id === heroAssignment?.quiz_id);
  const heroLastStudiedDays = heroLastResult
    ? Math.floor((Date.now() - new Date(heroLastResult.completed_at).getTime()) / 86400000)
    : null;

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      toast.error('초대 코드를 입력해주세요');
      return;
    }
    setIsJoining(true);
    const { data: classData, error: classError } = await supabase
      .rpc('get_class_by_invite_code', { _invite_code: inviteCode.toUpperCase() })
      .single();
    if (classError || !classData) {
      toast.error('유효하지 않은 초대 코드입니다');
      setIsJoining(false);
      return;
    }
    const { data: existingMember } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classData.id)
      .eq('student_id', user?.id)
      .single();
    if (existingMember) {
      toast.error('이미 가입된 클래스입니다');
      setIsJoining(false);
      return;
    }
    const { error: joinError } = await supabase.from('class_members').insert({
      class_id: classData.id,
      student_id: user?.id,
    });
    if (joinError) {
      toast.error('클래스 가입에 실패했습니다');
    } else {
      await supabase.rpc('notify_class_teacher_on_join', { _class_id: classData.id });
      toast.success(`${classData.name} 클래스에 가입했습니다!`);
      setInviteCode('');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['studentDashboard', user?.id] });
    }
    setIsJoining(false);
  };

  const displayName = profileName || user?.email?.split('@')[0] || '';

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-8 w-8 text-primary" />
            안녕하세요, {displayName}님! 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">오늘도 한국어 공부 화이팅!</p>
        </div>

        {/* Hero card */}
        {heroAssignment && (
          <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-primary to-[#155237] text-white py-[30px] px-9">
            {/* Background decoration */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.13]"
              viewBox="0 0 800 400"
              preserveAspectRatio="xMaxYMid slice"
              aria-hidden="true"
            >
              <g fill="#ffffff">
                <path d="M620 -20C520 60 480 180 560 280C660 220 700 100 620 -20Z"/>
                <path d="M620 -20L560 280" stroke="rgba(255,255,255,.5)" strokeWidth="2" fill="none"/>
              </g>
              <g fill="#ffffff" opacity=".7">
                <path d="M720 180C660 220 650 320 720 360C780 320 790 220 720 180Z"/>
                <path d="M720 180L720 360" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" fill="none"/>
              </g>
              <g fill="#ffffff" opacity=".55">
                <path d="M540 340C500 360 480 420 540 440C580 420 600 360 540 340Z"/>
              </g>
              <path d="M-20 380C200 320 400 360 800 280" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" fill="none"/>
            </svg>

            <div className="flex items-center justify-between gap-8">
              {/* Left */}
              <div className="relative z-10 min-w-0">
                <p className="font-ui text-[11px] font-bold tracking-[0.12em] uppercase text-white/75">
                  ▶ {partialProgressMap[heroAssignment.quiz_id] ? '이어서 풀기' : '다음 퀴즈'}
                </p>
                <div className="flex items-center gap-2 mt-[18px] flex-wrap">
                  {heroAssignment.class_id && classNameMap[heroAssignment.class_id] && (
                    <span className="text-[13px] text-white/85 font-medium">
                      {classNameMap[heroAssignment.class_id]}
                    </span>
                  )}
                  <span className="bg-white/20 text-white px-[9px] py-0.5 rounded-full text-[10px] font-bold tracking-[0.04em]">
                    {heroAssignment.quizzes?.difficulty}
                  </span>
                </div>
                <h2 className="font-sans font-bold text-[36px] leading-[1.1] tracking-[-0.02em] mt-1.5 truncate">
                  {heroAssignment.quizzes?.title}
                </h2>
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  <span className="bg-white/15 text-white/90 px-2.5 py-1 rounded-md text-[11px] font-bold">
                    빈칸 채우기
                  </span>
                  {heroAssignment.quizzes?.sentence_making_enabled && (
                    <span className="bg-white/15 text-white/90 px-2.5 py-1 rounded-md text-[11px] font-bold">
                      문장 만들기
                    </span>
                  )}
                  {heroAssignment.quizzes?.recording_enabled && (
                    <span className="bg-white/15 text-white/90 px-2.5 py-1 rounded-md text-[11px] font-bold">
                      말하기 연습
                    </span>
                  )}
                </div>
                <Link to={`/quiz/${heroAssignment.quiz_id}/take`} className="mt-6 inline-block">
                  <Button className="bg-white text-primary hover:bg-white/90 font-bold text-[15px] py-[13px] px-[26px] h-auto gap-1.5">
                    {partialProgressMap[heroAssignment.quiz_id] ? '이어서 풀기' : '지금 풀기'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Right */}
              <div className="relative z-10 shrink-0 flex flex-col items-center gap-2.5">
                <CircleProgress percent={heroProgress} />
                <div className="text-center">
                  <strong className="block text-[13px] font-semibold">
                    {heroAssignment.quizzes?.words?.length ?? 0}개 단어
                  </strong>
                  <span className="text-[11px] text-white/70 font-ui">
                    {heroLastStudiedDays !== null
                      ? `${heroLastStudiedDays}일 전 마지막 학습`
                      : '학습 시작하기'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-[#FEF3C7] flex items-center justify-center text-lg shrink-0">🔥</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground">
                {stats.streak}<span className="text-[13px] text-muted-foreground ml-[3px] font-medium">일</span>
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">연속 학습</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">📈</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground">
                {stats.weekScore !== null ? stats.weekScore : '—'}
                {stats.weekScore !== null && (
                  <span className="text-[13px] text-muted-foreground ml-[3px] font-medium">점</span>
                )}
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">이번 주 점수</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-[#DBEAFE] flex items-center justify-center text-lg shrink-0">🎯</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground">
                {stats.averageScore}<span className="text-[13px] text-muted-foreground ml-[3px] font-medium">%</span>
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">평균 정답률</div>
            </div>
          </div>
        </div>

        {/* Utilities — 3-col */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-[11px] px-[15px] py-[13px]">
                  <div className="w-[34px] h-[34px] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-[15px] h-[15px] text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">클래스 가입</p>
                    <p className="text-[11px] text-muted-foreground">초대 코드로 가입</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[11px] h-7 px-3 py-0 border-primary/30 text-primary shrink-0 pointer-events-none">
                    코드 입력
                  </Button>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>클래스 가입</DialogTitle>
                <DialogDescription>선생님께 받은 6자리 초대 코드를 입력하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="초대 코드 (예: ABC123)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
                <Button className="w-full" onClick={handleJoinClass} disabled={isJoining}>
                  {isJoining ? '가입 중...' : '가입하기'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Link to="/vocabulary">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-[11px] px-[15px] py-[13px]">
                <div className="w-[34px] h-[34px] rounded-lg bg-[#DCFCE7] flex items-center justify-center shrink-0">
                  <BookMarked className="w-[15px] h-[15px] text-[#15803D]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">나만의 단어장</p>
                  <p className="text-[11px] text-muted-foreground">저장한 단어 복습</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/wrong-answers">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-[11px] px-[15px] py-[13px]">
                <div className="w-[34px] h-[34px] rounded-lg bg-[#FEE2E2] flex items-center justify-center shrink-0">
                  <FileX className="w-[15px] h-[15px] text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">오답 노트</p>
                  <p className="text-[11px] text-muted-foreground">틀린 문제 다시 보기</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Assignments grouped by class — single card */}
        {assignmentsByClass.length > 0 && (
          <Card className="overflow-hidden mb-8" style={{ padding: 0 }}>
            {/* Section header */}
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
              <div>
                <span className="text-[14px] font-bold">풀어야 할 퀴즈</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">아직 완료하지 않은 퀴즈</span>
              </div>
              <Link to="/my-quizzes" className="text-xs text-primary hover:underline flex items-center gap-1">
                전체 보기 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {assignmentsByClass.map((group, gIdx) => (
              <div
                key={group.classId}
                className={`px-[18px] py-3 ${gIdx > 0 ? 'border-t border-border' : ''}`}
              >
                {/* Class subheader */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="font-ui text-[10px] font-bold text-muted-foreground uppercase tracking-[.06em]">
                      {group.className}
                    </span>
                  </div>
                  {group.classId !== 'personal' && (
                    <Link to={`/class/${group.classId}`} className="text-[10px] text-primary hover:underline">
                      상세보기 ›
                    </Link>
                  )}
                </div>

                {/* Quiz items — individual bordered boxes */}
                <div className="space-y-[7px] pb-2">
                  {group.items.map((assignment) => {
                    const q = assignment.quizzes!;
                    const isPartial = partialProgressMap[assignment.quiz_id];
                    const quizType = {
                      icon: <BookOpen />,
                      bg: 'bg-primary/10',
                      iconColor: 'text-primary',
                    };

                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center gap-[11px] px-3 py-[10px] border border-border rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${quizType.bg}`}>
                          {cloneElement(quizType.icon, {
                            className: `w-[13px] h-[13px] ${quizType.iconColor}`,
                          })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold truncate">{q.title}</p>
                          <div className="flex items-center gap-1 mt-[3px] flex-wrap">
                            <span className="font-ui text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-px rounded">
                              빈칸
                            </span>
                            {q.sentence_making_enabled && (
                              <span className="font-ui text-[10px] font-bold bg-[#EDE9FE] text-purple-700 px-1.5 py-px rounded">
                                문장
                              </span>
                            )}
                            {q.recording_enabled && (
                              <span className="font-ui text-[10px] font-bold bg-[#FEE2E2] text-destructive px-1.5 py-px rounded">
                                말하기
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-ui ml-0.5">
                              · {q.difficulty} · {q.words?.length ?? 0}개 단어
                            </span>
                          </div>
                        </div>
                        <Link to={`/quiz/${assignment.quiz_id}/take`} className="shrink-0">
                          <Button
                            size="sm"
                            className={`h-7 text-xs px-3 ${isPartial ? 'bg-warning hover:bg-warning/90 text-white' : ''}`}
                          >
                            {isPartial ? '이어서 풀기' : '풀기'}
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Recent Results Table */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-[14px] px-[18px]">
              <div>
                <CardTitle className="text-[14px] font-bold">최근 결과</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">완료한 퀴즈 기록</p>
              </div>
              <Link to="/my-quizzes" className="text-[11px] text-primary hover:underline">
                전체 보기 ›
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>퀴즈</TableHead>
                      <TableHead className="whitespace-nowrap text-center">빈칸</TableHead>
                      <TableHead className="whitespace-nowrap text-center">문장</TableHead>
                      <TableHead className="whitespace-nowrap text-center">말하기</TableHead>
                      <TableHead className="whitespace-nowrap">날짜</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.filter((r) => r.quizzes).map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="font-semibold text-[13px] truncate max-w-[140px]">
                            {result.quizzes?.title}
                          </div>
                          {quizClassMap[result.quiz_id] && (
                            <div className="text-[11px] text-muted-foreground">
                              {quizClassMap[result.quiz_id]}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <ScorePill score={result.fill_blank_score} total={result.fill_blank_total} />
                        </TableCell>
                        <TableCell className="text-center">
                          {result.quizzes?.sentence_making_enabled ? (
                            <ScorePill score={result.sentence_making_score} total={result.sentence_making_total} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {result.quizzes?.recording_enabled ? (
                            <ScorePill score={result.recording_score} total={result.recording_total} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          {format(new Date(result.completed_at), 'MM-dd')}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/quiz/${result.quiz_id}/result/${result.id}`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                                결과 확인
                              </Button>
                            </Link>
                            <Link to={`/quiz/${result.quiz_id}/take`}>
                              <Button size="sm" className="h-7 text-xs px-2.5">
                                다시 풀기
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {assignments.length === 0 && results.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">아직 배정된 퀴즈가 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">선생님께 초대 코드를 받아 클래스에 가입하세요</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
