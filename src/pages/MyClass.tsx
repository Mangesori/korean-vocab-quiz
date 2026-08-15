import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Loader2, Megaphone, ChevronRight } from 'lucide-react';
import { formatDateShort } from '@/lib/formatDate';
import { STAGE_ORDER, isStageEnabled, type BaseStage } from '@/types/quiz';

interface ClassRow {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string;
  created_at: string;
}

interface QuizRow {
  id: string;
  title: string;
  difficulty: string;
  words: string[] | null;
  fill_blank_enabled: boolean;
  matchup_enabled: boolean;
  type_answer_enabled: boolean;
  word_magnet_enabled: boolean;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
}

interface AssignmentRow {
  id: string;
  quiz_id: string;
  assigned_at: string;
  quizzes: QuizRow | null;
}

interface ResultRow {
  id: string;
  quiz_id: string;
  completed_at: string;
  score: number;
  total_questions: number;
  fill_blank_score: number | null;
  sentence_making_score: number | null;
  recording_score: number | null;
  matchup_score: number | null;
  type_answer_score: number | null;
  word_magnet_score: number | null;
}

const STAGE_SCORE_KEY: Record<BaseStage, keyof ResultRow> = {
  matchup: 'matchup_score',
  type_answer: 'type_answer_score',
  fill_blank: 'fill_blank_score',
  word_magnet: 'word_magnet_score',
  sentence_making: 'sentence_making_score',
  recording: 'recording_score',
};

