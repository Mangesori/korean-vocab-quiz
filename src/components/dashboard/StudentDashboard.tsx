import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PendingTeacherBanner } from '@/components/dashboard/PendingTeacherBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlarmClock, BookMarked, FileX, Home, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BaseStage, STAGE_ORDER, STAGE_LABELS, isStageEnabled } from '@/types/quiz';

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

const STAGE_TOTAL_KEY: Record<BaseStage, string> = {
  matchup: 'matchup_total',
  type_answer: 'type_answer_total',
  fill_blank: 'fill_blank_total',
  word_magnet: 'word_magnet_total',
  sentence_making: 'sentence_making_total',
  recording: 'recording_total',
};

/** 스테이지 플래그·점수를 컬럼명으로 조회하기 위한 좁히기(퀴즈/결과 행 모두 평범한 객체다). */
function asRow(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function stageScore(result: Record<string, unknown>, stage: BaseStage): number | null {
  const value = result[STAGE_SCORE_KEY[stage]];
  return typeof value === 'number' ? value : null;
}

function stageTotal(result: Record<string, unknown>, stage: BaseStage): number | null {
  const value = result[STAGE_TOTAL_KEY[stage]];
  return typeof value === 'number' ? value : null;
}

/** 결과 한 건 기준으로, 해당 퀴즈의 활성 스테이지가 전부 채점됐는지. */
function isResultComplete(quiz: Record<string, unknown>, result: Record<string, unknown>): boolean {
  return STAGE_ORDER.every((stage) => !isStageEnabled(stage, quiz) || stageScore(result, stage) !== null);
}

/**
 * 단어별 마스터 판정 — 서버(update_wa_progress)가 찍는 mastered_at만 본다.
 *
 * 예전에는 `correct_streak >= 2`도 졸업으로 쳤는데, 간격 반복 도입 후로는 틀린 판정이 된다.
 * 이제 correct_streak은 같은 날 여러 번 맞혀도 계속 오르지만(표시용 카운터) 단계(stage)는
 * 예정일이 와야 오른다. 즉 하루에 두 번 맞힌 단어는 streak 2에 도달해도 졸업이 아니다.
 */
function isMastered(row: { mastered_at?: string | null }): boolean {
  return row.mastered_at != null;
}

function formatShortDate(date: string) {
  return format(new Date(date), 'M월 d일', { locale: ko });
}

/** 점수 미니 바 색 — 정답률 높음(#1E6B47) / 낮음(#8FBFA6) / 미제출(#E2DDD8) 3단계. */
function scoreBarColor(quiz: Record<string, unknown> | null, result: Record<string, unknown>, stage: BaseStage) {
  if (!quiz || !isStageEnabled(stage, quiz)) return '#E2DDD8';
  const score = stageScore(result, stage);
  const total = stageTotal(result, stage);
  if (score === null || !total) return '#E2DDD8';
  return score / total >= 0.8 ? '#1E6B47' : '#8FBFA6';
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
        .select('word, mastered_at, due_at')
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

      // 오늘 SRS 복습 대기 수 — "오늘의 복습"(/review, get_due_review_items)이 실제로 쓰는
      // 기준(mastered_at IS NULL AND due_at <= now)과 반드시 같아야 한다. reviewPendingCount는
      // 실제 오답 기록(waData)에서만 나오는데, "복습 큐에 바로 추가"로 시딩된 단어는 오답 기록이
      // 없어(seed_review_words가 wrong_answer_progress에만 직접 씀) 거기 안 잡힌다.
      const nowMs = Date.now();
      const dueReviewCount = progressRows.filter(
        (r) => !r.mastered_at && r.due_at && new Date(r.due_at).getTime() <= nowMs
      ).length;

      return {
        profileName: profileData?.name || null,
        classes: (membershipData || []) as ClassMembership[],
        assignments: pendingAssignments as Assignment[],
        results: (resultsData || []) as Result[],
        progressMap,
        quizClassMap,
        stats: {
          totalClasses: membershipData?.length || 0,
          averageScore: avgScore,
          streak,
          weekScore,
          reviewPendingCount,
          dueReviewCount,
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
  const stats = data?.stats ?? {
    totalClasses: 0,
    averageScore: 0,
    streak: 0,
    weekScore: null as number | null,
    reviewPendingCount: 0,
    dueReviewCount: 0,
    weekMasteredCount: 0,
  };

  const classNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((m) => { map[m.class_id] = m.classes.name; });
    return map;
  }, [classes]);

  const heroAssignment = assignments.find((a) => a.quizzes);

  // 히어로 퀴즈의 활성 유형 — 진행률 분모로 쓴다.
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

  // 다음에 풀어야 할 유형 — 히어로의 가장 최근(부분) 결과에서 아직 채점 안 된 첫 활성 스테이지.
  const heroNextStage = useMemo(() => {
    if (!heroAssignment?.quizzes || !heroLastResult) return null;
    const quiz = asRow(heroAssignment.quizzes);
    const stage = STAGE_ORDER.find(
      (s) => isStageEnabled(s, quiz) && stageScore(asRow(heroLastResult), s) === null
    );
    return stage ? STAGE_LABELS[stage] : null;
  }, [heroAssignment, heroLastResult]);

  // 히어로를 제외한 나머지 미완료 퀴즈 — 같은 퀴즈가 클래스+개인 등 여러 경로로 중복
  // 배정될 수 있어 quiz_id 기준으로 한 번만 남긴다.
  const otherPendingAssignments = useMemo(() => {
    const byQuiz = new Map<string, Assignment>();
    assignments.forEach((a) => {
      if (!a.quizzes) return;
      if (heroAssignment && a.quiz_id === heroAssignment.quiz_id) return;
      if (!byQuiz.has(a.quiz_id)) byQuiz.set(a.quiz_id, a);
    });
    return [...byQuiz.values()];
  }, [assignments, heroAssignment]);

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
  const hasClasses = classes.length > 0;

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

        {!hasClasses ? (
          /* ── 클래스 미가입 상태 (시안 7a·7d) ── */
          <div className="lg:max-w-[640px]">
            <div className="bg-gradient-to-r from-primary to-[#155237] rounded-2xl px-6 py-6 sm:px-[30px] sm:py-7 text-white">
              <h2 className="text-[19px] sm:text-[22px] font-bold tracking-[-0.3px] sm:tracking-[-0.4px]">클래스에 가입해 주세요</h2>
              <p className="text-[12.5px] sm:text-[13.5px] text-white/80 mt-2 leading-[1.55] sm:leading-[1.6] sm:max-w-[420px]">
                선생님께 받은 6자리 초대 코드를 입력하면 배정된 퀴즈와 진도가 여기에 나타납니다.
              </p>
              <div className="flex gap-2 sm:gap-2.5 mt-[18px] sm:mt-[22px] sm:max-w-[400px]">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  className="flex-1 bg-white/[0.14] border-white/30 text-white placeholder:text-white/50 font-mono tracking-[0.22em] text-center rounded-[11px] h-auto py-3 px-3.5"
                />
                <Button
                  onClick={handleJoinClass}
                  disabled={isJoining}
                  className="shrink-0 bg-white text-primary hover:bg-white/90 rounded-[11px] h-auto px-5 sm:px-7 font-bold"
                >
                  {isJoining ? '가입 중...' : '가입'}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <Link
                to="/quiz/example"
                className="bg-card border border-border rounded-2xl p-[18px] sm:p-5 block hover:border-primary/40 transition-colors"
              >
                <p className="text-sm sm:text-[14.5px] font-bold">먼저 체험해 보기</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-[1.55]">
                  클래스 없이도 샘플 퀴즈로 6가지 유형을 미리 풀어볼 수 있습니다.
                </p>
                <span className="block text-center mt-3.5 border border-primary text-primary rounded-[11px] py-[11px] text-[13.5px] font-bold">
                  샘플 퀴즈 풀어보기 →
                </span>
              </Link>
              <Link
                to="/vocabulary"
                className="bg-card border border-border rounded-2xl p-[18px] sm:p-5 flex sm:block items-center gap-3 hover:border-primary/40 transition-colors"
              >
                <BookMarked className="w-[18px] h-[18px] text-primary shrink-0" />
                <div className="flex-1 min-w-0 sm:mt-2.5">
                  <p className="text-sm sm:text-[14.5px] font-bold">나만의 단어장</p>
                  <p className="text-xs text-muted-foreground mt-1 sm:mt-1.5 leading-[1.55]">
                    저장한 단어는 클래스 없이도 언제든 복습할 수 있어요.
                  </p>
                </div>
                <span className="sm:hidden text-xs text-muted-foreground shrink-0">›</span>
              </Link>
            </div>
          </div>
        ) : (
          /* ── 일반 대시보드 (시안 5a·4a·3a) ── */
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5 lg:items-start">
            <div className="min-w-0 flex flex-col gap-3">

              {/* 히어로 — 진행 중 퀴즈 1개 */}
              {heroAssignment && heroAssignment.quizzes && (
                <div className="bg-gradient-to-r from-primary to-[#155237] rounded-2xl px-6 py-6 sm:px-7 sm:py-[26px] text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] sm:text-[12px] text-white/75">
                        {(heroAssignment.class_id ? classNameMap[heroAssignment.class_id] : '개인 배정') ?? '개인 배정'}
                        {' · '}{heroAssignment.quizzes.difficulty}{' · '}{heroAssignment.quizzes.words?.length ?? 0}개 단어
                      </span>
                      <h2 className="text-[23px] sm:text-[28px] font-bold tracking-[-0.4px] sm:tracking-[-0.6px] mt-1.5 line-clamp-2 sm:truncate">
                        {heroAssignment.quizzes.title}
                      </h2>

                      {/* 모바일: 진행 바 */}
                      <div className="sm:hidden mt-4">
                        <div className="flex items-baseline gap-1.5 text-[13px] font-semibold">
                          <span>{heroProgress?.completed ?? 0}/{heroProgress?.total ?? heroStages.length} 유형 완료</span>
                          {heroNextStage && <span className="text-white/65 font-normal text-[12px]">· 다음: {heroNextStage}</span>}
                        </div>
                        <div className="h-1.5 rounded-full bg-white/20 mt-2 overflow-hidden">
                          <div className="h-full bg-white rounded-full" style={{ width: `${heroProgress?.percent ?? 0}%` }} />
                        </div>
                      </div>

                      {/* 데스크톱: 다음 유형 텍스트 */}
                      <p className="hidden sm:block text-[13px] text-white/80 mt-2.5">
                        {heroNextStage ? (
                          <>다음 유형: <span className="font-bold text-white">{heroNextStage}</span> · 남은 {(heroProgress?.total ?? heroStages.length) - (heroProgress?.completed ?? 0)}유형</>
                        ) : (
                          '지금 시작해 보세요'
                        )}
                      </p>

                      <Link to={`/quiz/${heroAssignment.quiz_id}/take`} className="mt-4 sm:mt-5 block sm:inline-block">
                        <span className="block sm:inline-flex items-center justify-center gap-2 bg-white text-primary rounded-xl px-6 sm:px-[26px] py-[13px] text-[14.5px] sm:text-[15px] font-bold text-center">
                          {heroProgress ? '이어서 풀기' : '지금 풀기'} →
                        </span>
                      </Link>
                    </div>

                    <div className="hidden sm:flex flex-none w-[132px] flex-col items-center">
                      {heroProgressAvailable ? (
                        <CircleProgress percent={heroProgress?.percent ?? 0} />
                      ) : (
                        <div className="w-[104px] h-[104px] rounded-full border-[9px] border-white/20 flex items-center justify-center shrink-0">
                          <span className="text-[13px] font-semibold text-white/90">
                            {heroProgress ? '진행 중' : '시작 전'}
                          </span>
                        </div>
                      )}
                      <p className="text-[12px] font-semibold mt-3 text-center">
                        {heroProgressAvailable && heroProgress
                          ? `${heroProgress.total}유형 중 ${heroProgress.completed}개 완료`
                          : `${heroAssignment.quizzes.words?.length ?? 0}개 단어`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 다음 퀴즈 — 히어로 외 나머지, 얇은 줄로 (최대 3개, 넘으면 전체 보기) */}
              {otherPendingAssignments.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 sm:px-[18px] py-2.5 sm:py-[11px] border-b border-[#F5F1EC]">
                    <span className="text-[11.5px] sm:text-xs font-bold text-muted-foreground">
                      다음 퀴즈 {otherPendingAssignments.length}개
                    </span>
                    <Link to="/my-quizzes" className="text-[11px] sm:text-[11.5px] text-muted-foreground hover:text-primary">
                      전체 보기 ›
                    </Link>
                  </div>
                  {otherPendingAssignments.slice(0, 3).map((a) => {
                    const q = a.quizzes!;
                    const stageCount = STAGE_ORDER.filter((s) => isStageEnabled(s, asRow(q))).length;
                    const prog = progressMap[a.quiz_id];
                    const completed = prog?.completed ?? 0;
                    const total = prog?.total ?? stageCount;
                    const percent = prog?.percent ?? 0;
                    const label = (a.class_id ? classNameMap[a.class_id] : '개인 배정') || '개인 배정';

                    return (
                      <div key={a.id} className="flex items-center gap-3 sm:gap-3.5 px-4 sm:px-[18px] py-3.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] sm:text-sm font-bold truncate">{q.title}</span>
                            <span className="shrink-0 text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground bg-[#F2EEE8] rounded px-[6px] sm:px-[7px] py-[2px]">
                              {label}
                            </span>
                          </div>
                          <div className="sm:hidden flex items-center gap-2 mt-[7px]">
                            <div className="flex-1 h-[5px] rounded-full bg-[#F0EBE5] overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-[10.5px] text-muted-foreground font-semibold shrink-0">{completed}/{total}</span>
                          </div>
                          <p className="hidden sm:block text-[11.5px] text-muted-foreground mt-[3px]">
                            {q.difficulty} · {q.words?.length ?? 0}개 단어 · {prog ? `${completed}/${total} 완료` : '아직 시작 안 함'}
                          </p>
                        </div>
                        <div className="hidden sm:flex flex-none w-[130px] items-center gap-2">
                          <div className="flex-1 h-[5px] rounded-full bg-[#F0EBE5] overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground font-semibold">{completed}/{total}</span>
                        </div>
                        <Link to={`/quiz/${q.id}/take`} className="shrink-0">
                          <span className="inline-block text-[12px] sm:text-[12.5px] font-bold text-primary border border-primary rounded-[10px] px-3.5 sm:px-4 py-2 sm:py-[8px]">
                            {prog ? '이어서' : '시작하기'}
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 모바일 전용 — 통계 3분할 + 단어장/오답노트 (데스크톱은 오른쪽 레일에) */}
              <div className="lg:hidden grid grid-cols-3 bg-card border border-border rounded-2xl divide-x divide-[#F0EBE5] py-3.5">
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.streak}<span className="text-[11px] font-semibold text-muted-foreground ml-0.5">일</span></div>
                  <div className="text-[11px] text-muted-foreground mt-[3px]">연속 학습</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {stats.weekScore ?? '—'}{stats.weekScore !== null && <span className="text-[11px] font-semibold text-muted-foreground">%</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-[3px]">이번 주 정답률</div>
                </div>
                <Link to="/review" className="text-center block">
                  <div className="text-lg font-bold">{stats.dueReviewCount}</div>
                  <div className="text-[11px] text-muted-foreground mt-[3px]">오늘의 복습</div>
                </Link>
              </div>

              <div className="lg:hidden grid grid-cols-2 gap-2.5">
                <Link to="/vocabulary" className="bg-card border border-border rounded-2xl p-3.5 hover:border-primary/40 transition-colors">
                  <BookMarked className="w-[18px] h-[18px] text-primary" />
                  <p className="text-[13.5px] font-bold mt-2">나만의 단어장</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">저장한 단어 복습</p>
                </Link>
                <Link to="/wrong-answers" className="bg-card border border-border rounded-2xl p-3.5 hover:border-primary/40 transition-colors">
                  <FileX className="w-[18px] h-[18px] text-destructive" />
                  <p className="text-[13.5px] font-bold mt-2">오답 노트</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stats.reviewPendingCount}개</p>
                </Link>
              </div>

              {/* 최근 결과 */}
              {results.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-baseline justify-between px-4 sm:px-[22px] py-4 sm:pt-[18px] sm:pb-[14px]">
                    <span className="text-sm sm:text-[15px] font-bold">최근 결과</span>
                    <Link to="/my-quizzes" className="text-[11.5px] sm:text-xs text-muted-foreground hover:text-primary">
                      전체 보기 ›
                    </Link>
                  </div>

                  {/* 모바일: 최근 결과 카드 1개 (다시 풀기 버튼 유지) */}
                  {(() => {
                    const r = results[0];
                    const q = r.quizzes;
                    const missing = q
                      ? STAGE_ORDER.filter((s) => isStageEnabled(s, asRow(q))).filter((s) => stageScore(asRow(r), s) === null).length
                      : 0;
                    return (
                      <div className="sm:hidden px-4 pb-4">
                        <div className="bg-background border border-border rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{q?.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-[3px]">
                                {formatShortDate(r.completed_at)} · {quizClassMap[r.quiz_id] || '개인 배정'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[19px] font-bold text-primary">
                                {r.score}<span className="text-xs text-muted-foreground font-semibold">/{r.total_questions}</span>
                              </div>
                              {missing > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">미제출 {missing}유형</p>}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3.5">
                            <Link to={`/quiz/${r.quiz_id}/result/${r.id}`} className="flex-1">
                              <span className="block text-center text-xs font-semibold border border-[#E2DDD8] rounded-[10px] py-2.5">결과 확인</span>
                            </Link>
                            <Link to={`/quiz/${r.quiz_id}/take`} className="flex-1">
                              <span className="block text-center text-xs font-bold text-white bg-primary rounded-[10px] py-2.5">다시 풀기</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 데스크톱: 테이블형 행 (다시 풀기 없음 — 지난 퀴즈를 다시 여는 진입점은 전체 퀴즈에만 둔다) */}
                  <div className="hidden sm:block">
                    <div className="grid grid-cols-[minmax(0,1fr)_130px_150px] gap-3 px-[22px] py-[9px] bg-background border-y border-[#F0EBE5] text-[11px] font-semibold text-muted-foreground">
                      <span>퀴즈</span><span>점수</span><span>날짜</span>
                    </div>
                    {results.slice(0, 3).map((r, i, arr) => {
                      const q = r.quizzes;
                      const missing = q
                        ? STAGE_ORDER.filter((s) => isStageEnabled(s, asRow(q))).filter((s) => stageScore(asRow(r), s) === null).length
                        : 0;
                      return (
                        <div
                          key={r.id}
                          className={`grid grid-cols-[minmax(0,1fr)_130px_150px] gap-3 items-center px-[22px] py-4 ${i < arr.length - 1 ? 'border-b border-[#F5F1EC]' : ''}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{q?.title}</p>
                            <p className="text-[11.5px] text-muted-foreground mt-0.5">
                              {quizClassMap[r.quiz_id] || '개인 배정'}{missing > 0 && ` · 미제출 ${missing}유형`}
                            </p>
                          </div>
                          <div>
                            <div className="text-[17px] font-bold text-primary">
                              {r.score}<span className="text-[11.5px] text-muted-foreground font-semibold">/{r.total_questions}</span>
                            </div>
                            <div className="flex gap-[3px] mt-1.5">
                              {STAGE_ORDER.map((stage) => (
                                <div
                                  key={stage}
                                  className="w-[15px] h-1 rounded-sm"
                                  style={{ background: scoreBarColor(q ? asRow(q) : null, asRow(r), stage) }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="text-xs text-muted-foreground">{formatShortDate(r.completed_at)}</span>
                            <Link to={`/quiz/${r.quiz_id}/result/${r.id}`} className="text-xs font-bold text-primary shrink-0">
                              결과 확인 ›
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 빈 상태 — 클래스는 있지만 아직 아무것도 배정/완료된 게 없을 때 */}
              {assignments.length === 0 && results.length === 0 && (
                <div className="bg-card border border-border rounded-2xl py-12 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="font-medium text-muted-foreground">아직 배정된 퀴즈가 없습니다</p>
                  <p className="text-sm text-muted-foreground mt-1">선생님이 배정하면 여기에 나타나요</p>
                </div>
              )}
            </div>

            {/* 오른쪽 사이드레일 (데스크톱 전용) */}
            <div className="hidden lg:flex flex-col gap-3">
              <div className="bg-card border border-border rounded-2xl px-5 py-[18px]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted-foreground">연속 학습</span>
                  <span className="text-base font-bold">{stats.streak}<span className="text-[11px] text-muted-foreground ml-0.5">일</span></span>
                </div>
                <div className="h-px bg-[#F5F1EC] my-3" />
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted-foreground">이번 주 정답률</span>
                  <span className="text-base font-bold">
                    {stats.weekScore ?? '—'}{stats.weekScore !== null && <span className="text-[11px] text-muted-foreground">%</span>}
                  </span>
                </div>
                <div className="h-px bg-[#F5F1EC] my-3" />
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted-foreground">최근 10회 평균</span>
                  <span className="text-base font-bold">{stats.averageScore}<span className="text-[11px] text-muted-foreground">%</span></span>
                </div>
              </div>

              <Link
                to="/review"
                className={`bg-card border border-border rounded-2xl px-5 py-[18px] block hover:border-primary/40 transition-colors ${stats.dueReviewCount === 0 ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <AlarmClock className="w-[17px] h-[17px] text-primary" />
                  <span className="text-sm font-bold">오늘의 복습</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.dueReviewCount > 0 ? (
                    <>오늘 <span className="font-bold text-primary">{stats.dueReviewCount}개</span> 복습 대기</>
                  ) : (
                    '오늘은 복습할 게 없어요'
                  )}
                </p>
                <span className="block text-center mt-3.5 border border-[#E2DDD8] rounded-[10px] py-[9px] text-[12.5px] font-bold text-primary">
                  복습 시작
                </span>
              </Link>

              <Link to="/wrong-answers" className="bg-card border border-border rounded-2xl px-5 py-[18px] block hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <FileX className="w-[17px] h-[17px] text-destructive" />
                  <span className="text-sm font-bold">오답 노트</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  틀린 문제 <span className="font-bold text-destructive">{stats.reviewPendingCount}개</span>
                </p>
                <span className="block text-center mt-3.5 border border-[#E2DDD8] rounded-[10px] py-[9px] text-[12.5px] font-bold text-primary">
                  살펴보기
                </span>
              </Link>

              <Link to="/vocabulary" className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-[11px] hover:border-primary/40 transition-colors">
                <BookMarked className="w-[17px] h-[17px] text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold">나만의 단어장</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">저장한 단어 복습</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">›</span>
              </Link>

              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="bg-[#F2EEE8] rounded-2xl px-5 py-[14px] flex items-center gap-[11px] text-left hover:bg-[#EDE7DF] transition-colors"
              >
                <Users className="w-[17px] h-[17px] text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold">클래스 가입</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">초대 코드로 가입</p>
                </div>
                <span className="text-[11.5px] font-bold text-primary shrink-0">가입 ›</span>
              </button>
            </div>
          </div>
        )}

        {/* 클래스 가입 다이얼로그 — 이미 클래스가 있는 학생이 다른 클래스를 추가로 가입할 때 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
      </div>
    </AppLayout>
  );
}
