import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Copy,
  Trash2,
  Loader2,
  UserMinus,
  Edit2,
  Check,
  X,
  FileText,
  ChevronRight,
  Megaphone,
  MoreVertical,
  Plus,
  FileX,
  BookOpen,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { StudentHistoryDialog } from '@/components/class/StudentHistoryDialog';
import { AssignQuizDialog } from '@/components/class/AssignQuizDialog';
import { LevelBadge } from '@/components/ui/level-badge';
import { formatDateShort } from '@/lib/formatDate';
import { isResultComplete } from '@/types/quiz';

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
}

interface Member {
  id: string;
  student_id: string;
  joined_at: string;
  profile?: {
    name: string;
  };
}

interface Assignment {
  id: string;
  quiz_id: string;
  assigned_at: string;
  quizzes: {
    id: string;
    title: string;
    difficulty: string;
    words: string[];
    words_per_set: number;
    fill_blank_enabled: boolean | null;
    matchup_enabled: boolean | null;
    type_answer_enabled: boolean | null;
    word_magnet_enabled: boolean | null;
    sentence_making_enabled: boolean | null;
    recording_enabled: boolean | null;
  };
}

// 표 셀 전용 짧은 날짜("8월 17일") — formatDateShort는 연도까지 붙어 헤더 한 줄엔 길다.
function formatMonthDay(date: string | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'M월 d일', { locale: ko });
}

