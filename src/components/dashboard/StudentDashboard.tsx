import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PendingTeacherBanner } from '@/components/dashboard/PendingTeacherBanner';
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
import { formatDateCompact } from '@/lib/formatDate';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QuizTypeScoreBadges } from "@/components/quiz/shared/QuizTypeScoreBadges";
import { BaseStage, STAGE_ORDER, STAGE_SHORT_LABELS, isStageEnabled } from '@/types/quiz';

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
    fill_blank_enabled: boolean;
    matchup_enabled: boolean;
    type_answer_enabled: boolean;
    word_magnet_enabled: boolean;
    sentence_making_enabled: boolean;
    recording_enabled: boolean;
  } | null;
}

/** get_student_wrong_answers RPC가 돌려주는 오답 한 건(필요한 필드만). */
interface WrongAnswerRow {
  word?: string | null;
  correct_answer?: string | null;
  sentence?: string | null;
  translation?: string | null;
  audio_url?: string | null;
  source?: string | null;
}

/** 오늘의 복습 미니 세션에 넘길 문제 — WrongAnswerPractice가 localStorage로 읽는 형식. */
interface PracticeProblem {
  id: string;
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  audio_url: string | null;
  source: string;
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
  matchup_score: number | null;
  matchup_total: number | null;
  type_answer_score: number | null;
  type_answer_total: number | null;
  word_magnet_score: number | null;
  word_magnet_total: number | null;
  quizzes: {
    title: string;
    fill_blank_enabled: boolean;
    sentence_making_enabled: boolean;
    recording_enabled: boolean;
    matchup_enabled: boolean;
    type_answer_enabled: boolean;
    word_magnet_enabled: boolean;
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

// 연속 학습 집계 범위(일). 이 범위를 넘는 연속 기록은 상한값으로 표시된다.
const STREAK_WINDOW_DAYS = 365;
// "오늘의 복습" 미니 세션 문제 수.
const TODAY_REVIEW_SIZE = 5;

// 스테이지 → quiz_results의 점수 컬럼. 점수가 null이면 그 스테이지는 미완료다.
// (QuizTake의 이어풀기 판정과 동일한 규칙 — 대시보드 진행률이 실제 재개 지점과 어긋나지 않게 한다.)
const STAGE_SCORE_KEY: Record<BaseStage, string> = {
  matchup: 'matchup_score',
  type_answer: 'type_answer_score',
  fill_blank: 'fill_blank_score',
  word_magnet: 'word_magnet_score',
  sentence_making: 'sentence_making_score',
  recording: 'recording_score',
};

/** 스테이지 플래그·점수를 컬럼명으로 조회하기 위한 좁히기(퀴즈/결과 행 모두 평범한 객체다). */
function asRow(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function stageScore(result: Record<string, unknown>, stage: BaseStage): number | null {
  const value = result[STAGE_SCORE_KEY[stage]];
  return typeof value === 'number' ? value : null;
}

/** 결과 한 건 기준으로, 해당 퀴즈의 활성 스테이지가 전부 채점됐는지. */
function isResultComplete(quiz: Record<string, unknown>, result: Record<string, unknown>): boolean {
  return STAGE_ORDER.every((stage) => !isStageEnabled(stage, quiz) || stageScore(result, stage) !== null);
}

/** 단어별 마스터 판정 — 2회 연속 정답(correct_streak >= 2)이면 mastered_at이 찍힌다. */
function isMastered(row: { mastered_at?: string | null; correct_streak?: number | null }): boolean {
  return row.mastered_at != null || (row.correct_streak ?? 0) >= 2;
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

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
            fill_blank_enabled,
            matchup_enabled,
            type_answer_enabled,
            word_magnet_enabled,
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
          matchup_score,
          matchup_total,
          type_answer_score,
          type_answer_total,
          word_magnet_score,
          word_magnet_total,
          quizzes (
            title,
            fill_blank_enabled,
            sentence_making_enabled,
            recording_enabled,
            matchup_enabled,
            type_answer_enabled,
            word_magnet_enabled
          )
        `)
        .eq('student_id', user!.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      // 완료 판정: 활성 스테이지가 전부 채점된 결과가 배정일 이후에 있으면 완료.
      // (기존에는 문장 만들기·말하기만 확인해서, 짝 맞추기 등이 남아도 완료로 처리됐다.)
      const pendingAssignments = (assignmentsData || []).filter((assignment) => {
        return !resultsData?.some((r) => {
          if (r.quiz_id !== assignment.quiz_id) return false;
          if (new Date(r.completed_at) <= new Date(assignment.assigned_at)) return false;
          if (!assignment.quizzes) return true;
          return isResultComplete(asRow(assignment.quizzes), asRow(r));
        });
      });

      // 부분 진행 퀴즈의 실제 진척도 = 채점된 활성 스테이지 수 ÷ 활성 스테이지 수.
      // 활성 스테이지가 0개면 분모가 없어 percent를 만들 수 없다 → null(거짓 숫자 대신 상태만 표시).
      const progressMap: Record<
        string,
        { completed: number; total: number; percent: number | null }
      > = {};
      pendingAssignments.forEach((a) => {
        if (!a.quizzes) return;
        const quiz = asRow(a.quizzes);
        // resultsData는 최신순 정렬 → find가 배정일 이후 가장 최근 결과다.
        const partial = resultsData?.find(
          (r) => r.quiz_id === a.quiz_id && new Date(r.completed_at) > new Date(a.assigned_at)
        );
        if (!partial) return;
        const enabled = STAGE_ORDER.filter((stage) => isStageEnabled(stage, quiz));
        const completed = enabled.filter((stage) => stageScore(asRow(partial), stage) !== null).length;
        progressMap[a.quiz_id] = {
          completed,
          total: enabled.length,
          percent: enabled.length > 0 ? Math.round((completed / enabled.length) * 100) : null,
        };
      });

      // class_id → class_name map (inline)
      const classNameMapLocal: Record<string, string> = {};
      (membershipData || []).forEach((m) => {
        classNameMapLocal[m.class_id] = (asRow(m.classes).name as string) || '';
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

      // 연속 학습 전용 조회 — 위의 목록용 쿼리는 limit(10)이라 streak 상한이 10일이 돼버린다.
      // 날짜만 가져와 최근 1년 범위에서 센다(1년을 넘는 연속은 365일로 표시된다).
      const streakWindowStart = new Date(today);
      streakWindowStart.setDate(streakWindowStart.getDate() - STREAK_WINDOW_DAYS);
      const { data: streakRows } = await supabase
        .from('quiz_results')
        .select('completed_at')
        .eq('student_id', user!.id)
        .gte('completed_at', streakWindowStart.toISOString());

      const studiedDays = new Set<number>();
      (streakRows || []).forEach((r) => {
        const d = new Date(r.completed_at);
        d.setHours(0, 0, 0, 0);
        studiedDays.add(d.getTime());
      });

      // 시작점 보정: 오늘 기록이 없으면 어제부터 센다(오늘 풀면 오늘이 포함돼 +1).
      const cursor = new Date(today);
      if (!studiedDays.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (studiedDays.has(cursor.getTime())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      // 복습 유도용 오답 데이터 — RPC 반환은 Json이라 알려진 행 형태로 좁힌다.
      const { data: waData } = await supabase.rpc('get_student_wrong_answers', {
        _student_id: user!.id,
      });
      const { data: waProgressData } = await supabase
        .from('wrong_answer_progress')
        .select('word, correct_streak, mastered_at')
        .eq('student_id', user!.id);

      const progressRows = waProgressData ?? [];
      const masteredWords = new Set<string>(progressRows.filter(isMastered).map((r) => r.word));
      const weekMasteredCount = progressRows.filter(
        (r) => r.mastered_at && new Date(r.mastered_at) >= weekStart
      ).length;

      const waRows = ((waData ?? []) as unknown as WrongAnswerRow[]).filter((row) => {
        const word = row.word || row.correct_answer;
        return !!word && !masteredWords.has(word);
      });
      // 복습 대기 = 아직 마스터하지 않은 오답 "단어" 수 (오답노트도 단어 단위로 센다)
      const reviewPendingCount = new Set(waRows.map((row) => row.word || row.correct_answer)).size;

      // 오늘의 복습 5문제 — 최근 오답부터, 단어 단위 dedup.
      // 연습 화면이 빈칸/받아쓰기만 지원해서 짝 맞추기·문장 순서는 제외한다(WrongAnswerNotebook과 동일).
      const reviewProblems: PracticeProblem[] = [];
      const pickedWords = new Set<string>();
      waRows.forEach((row, idx) => {
        if (reviewProblems.length >= TODAY_REVIEW_SIZE) return;
        const source = row.source || 'fill_blank';
        if (source !== 'fill_blank' && source !== 'type_answer') return;
        const word = row.word || row.correct_answer;
        if (!word || pickedWords.has(word)) return;
        pickedWords.add(word);
        reviewProblems.push({
          id: `${source}-${idx}`,
          word,
          correct_answer: row.correct_answer ?? word,
          sentence: row.sentence ?? '',
          translation: row.translation ?? null,
          audio_url: row.audio_url ?? null,
          source,
        });
      });

      return {
        profileName: profileData?.name || null,
        classes: (membershipData || []) as ClassMembership[],
        assignments: pendingAssignments as Assignment[],
        results: (resultsData || []) as Result[],
        progressMap,
        quizClassMap,
        reviewProblems,
        stats: {
          totalClasses: membershipData?.length || 0,
          averageScore: avgScore,
          streak,
          weekScore,
          reviewPendingCount,
          weekMasteredCount,
        },
      };
    },
    enabled: !!user,
  });

  const profileName = data?.profileName;
  const classes = data?.classes ?? [];
  const assignments = data?.assignments ?? [];
  const results = data?.results ?? [];
  const progressMap = data?.progressMap ?? {};
  const quizClassMap = data?.quizClassMap ?? {};
  const reviewProblems = useMemo(() => data?.reviewProblems ?? [], [data?.reviewProblems]);
  const stats = data?.stats ?? {
    totalClasses: 0,
    averageScore: 0,
    streak: 0,
    weekScore: null as number | null,
    reviewPendingCount: 0,
    weekMasteredCount: 0,
  };

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

  // 히어로 퀴즈의 활성 유형 — 유형 배지와 진행률 분모에 함께 쓴다.
  const heroStages = useMemo(
    () =>
      heroAssignment?.quizzes
        ? STAGE_ORDER.filter((stage) => isStageEnabled(stage, asRow(heroAssignment.quizzes)))
        : [],
    [heroAssignment]
  );
  const heroProgress = heroAssignment ? progressMap[heroAssignment.quiz_id] : undefined;
  // 활성 유형이 하나도 없으면 분모가 없어 진행률을 만들 수 없다 → 숫자 대신 상태 텍스트만.
  const heroProgressAvailable = heroStages.length > 0;

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

  // 오늘의 복습 미니 세션 — WrongAnswerNotebook과 같은 방식으로 문제를 넘긴다.
  const handleStartTodayReview = () => {
    if (reviewProblems.length === 0) {
      toast.info('연습할 수 있는 빈칸/받아쓰기 오답이 없어요');
      return;
    }
    localStorage.setItem('practice_problems', JSON.stringify(reviewProblems));
    navigate('/wrong-answers/practice');
  };

  const displayName = profileName || user?.email?.split('@')[0] || '';

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">

        <PendingTeacherBanner />

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            안녕하세요, {displayName}님! 👋
          </h1>
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
                  ▶ {heroProgress ? '이어서 풀기' : '다음 퀴즈'}
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
                  {heroStages.map((stage) => (
                    <span
                      key={stage}
                      className="bg-white/15 text-white/90 px-2.5 py-1 rounded-md text-[11px] font-bold"
                    >
                      {STAGE_SHORT_LABELS[stage]}
                    </span>
                  ))}
                </div>
                <Link to={`/quiz/${heroAssignment.quiz_id}/take`} className="mt-6 inline-block">
                  <Button className="bg-white text-primary hover:bg-white/90 font-bold text-[15px] py-[13px] px-[26px] h-auto gap-1.5">
                    {heroProgress ? '이어서 풀기' : '지금 풀기'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Right */}
              <div className="relative z-10 shrink-0 flex flex-col items-center gap-2.5">
                {heroProgressAvailable ? (
                  <CircleProgress percent={heroProgress?.percent ?? 0} />
                ) : (
                  // 활성 유형을 알 수 없어 진행률 계산 불가 → 거짓 숫자 대신 상태만 표시
                  <div className="w-[104px] h-[104px] rounded-full border-[9px] border-white/20 flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-semibold text-white/90">
                      {heroProgress ? '진행 중' : '시작 전'}
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <strong className="block text-[13px] font-semibold">
                    {heroProgressAvailable && heroProgress
                      ? `${heroProgress.total}유형 중 ${heroProgress.completed}개 완료`
                      : `${heroAssignment.quizzes?.words?.length ?? 0}개 단어`}
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

        {/* 오늘의 복습 히어로 — 배정 퀴즈가 없을 때만 히어로 자리를 대체한다 */}
        {!heroAssignment && stats.reviewPendingCount > 0 && (
          <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-primary to-[#155237] text-white py-[30px] px-9">
            <div className="relative z-10">
              <p className="font-ui text-[11px] font-bold tracking-[0.12em] uppercase text-white/75">
                ▶ 오늘의 복습
              </p>
              <h2 className="font-sans font-bold text-[28px] leading-[1.3] tracking-[-0.02em] mt-[10px]">
                복습할 단어 <span className="tabular-nums">{stats.reviewPendingCount}</span>개가
                <br />
                기다리고 있어요
              </h2>
              <p className="text-[12px] text-white/80 mt-2">
                {stats.weekMasteredCount > 0
                  ? `⭐ 이번 주 마스터 ${stats.weekMasteredCount}개 · 조금만 더!`
                  : '⭐ 2번 연속 맞히면 마스터! 오늘 첫 단어를 마스터해 보세요'}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <Button
                  onClick={handleStartTodayReview}
                  className="bg-white text-primary hover:bg-white/90 font-bold text-[13px] h-auto py-[9px] px-[18px] gap-1.5"
                >
                  오늘의 복습 {TODAY_REVIEW_SIZE}문제
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Link to="/wrong-answers">
                  <Button
                    variant="outline"
                    className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white font-semibold text-[13px] h-auto py-[9px] px-[14px]"
                  >
                    오답노트 열기
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-[#FEF3C7] dark:bg-amber-950/50 flex items-center justify-center text-lg shrink-0">🔥</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground tabular-nums">
                {stats.streak}<span className="text-[13px] text-muted-foreground ml-[3px] font-medium">일</span>
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">연속 학습</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">📈</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground tabular-nums">
                {stats.weekScore !== null ? stats.weekScore : '—'}
                {stats.weekScore !== null && (
                  <span className="text-[13px] text-muted-foreground ml-[3px] font-medium">%</span>
                )}
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">이번 주 정답률</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl px-[18px] py-4 flex items-center gap-[14px]">
            <div className="w-[38px] h-[38px] rounded-lg bg-[#DBEAFE] dark:bg-blue-950/50 flex items-center justify-center text-lg shrink-0">🎯</div>
            <div>
              <div className="font-bold text-[18px] leading-none text-foreground tabular-nums">
                {stats.averageScore}<span className="text-[13px] text-muted-foreground ml-[3px] font-medium">%</span>
              </div>
              <div className="font-ui text-[11px] text-muted-foreground mt-[6px]">최근 10회 평균</div>
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
                <div className="w-[34px] h-[34px] rounded-lg bg-[#DCFCE7] dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
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
                <div className="w-[34px] h-[34px] rounded-lg bg-[#FEE2E2] dark:bg-red-950/50 flex items-center justify-center shrink-0">
                  <FileX className="w-[15px] h-[15px] text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">오답 노트</p>
                  <p className="text-[11px] text-muted-foreground">틀린 문제 다시 보기</p>
                </div>
                {stats.reviewPendingCount > 0 && (
                  <span className="shrink-0 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold px-2.5 py-[3px] tabular-nums">
                    복습 대기 {stats.reviewPendingCount}
                  </span>
                )}
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
                    const isPartial = !!progressMap[assignment.quiz_id];
                    const stages = STAGE_ORDER.filter((stage) => isStageEnabled(stage, asRow(q)));

                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center gap-[11px] px-3 py-[10px] border border-border rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        {/* 유형이 여러 개일 수 있어 유형별 아이콘 대신 중립 아이콘을 쓴다(유형은 아래 배지로 표기) */}
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-primary/10">
                          <BookOpen className="w-[13px] h-[13px] text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold truncate">{q.title}</p>
                          <div className="flex items-center gap-1 mt-[3px] flex-wrap">
                            {stages.map((stage) => (
                              <span
                                key={stage}
                                className="font-ui text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-px rounded"
                              >
                                {STAGE_SHORT_LABELS[stage]}
                              </span>
                            ))}
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
              <Link to="/my-quizzes" className="text-xs text-primary hover:underline flex items-center gap-1">
                전체 보기 <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>퀴즈</TableHead>
                      <TableHead className="whitespace-nowrap">점수</TableHead>
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
                        <TableCell>
                          <QuizTypeScoreBadges
                            result={result}
                            fillBlankEnabled={result.quizzes?.fill_blank_enabled}
                            matchupEnabled={result.quizzes?.matchup_enabled}
                            typeAnswerEnabled={result.quizzes?.type_answer_enabled}
                            wordMagnetEnabled={result.quizzes?.word_magnet_enabled}
                            sentenceMakingEnabled={result.quizzes?.sentence_making_enabled}
                            recordingEnabled={result.quizzes?.recording_enabled}
                            columns={2}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums text-[11px]">
                          {formatDateCompact(result.completed_at)}
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