function asRow(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

/** 이 퀴즈의 활성 스테이지가 전부 채점된 결과가 배정일 이후에 있으면 완료. */
function isCompleted(quiz: QuizRow, assignedAt: string, results: ResultRow[]): boolean {
  return results.some((r) => {
    if (r.quiz_id !== quiz.id) return false;
    if (new Date(r.completed_at) <= new Date(assignedAt)) return false;
    return STAGE_ORDER.every((stage) => !isStageEnabled(stage, asRow(quiz)) || r[STAGE_SCORE_KEY[stage]] !== null);
  });
}

function initials(name: string) {
  return name.trim().slice(0, 1) || '?';
}

export default function MyClass() {
  const { id: classId } = useParams<{ id: string }>();
  const { user, role, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['myClass', classId, user?.id],
    enabled: !!user && !!classId && role === 'student',
    queryFn: async () => {
      const { data: membership } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', classId!)
        .eq('student_id', user!.id)
        .maybeSingle();

      if (!membership) return { notMember: true as const };

      const [
        { data: classRow },
        { data: memberRows },
        { data: assignments },
        { data: results },
        { data: announcement },
        { data: myProfile },
      ] = await Promise.all([
        supabase.from('classes').select('id, name, description, teacher_id, created_at').eq('id', classId!).single(),
        supabase.from('class_members').select('student_id').eq('class_id', classId!),
        supabase
          .from('quiz_assignments')
          .select(
            `id, quiz_id, assigned_at,
             quizzes ( id, title, difficulty, words, fill_blank_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, sentence_making_enabled, recording_enabled )`
          )
          .eq('class_id', classId!)
          .order('assigned_at', { ascending: false }),
        supabase
          .from('quiz_results')
          .select(
            'id, quiz_id, completed_at, score, total_questions, fill_blank_score, sentence_making_score, recording_score, matchup_score, type_answer_score, word_magnet_score'
          )
          .eq('student_id', user!.id),
        supabase
          .from('announcements')
          .select('id, title, content, created_at')
          .eq('class_id', classId!)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('profiles').select('name').eq('user_id', user!.id).maybeSingle(),
      ]);

      const memberIds = (memberRows ?? []).map((m) => m.student_id);
      const { data: teacherProfile } = classRow
        ? await supabase.from('profiles').select('name').eq('user_id', classRow.teacher_id).maybeSingle()
        : { data: null };
      const { data: memberProfiles } = memberIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', memberIds)
        : { data: [] as { user_id: string; name: string }[] };

      const classmateNames = (memberProfiles ?? [])
        .filter((p) => p.user_id !== user!.id)
        .map((p) => p.name || '학생');

      return {
        notMember: false as const,
        classRow: classRow as ClassRow,
        memberCount: memberIds.length,
        teacherName: teacherProfile?.name ?? '선생님',
        myName: myProfile?.name ?? '나',
        classmateNames,
        assignments: (assignments ?? []) as unknown as AssignmentRow[],
        results: (results ?? []) as ResultRow[],
        announcement,
      };
    },
  });

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // 선생님/관리자는 이 화면 대상이 아니다 — 자기 클래스 관리 화면으로.
  if (role !== 'student') {
    return <Navigate to="/classes" replace />;
  }

  if (!data || data.notMember) {
    return <Navigate to="/dashboard" replace />;
  }

  const { classRow, memberCount, teacherName, myName, classmateNames, assignments, results, announcement } = data;
  const pendingAssignments = assignments.filter((a) => a.quizzes && !isCompleted(a.quizzes, a.assigned_at, results));
  const completedAssignments = assignments.filter((a) => a.quizzes && isCompleted(a.quizzes, a.assigned_at, results));
  const orderedAssignments = [...pendingAssignments, ...completedAssignments];
  const visibleClassmates = classmateNames.slice(0, 4);
  const extraClassmates = classmateNames.length - visibleClassmates.length;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-background sm:bg-[#FAF8F5] sm:rounded-2xl sm:p-7">
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-5">
            <div>
              <h1 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.4px]">{classRow.name}</h1>
              <p className="text-[12.5px] sm:text-[13px] text-muted-foreground mt-[5px]">
                {teacherName} · 학생 {memberCount}명
                <span className="hidden sm:inline"> · {formatDateShort(classRow.created_at)}부터</span>
              </p>
              <p className="sm:hidden text-[12.5px] font-semibold text-primary mt-2">
                퀴즈 {assignments.length}개 중 {completedAssignments.length}개 완료
              </p>
            </div>
            <div className="hidden sm:block text-right shrink-0">
              <div className="text-[11.5px] text-muted-foreground">내 진도</div>
              <div className="text-[17px] font-bold text-primary mt-0.5">
                퀴즈 {assignments.length}개 중 {completedAssignments.length}개 완료
              </div>
            </div>
          </div>

          {/* 공지 */}
          {announcement && (
            <div className="mt-4 sm:mt-5 bg-[#FFF8E8] border border-[#F0E2C0] rounded-[14px] p-4">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] sm:text-[11px] font-bold text-[#B26A00] bg-[#F7E9CB] rounded-[5px] px-[7px] py-[2px] inline-flex items-center gap-1">
                  <Megaphone className="w-3 h-3" />
                  공지
                </span>
                <span className="text-[11px] sm:text-[11.5px] text-[#9E8B6A]">{formatDateShort(announcement.created_at)}</span>
              </div>
              <p className="text-[13px] sm:text-[13.5px] font-semibold text-[#4A3B1E] mt-2 leading-[1.55]">
                {announcement.title ? `${announcement.title} — ${announcement.content}` : announcement.content}
              </p>
              <Link
                to={`/class/${classId}/announcements`}
                className="text-[11.5px] text-primary font-semibold inline-flex items-center gap-1 mt-2.5 hover:underline"
              >
                공지 모두 보기 ›
              </Link>
            </div>
          )}

          {/* 본문 2컬럼 (데스크톱) / 세로 스택 (모바일) */}
          <div className="mt-5 sm:mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-5">
            {/* 이 반에 배정된 퀴즈 */}
            <div className="min-w-0 bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-baseline justify-between px-5 py-4">
                <span className="text-[14.5px] font-bold">이 반에 배정된 퀴즈</span>
                <span className="text-[11.5px] text-muted-foreground">{assignments.length}개</span>
              </div>
              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground px-5 py-8 text-center border-t border-[#F5F1EC]">
                  아직 배정된 퀴즈가 없습니다
                </p>
              )}
              {orderedAssignments.map((a) => {
                const q = a.quizzes!;
                const done = isCompleted(q, a.assigned_at, results);
                const stageCount = STAGE_ORDER.filter((stage) => isStageEnabled(stage, asRow(q))).length;
                const result = results.find((r) => r.quiz_id === q.id);

                return (
                  <div key={a.id} className="border-t border-[#F5F1EC] px-4 sm:px-5 py-[13px]">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13.5px] font-bold truncate ${done ? 'text-muted-foreground' : ''}`}>
                          {q.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {done && result ? `완료 · ${result.score}/${result.total_questions}` : `${stageCount}개 유형`}
                        </p>
                      </div>
                      {!done && (
                        <Link to={`/quiz/${q.id}/take`} className="shrink-0">
                          <span className="inline-block text-[11.5px] font-bold text-primary border border-primary rounded-[9px] px-3 py-[6px] hover:bg-primary/5 transition-colors">
                            시작하기
                          </span>
                        </Link>
                      )}
                      {done && (
                        <div className="hidden sm:flex gap-1.5 shrink-0">
                          {result && (
                            <Link to={`/quiz/${q.id}/result/${result.id}`}>
                              <span className="inline-block text-[11.5px] font-semibold text-foreground border border-[#E2DDD8] rounded-[9px] px-[11px] py-[6px] hover:bg-muted/40 transition-colors">
                                결과 확인
                              </span>
                            </Link>
                          )}
                          <Link to={`/quiz/${q.id}/take`}>
                            <span className="inline-block text-[11.5px] font-bold text-primary border border-primary rounded-[9px] px-[11px] py-[6px] hover:bg-primary/5 transition-colors">
                              다시 풀기
                            </span>
                          </Link>
                        </div>
                      )}
                    </div>
                    {done && (
                      <div className="flex sm:hidden gap-2 mt-[11px]">
                        {result && (
                          <Link to={`/quiz/${q.id}/result/${result.id}`} className="flex-1">
                            <span className="block text-center text-xs font-semibold text-foreground border border-[#E2DDD8] rounded-[9px] py-2">
                              결과 확인
                            </span>
                          </Link>
                        )}
                        <Link to={`/quiz/${q.id}/take`} className="flex-1">
                          <span className="block text-center text-xs font-bold text-primary border border-primary rounded-[9px] py-2">
                            다시 풀기
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
              {assignments.length > 0 && (
                <div className="px-5 py-3 border-t border-[#F5F1EC]">
                  <Link to="/my-quizzes" className="text-[11.5px] text-primary font-semibold hover:underline">
                    전체 퀴즈에서 보기 ›
                  </Link>
                </div>
              )}
            </div>

            {/* 사이드 — 같이 배우는 학생 + 선생님 (+ 다른 클래스 가입, 데스크톱만) */}
            <div className="min-w-0 flex flex-col gap-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-[13px] font-bold">같이 배우는 학생</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[11.5px] text-foreground bg-[#F2EEE8] rounded-full px-[11px] py-[5px]">
                    나 ({myName})
                  </span>
                  {visibleClassmates.map((name) => (
                    <span key={name} className="text-[11.5px] text-muted-foreground bg-[#F7F4F0] rounded-full px-[11px] py-[5px]">
                      {name}
                    </span>
                  ))}
                  {extraClassmates > 0 && (
                    <span className="text-[11.5px] text-muted-foreground bg-[#F7F4F0] rounded-full px-[11px] py-[5px]">
                      +{extraClassmates}
                    </span>
                  )}
                </div>
                <div className="h-px bg-[#F5F1EC] my-3.5 lg:hidden" />
                <div className="flex items-center gap-2.5 mt-3.5 lg:hidden">
                  <div className="w-[30px] h-[30px] rounded-full bg-[#E8F5EE] text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(teacherName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">{teacherName}</p>
                    <p className="text-[11px] text-muted-foreground">담당 선생님</p>
                  </div>
                </div>
              </div>

              <div className="hidden lg:block bg-card border border-border rounded-2xl p-4">
                <p className="text-[13px] font-bold">선생님</p>
                <div className="flex items-center gap-2.5 mt-3">
                  <div className="w-8 h-8 rounded-full bg-[#E8F5EE] text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(teacherName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">{teacherName}</p>
                    <p className="text-[11px] text-muted-foreground">담당 선생님</p>
                  </div>
                </div>
              </div>

              <Link to="/dashboard" className="hidden lg:block bg-[#F2EEE8] rounded-2xl px-[18px] py-[14px] hover:bg-[#EDE7DF] transition-colors">
                <p className="text-xs font-semibold">다른 클래스 가입</p>
                <p className="text-[11px] text-muted-foreground mt-[3px]">초대 코드로 가입 ›</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