// "마지막 활동 N일 전" 계산 — 오늘이면 "오늘", 없으면 호출부에서 "아직 활동 없음" 처리.
function daysAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '아직 활동 없음';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '아직 활동 없음';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return '오늘 활동';
  return `마지막 활동 ${days}일 전`;
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<{ id: string; name: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [classDeleteDialogOpen, setClassDeleteDialogOpen] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [assignQuizDialogOpen, setAssignQuizDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['classDetail', id],
    queryFn: async () => {
      // Fetch class
      const { data: cls, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !cls) {
        throw new Error('클래스를 찾을 수 없습니다');
      }

      // Fetch members with profiles
      const { data: membersData } = await supabase
        .from('class_members')
        .select(`
          id,
          student_id,
          joined_at
        `)
        .eq('class_id', id);

      let membersWithProfiles: Member[] = [];
      if (membersData) {
        const memberIds = membersData.map(m => m.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', memberIds);

        membersWithProfiles = membersData.map(m => ({
          ...m,
          profile: profiles?.find(p => p.user_id === m.student_id),
        }));
      }

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from('quiz_assignments')
        .select(`
          id,
          quiz_id,
          assigned_at,
          quizzes (
            id,
            title,
            difficulty,
            words,
            words_per_set,
            fill_blank_enabled,
            matchup_enabled,
            type_answer_enabled,
            word_magnet_enabled,
            sentence_making_enabled,
            recording_enabled
          )
        `)
        .eq('class_id', id)
        .order('assigned_at', { ascending: false });

      const assignments = (assignmentsData || []) as Assignment[];
      const memberIds = membersWithProfiles.map((m) => m.student_id);
      const quizIds = assignments.map((a) => a.quiz_id);

      // 퀴즈별 제출 완료 인원 — 이 클래스 멤버 x 배정된 퀴즈 범위로만 조회.
      const submittedCountByQuiz = new Map<string, number>();
      if (memberIds.length > 0 && quizIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('quiz_results')
          .select(
            'quiz_id, student_id, fill_blank_score, matchup_score, type_answer_score, word_magnet_score, sentence_making_score, recording_score'
          )
          .in('quiz_id', quizIds)
          .in('student_id', memberIds);

        const quizById = new Map(assignments.map((a) => [a.quiz_id, a.quizzes]));
        const completedByQuiz = new Map<string, Set<string>>();
        (resultsData ?? []).forEach((r) => {
          const quiz = quizById.get(r.quiz_id);
          if (!quiz || !r.student_id) return;
          if (!isResultComplete(quiz as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>)) return;
          const set = completedByQuiz.get(r.quiz_id) ?? new Set<string>();
          set.add(r.student_id);
          completedByQuiz.set(r.quiz_id, set);
        });
        completedByQuiz.forEach((set, quizId) => submittedCountByQuiz.set(quizId, set.size));
      }

      // 학생별 마지막 활동 — 이 클래스 소속 여부와 무관하게 그 학생의 전체 제출 이력 중 최댓값.
      const lastActivityByStudent = new Map<string, string>();
      if (memberIds.length > 0) {
        const { data: activityRows } = await supabase
          .from('quiz_results')
          .select('student_id, completed_at')
          .in('student_id', memberIds)
          .not('completed_at', 'is', null);

        (activityRows ?? []).forEach((r) => {
          if (!r.student_id || !r.completed_at) return;
          const prev = lastActivityByStudent.get(r.student_id);
          if (!prev || r.completed_at > prev) {
            lastActivityByStudent.set(r.student_id, r.completed_at);
          }
        });
      }

      return {
        classData: cls as ClassData,
        members: membersWithProfiles,
        assignments,
        submittedCountByQuiz,
        lastActivityByStudent,
      };
    },
    enabled: !!user && !!id,
  });

  const classData = data?.classData ?? null;
  const members = data?.members ?? [];
  const assignments = data?.assignments ?? [];
  const submittedCountByQuiz = data?.submittedCountByQuiz ?? new Map<string, number>();
  const lastActivityByStudent = data?.lastActivityByStudent ?? new Map<string, string>();

  const isOneOnOne = members.length === 1;
  const soloStudent = isOneOnOne ? members[0] : null;

  // Set editName when classData changes
  if (classData && editName === '' && !isEditing) {
    setEditName(classData.name);
  }

  const handleDeleteClick = (assignment: Assignment) => {
    setAssignmentToDelete(assignment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!assignmentToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .delete()
        .eq('id', assignmentToDelete.id);

      if (error) throw error;

      toast.success('퀴즈 할당이 삭제되었습니다');

      // Update cache
      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        assignments: prev.assignments.filter(a => a.id !== assignmentToDelete.id)
      } : prev);

      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('퀴즈 할당 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyInviteCode = () => {
    if (classData) {
      navigator.clipboard.writeText(classData.invite_code);
      toast.success('초대 코드가 복사되었습니다');
    }
  };

  const handleUpdateName = async () => {
    if (!classData || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({ name: editName.trim() })
        .eq('id', classData.id);

      if (error) throw error;

      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        classData: { ...prev.classData, name: editName.trim() }
      } : prev);
      setIsEditing(false);
      toast.success('클래스 이름이 변경되었습니다');
    } catch (error) {
      toast.error('변경에 실패했습니다');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('정말 이 학생을 클래스에서 제외하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      queryClient.setQueryData(['classDetail', id], (prev: typeof data) => prev ? {
        ...prev,
        members: prev.members.filter(m => m.id !== memberId)
      } : prev);
      toast.success('학생이 제외되었습니다');
    } catch (error) {
      toast.error('제외에 실패했습니다');
    }
  };

  const handleDeleteClass = async () => {
    if (!classData) return;

    setIsDeletingClass(true);
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classData.id);

      if (error) throw error;

      toast.success('클래스가 삭제되었습니다');
      navigate('/classes');
    } catch (error) {
      toast.error('삭제에 실패했습니다');
    } finally {
      setIsDeletingClass(false);
      setClassDeleteDialogOpen(false);
    }
  };

  const goWrongAnswer = (studentId: string) => {
    navigate('/quiz/wrong-answer', { state: { classId: id, studentId } });
  };

  const goVocabPractice = (studentId: string) => {
    navigate('/quiz/vocab-practice', { state: { classId: id, studentId } });
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.EDIT_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!classData) return null;

  const pillBtnClass =
    'inline-flex items-center gap-1.5 bg-white border border-[#E3DCD3] rounded-[11px] px-3.5 py-2.5 text-[13px] font-semibold text-[#4A443F] hover:bg-muted/40 transition-colors whitespace-nowrap';

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header — 한 줄로 접힌 메타 정보 */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-bold h-10"
                  />
                  <Button size="icon" onClick={handleUpdateName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-[22px] font-bold text-foreground truncate">{classData.name}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 text-[#A29B94] hover:text-foreground transition-colors"
                    aria-label="클래스 이름 수정"
                  >
                    <Edit2 className="w-[15px] h-[15px]" />
                  </button>
                </>
              )}
            </div>

            <p className="mt-1.5 text-[12.5px] text-[#6B6460] flex items-center gap-2 flex-wrap">
              {isOneOnOne && (
                <>
                  <span>
                    1:1 · {soloStudent?.profile?.name || '이름 없음'}
                  </span>
                  <span className="text-[#D8D1C8]">|</span>
                </>
              )}
              <span>
                퀴즈 <span className="text-[#1A1714] font-bold">{assignments.length}</span>개
              </span>
              <span className="text-[#D8D1C8]">|</span>
              <span>
                학생 <span className="text-[#1A1714] font-bold">{members.length}</span>명
              </span>
              <span className="text-[#D8D1C8]">|</span>
              <span>
                최근 배정 {assignments.length > 0 ? formatMonthDay(assignments[0].assigned_at) : '—'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button className={pillBtnClass} onClick={copyInviteCode}>
              초대 코드 <span className="font-mono font-bold text-primary tracking-wider">{classData.invite_code}</span>
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className={pillBtnClass} onClick={() => navigate(`/class/${id}/announcements`)}>
              <Megaphone className="w-4 h-4" /> 공지사항
            </button>
            <button
              className="inline-flex items-center gap-1.5 bg-primary border border-primary rounded-[11px] px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
              onClick={() => setAssignQuizDialogOpen(true)}
            >
              <Plus className="w-4 h-4" /> 퀴즈 배정
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={pillBtnClass} aria-label="더 보기">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setClassDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> 클래스 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 본문 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* 왼쪽 — 배정된 퀴즈 테이블 */}
          <div className="bg-card border border-[#EBE5DE] rounded-2xl overflow-hidden">
            {assignments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>아직 배정된 퀴즈가 없습니다</p>
                <p className="text-sm mt-1 mb-4">이 클래스에 퀴즈를 배정해보세요</p>
                <Button size="sm" onClick={() => setAssignQuizDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> 퀴즈 배정
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[52px_1fr_120px_100px_116px_28px] gap-3.5 px-4 py-2.5 bg-[#FBF9F6] border-b border-[#EFE9E2] text-[11px] font-bold text-[#8A837D] tracking-[.03em]">
                  <span>레벨</span>
                  <span>제목</span>
                  <span>분량</span>
                  <span>제출</span>
                  <span className="text-right">배정일</span>
                  <span />
                </div>
                <div>
                  {assignments.map((assignment) => {
                    const quiz = assignment.quizzes;
                    const words = quiz?.words ?? [];
                    const wordsPerSet = quiz?.words_per_set || 1;
                    const sets = Math.ceil(words.length / wordsPerSet) || 0;
                    const submittedCount = submittedCountByQuiz.get(assignment.quiz_id) ?? 0;
                    const assignedCount = members.length;
                    const subtitle =
                      words.slice(0, 5).join(' · ') + (words.length > 5 ? ` +${words.length - 5}` : '');

                    return (
                      <div
                        key={assignment.id}
                        className="grid grid-cols-[52px_1fr_100px_80px_90px_28px] sm:grid-cols-[52px_1fr_120px_100px_116px_28px] gap-3.5 px-4 py-3 border-b border-[#F4F0EA] items-center hover:bg-muted/30 transition-colors"
                      >
                        <LevelBadge level={quiz?.difficulty || 'A1'} />
                        <Link to={`/quiz/${assignment.quiz_id}`} className="min-w-0 block">
                          <p className="text-[13.5px] font-semibold text-foreground truncate">
                            {quiz?.title || '삭제된 퀴즈'}
                          </p>
                          {subtitle && (
                            <p className="text-[11.5px] text-[#8A837D] truncate">{subtitle}</p>
                          )}
                        </Link>
                        <span className="text-[12.5px] text-[#6B6460] whitespace-nowrap">
                          {words.length}개 · {sets}세트
                        </span>
                        <span
                          className={`text-[12.5px] ${submittedCount === 0 ? 'text-[#B4552D] font-semibold' : 'text-[#4A443F]'}`}
                        >
                          {submittedCount} / {assignedCount}
                        </span>
                        <span className="text-[12.5px] text-[#8A837D] text-right whitespace-nowrap">
                          {formatMonthDay(assignment.assigned_at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteClick(assignment);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors justify-self-end"
                          aria-label="퀴즈 할당 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-[#FBF9F6] gap-3">
                  <span className="text-[11.5px] text-[#8A837D]">
                    이 클래스에 배정된 퀴즈만 표시합니다.
                  </span>
                  <button
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary shrink-0"
                    onClick={() => setAssignQuizDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> 퀴즈 배정
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 오른쪽 레일 */}
          <div className="space-y-4">
            {/* 학생 카드 */}
            <div className="bg-card border border-[#EBE5DE] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14.5px] font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> 학생 {members.length}명
                </h3>
                <button
                  className="text-[12px] font-semibold text-primary inline-flex items-center"
                  onClick={() => navigate(`/class/${id}/students`)}
                >
                  전체 보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  아직 가입한 학생이 없습니다
                </p>
              ) : (
                <div>
                  {members.slice(0, 8).map((member, idx) => {
                    const lastActivity = lastActivityByStudent.get(member.student_id);
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center gap-2.5 py-2.5 group ${idx > 0 ? 'border-t border-[#F2EDE7]' : ''}`}
                      >
                        <button
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                          onClick={() =>
                            setSelectedStudentForHistory({
                              id: member.student_id,
                              name: member.profile?.name || '이름 없음',
                            })
                          }
                        >
                          <div className="w-7 h-7 rounded-full bg-[#E8F1EB] flex items-center justify-center shrink-0">
                            <span className="text-[12px] font-semibold text-primary">
                              {(member.profile?.name || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-foreground truncate">
                              {member.profile?.name || '이름 없음'}
                            </p>
                            <p className="text-[10.5px] text-[#8A837D] truncate">
                              {formatMonthDay(member.joined_at)} 가입 · {daysAgoLabel(lastActivity)}
                            </p>
                          </div>
                        </button>

                        {!isOneOnOne && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => goWrongAnswer(member.student_id)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-[#4A443F] hover:bg-muted transition-colors"
                              title="오답 복습 퀴즈 만들기"
                            >
                              <FileX className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => goVocabPractice(member.student_id)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-[#4A443F] hover:bg-muted transition-colors"
                              title="어휘 보강 퀴즈 만들기"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() =>
                            setSelectedStudentForHistory({
                              id: member.student_id,
                              name: member.profile?.name || '이름 없음',
                            })
                          }
                          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
                          aria-label="학생 기록 보기"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                          aria-label="학생 제외"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 pt-3 border-t border-[#F2EDE7] text-[11px] leading-relaxed text-[#8A837D]">
                초대 코드 <span className="font-mono font-semibold text-primary">{classData.invite_code}</span>를
                학생에게 보내면 이 클래스에 들어옵니다.
              </p>
            </div>

            {/* 이 학생에게 — 1:1 클래스면 항상 노출 */}
            {isOneOnOne && soloStudent && (
              <div className="bg-card border border-[#EBE5DE] rounded-2xl p-4">
                <h3 className="text-[14.5px] font-bold mb-3">이 학생에게</h3>
                <div className="space-y-2">
                  <button
                    className="w-full flex items-center gap-2 border border-[#E7E1DA] rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-[#4A443F] hover:border-primary/40 transition-colors"
                    onClick={() => goWrongAnswer(soloStudent.student_id)}
                  >
                    <FileX className="w-3.5 h-3.5" /> 오답 복습 퀴즈 만들기
                  </button>
                  <button
                    className="w-full flex items-center gap-2 border border-[#E7E1DA] rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-[#4A443F] hover:border-primary/40 transition-colors"
                    onClick={() => goVocabPractice(soloStudent.student_id)}
                  >
                    <BookOpen className="w-3.5 h-3.5" /> 어휘 보강 퀴즈 만들기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 퀴즈 할당 삭제 확인 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>퀴즈 할당 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 "{assignmentToDelete?.quizzes?.title || '이 퀴즈'}" 할당을 삭제하시겠습니까?
                <br />
                이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 클래스 삭제 확인 */}
        <AlertDialog open={classDeleteDialogOpen} onOpenChange={setClassDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>클래스 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 "{classData.name}" 클래스를 삭제하시겠습니까?
                <br />
                모든 학생이 클래스에서 제외되며, 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingClass}>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteClass}
                disabled={isDeletingClass}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingClass ? '삭제 중...' : '삭제'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 퀴즈 배정 다이얼로그 */}
        <AssignQuizDialog
          open={assignQuizDialogOpen}
          onOpenChange={setAssignQuizDialogOpen}
          classId={id || ''}
          className={classData.name}
          teacherId={user.id}
          assignedQuizIds={assignments.map((a) => a.quiz_id)}
        />

        {/* Student History Dialog */}
        {selectedStudentForHistory && (
          <StudentHistoryDialog
            isOpen={!!selectedStudentForHistory}
            onClose={() => setSelectedStudentForHistory(null)}
            studentId={selectedStudentForHistory.id}
            studentName={selectedStudentForHistory.name}
            classId={id || ""}
          />
        )}
      </div>
    </AppLayout>
  );
}
