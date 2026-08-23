import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  FileText,
  Search,
  Loader2,
  Trash2,
  Send,
  Users,
  X,
  BarChart3,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { QuizResultsDialog } from "@/components/quiz/QuizResultsDialog";
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
import { Dialog } from '@/components/ui/dialog';
import { ShareQuizDialogContent } from '@/components/quiz/ShareQuizDialog';
import { useQuizSharing } from '@/hooks/useQuizSharing';
import { useClasses } from '@/hooks/useClasses';
import { toast } from 'sonner';
import { isResultComplete } from '@/types/quiz';

interface Quiz {
  id: string;
  title: string;
  words: string[];
  words_per_set: number;
  difficulty: string;
  created_at: string;
  fill_blank_enabled: boolean | null;
  matchup_enabled: boolean | null;
  type_answer_enabled: boolean | null;
  word_magnet_enabled: boolean | null;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
}

interface AssignmentRaw {
  id: string;
  quiz_id: string;
  class_id: string | null;
  student_id: string | null;
}

interface ResultSummaryRow {
  quiz_id: string;
  student_id: string | null;
  fill_blank_score: number | null;
  matchup_score: number | null;
  type_answer_score: number | null;
  word_magnet_score: number | null;
  sentence_making_score: number | null;
  recording_score: number | null;
}

type AssignedFilter = 'all' | 'assigned' | 'unassigned';
type SortOrder = 'latest' | 'oldest' | 'title';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function Quizzes() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');

  const { classes } = useClasses(user?.id);
  const [selectedQuizForResult, setSelectedResult] = useState<Quiz | null>(null);
  const [selectedQuizForShare, setSelectedQuizForShare] = useState<Quiz | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 학생별 배정 취소 — class_id 없이 개인 배정된 퀴즈(어휘 보강 퀴즈 등)는 "내 클래스"
  // 화면에 안 뜨므로, 여기서 행을 펼쳐 배정된 학생 목록을 보고 개별 취소할 수 있게 한다.
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<{ id: string; studentName: string } | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const {
    isSending,
    sendDialogOpen,
    setSendDialogOpen,
    reassignDialogOpen,
    handleConfirmReassign,
    handleCancelReassign,
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  } = useQuizSharing(selectedQuizForShare as any, user, classes as any);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['quizzes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quizzes')
        .select(
          'id, title, words, words_per_set, difficulty, created_at, fill_blank_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, sentence_making_enabled, recording_enabled'
        )
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as Quiz[];
    },
    enabled: !!user && can(PERMISSIONS.CREATE_QUIZ),
  });

  const quizIds = useMemo(() => quizzes.map((q) => q.id), [quizzes]);

  // 173개 퀴즈를 개별 조회하면 안 되니, 배정 학생 이름·클래스명·profiles를 목록 진입 시
  // 한 번씩만 quiz_id/class_id/user_id in (...)으로 가져와 클라이언트에서 매핑한다.
  const { data: assignmentData } = useQuery({
    queryKey: ['quizAssignmentData', quizIds.join(',')],
    queryFn: async () => {
      const [{ data: assignmentsData }, { data: classesData }] = await Promise.all([
        supabase.from('quiz_assignments').select('id, quiz_id, class_id, student_id').in('quiz_id', quizIds),
        supabase.from('classes').select('id, name').eq('teacher_id', user!.id),
      ]);

      const classIds = (classesData ?? []).map((c) => c.id);
      const { data: membersData } = classIds.length
        ? await supabase.from('class_members').select('class_id, student_id').in('class_id', classIds)
        : { data: [] as { class_id: string; student_id: string }[] };

      const membersByClass = new Map<string, string[]>();
      (membersData ?? []).forEach((m) => {
        const arr = membersByClass.get(m.class_id) ?? [];
        arr.push(m.student_id);
        membersByClass.set(m.class_id, arr);
      });

      const directStudentIds = (assignmentsData ?? []).map((a) => a.student_id).filter((v): v is string => !!v);
      const classWideStudentIds = (assignmentsData ?? [])
        .filter((a) => a.class_id)
        .flatMap((a) => membersByClass.get(a.class_id!) ?? []);
      const allStudentIds = [...new Set([...directStudentIds, ...classWideStudentIds])];

      const { data: profilesData } = allStudentIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', allStudentIds)
        : { data: [] as { user_id: string; name: string }[] };

      return {
        assignments: (assignmentsData ?? []) as AssignmentRaw[],
        nameById: new Map((profilesData ?? []).map((p) => [p.user_id, p.name])),
        classNameById: new Map((classesData ?? []).map((c) => [c.id, c.name])),
        membersByClass,
      };
    },
    enabled: !!user && quizIds.length > 0,
  });

  const { data: resultsData } = useQuery({
    queryKey: ['quizResultsSummary', quizIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('quiz_results')
        .select(
          'quiz_id, student_id, fill_blank_score, matchup_score, type_answer_score, word_magnet_score, sentence_making_score, recording_score'
        )
        .in('quiz_id', quizIds)
        .not('student_id', 'is', null);
      return (data ?? []) as ResultSummaryRow[];
    },
    enabled: !!user && quizIds.length > 0,
  });

  // 퀴즈별 배정된 학생 id (직접 배정 + class_id 배정을 학급 전체로 확장, dedup)
  const studentIdsByQuiz = useMemo(() => {
    const map = new Map<string, string[]>();
    (assignmentData?.assignments ?? []).forEach((a) => {
      const arr = map.get(a.quiz_id) ?? [];
      if (a.student_id) {
        if (!arr.includes(a.student_id)) arr.push(a.student_id);
      } else if (a.class_id) {
        (assignmentData?.membersByClass.get(a.class_id) ?? []).forEach((sid) => {
          if (!arr.includes(sid)) arr.push(sid);
        });
      }
      map.set(a.quiz_id, arr);
    });
    return map;
  }, [assignmentData]);

  // 퀴즈별 "완료 제출"한 학생 id — 활성 스테이지가 전부 채점된 결과가 있는 학생만.
  const submittedStudentIdsByQuiz = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const quizById = new Map(quizzes.map((q) => [q.id, q]));
    (resultsData ?? []).forEach((r) => {
      const quiz = quizById.get(r.quiz_id);
      if (!quiz || !r.student_id) return;
      if (!isResultComplete(quiz as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>)) return;
      const set = map.get(r.quiz_id) ?? new Set<string>();
      set.add(r.student_id);
      map.set(r.quiz_id, set);
    });
    return map;
  }, [resultsData, quizzes]);

  const nameById = assignmentData?.nameById ?? new Map<string, string>();

  const rows = useMemo(() => {
    return quizzes.map((quiz) => {
      const studentIds = studentIdsByQuiz.get(quiz.id) ?? [];
      const studentNames = studentIds.map((id) => nameById.get(id) ?? '이름 없음');
      const submittedCount = submittedStudentIdsByQuiz.get(quiz.id)?.size ?? 0;
      return { quiz, studentNames, assignedCount: studentIds.length, submittedCount };
    });
  }, [quizzes, studentIdsByQuiz, submittedStudentIdsByQuiz, nameById]);

  const assignedCountTotal = rows.filter((r) => r.assignedCount > 0).length;
  const unassignedCountTotal = rows.length - assignedCountTotal;

  const filteredRows = rows
    .filter(({ quiz }) => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        quiz.title.toLowerCase().includes(q) ||
        quiz.words.some((word) => word.toLowerCase().includes(q))
      );
    })
    .filter(({ assignedCount }) => {
      if (assignedFilter === 'assigned') return assignedCount > 0;
      if (assignedFilter === 'unassigned') return assignedCount === 0;
      return true;
    })
    .filter(({ quiz }) => levelFilter === 'all' || quiz.difficulty === levelFilter)
    .sort((a, b) => {
      if (sortOrder === 'title') return a.quiz.title.localeCompare(b.quiz.title, 'ko');
      const diff = new Date(a.quiz.created_at).getTime() - new Date(b.quiz.created_at).getTime();
      return sortOrder === 'oldest' ? diff : -diff;
    });

  // 개인 배정 학생이 소속된 클래스 찾기(있으면) — "이 클래스로 이동" 링크용.
  // membersByClass(class_id -> student_id[])를 뒤집는다.
  const classIdByStudent = useMemo(() => {
    const map = new Map<string, string>();
    (assignmentData?.membersByClass ?? new Map<string, string[]>()).forEach((studentIds, classId) => {
      studentIds.forEach((sid) => {
        if (!map.has(sid)) map.set(sid, classId);
      });
    });
    return map;
  }, [assignmentData]);

  // 펼친 행의 배정 목록 — 이미 위에서 전부 불러왔으니 추가 조회 없이 필터만 한다.
  const expandedAssignments = useMemo(() => {
    if (!expandedQuizId || !assignmentData) return [];
    return assignmentData.assignments
      .filter((a) => a.quiz_id === expandedQuizId)
      .map((a) =>
        a.student_id
          ? {
              id: a.id,
              displayName: assignmentData.nameById.get(a.student_id) ?? '이름 없음',
              classId: classIdByStudent.get(a.student_id) ?? null,
              isClassWide: false,
            }
          : {
              id: a.id,
              displayName: `전체 학급 · ${assignmentData.classNameById.get(a.class_id!) ?? '알 수 없는 클래스'}`,
              classId: a.class_id,
              isClassWide: true,
            }
      );
  }, [expandedQuizId, assignmentData, classIdByStudent]);

  const handleDeleteClick = (e: React.MouseEvent, quiz: Quiz) => {
    e.preventDefault();
    e.stopPropagation();
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizToDelete.id);

      if (error) throw error;

      toast.success('퀴즈가 삭제되었습니다');

      queryClient.setQueryData(['quizzes', user?.id], (prev: Quiz[] | undefined) =>
        prev?.filter(q => q.id !== quizToDelete.id) ?? []
      );

      setDeleteDialogOpen(false);
      setQuizToDelete(null);
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('퀴즈 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnassignClick = (assignmentId: string, studentName: string) => {
    setAssignmentToUnassign({ id: assignmentId, studentName });
  };

  const handleUnassignConfirm = async () => {
    if (!assignmentToUnassign) return;
    setIsUnassigning(true);
    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .delete()
        .eq('id', assignmentToUnassign.id);
      if (error) throw error;

      toast.success('배정이 취소되었습니다');
      queryClient.invalidateQueries({ queryKey: ['quizAssignmentData'] });
      setAssignmentToUnassign(null);
    } catch (error) {
      console.error('Unassign error:', error);
      toast.error('배정 취소에 실패했습니다');
    } finally {
      setIsUnassigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.CREATE_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="bg-[#FAF8F5] px-[18px] sm:px-[30px] py-[26px] sm:py-[30px]">
        <div className="flex items-center justify-between">
          <div className="text-[21px] font-bold tracking-[-0.4px]">내 퀴즈</div>
          <Link
            to="/quiz/create"
            className="bg-primary text-white text-[13px] font-bold rounded-[11px] px-5 py-[11px] whitespace-nowrap"
          >
            ＋ 새 퀴즈 만들기
          </Link>
        </div>

        <div className="flex items-center gap-2.5 mt-[18px] flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A29B94]" />
            <Input
              placeholder="퀴즈 제목 또는 단어로 검색…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-[#E3DCD3] rounded-[11px] text-[13px] h-auto py-[11px]"
            />
          </div>

          <div className="flex gap-1.5 bg-white border border-[#E3DCD3] rounded-[11px] p-1">
            {([
              ['all', `전체 ${rows.length}`],
              ['assigned', `배정됨 ${assignedCountTotal}`],
              ['unassigned', `미배정 ${unassignedCountTotal}`],
            ] as [AssignedFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setAssignedFilter(value)}
                className={
                  assignedFilter === value
                    ? 'text-xs font-bold bg-primary text-white rounded-lg px-3.5 py-1.5'
                    : `text-xs font-semibold rounded-lg px-3.5 py-1.5 ${value === 'unassigned' ? 'text-[#B4552D]' : 'text-[#6B6460]'}`
                }
              >
                {label}
              </button>
            ))}
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-auto bg-white border-[#E3DCD3] rounded-[11px] text-[12.5px] font-semibold text-[#4A443F] h-auto py-[11px] px-3.5 gap-2">
              <SelectValue placeholder="레벨" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">레벨 전체</SelectItem>
              {LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(v: SortOrder) => setSortOrder(v)}>
            <SelectTrigger className="w-auto bg-white border-[#E3DCD3] rounded-[11px] text-[12.5px] font-semibold text-[#4A443F] h-auto py-[11px] px-3.5 gap-2">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="oldest">오래된순</SelectItem>
              <SelectItem value="title">제목순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? '검색 결과가 없습니다' : '아직 생성된 퀴즈가 없습니다'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? '다른 검색어로 시도해보세요' : 'AI를 활용해 첫 번째 퀴즈를 만들어보세요'}
              </p>
              {!searchQuery && (
                <Link
                  to="/quiz/create"
                  className="bg-primary text-white text-[13px] font-bold rounded-[11px] px-5 py-[11px]"
                >
                  ＋ 새 퀴즈 만들기
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 bg-white border border-[#EBE5DE] rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[52px_1fr_150px_200px_130px_190px] gap-3.5 px-[22px] py-[13px] bg-[#FBF9F6] border-b border-[#EFE9E2] text-[11px] font-bold text-[#8A837D] tracking-[0.03em]">
              <span>레벨</span><span>제목</span><span>분량</span><span>배정</span><span>제출</span>
              <span className="text-right">만든 날짜</span>
            </div>

            {filteredRows.map(({ quiz, studentNames, assignedCount, submittedCount }) => {
              const unassigned = assignedCount === 0;
              const assignedLabel =
                studentNames.length === 0
                  ? '배정 안 됨'
                  : studentNames.length <= 2
                    ? studentNames.join(', ')
                    : `${studentNames.slice(0, 2).join(', ')} +${studentNames.length - 2}`;

              return (
                <div key={quiz.id}>
                  <Link
                    to={`/quiz/${quiz.id}`}
                    className={`group relative grid grid-cols-2 md:grid-cols-[52px_1fr_150px_200px_130px_190px] gap-2 md:gap-3.5 px-[18px] md:px-[22px] py-3.5 md:py-[15px] border-b border-[#F4F0EA] md:items-center hover:bg-[#FBF9F6]/60 transition-colors ${unassigned ? 'bg-[#FDFCFA]' : ''}`}
                  >
                    <span
                      className={`hidden md:block text-[10px] font-bold rounded-[6px] py-1 text-center ${unassigned ? 'text-[#7C756F] bg-[#F1EDE7]' : 'text-primary bg-[#E8F1EB]'}`}
                    >
                      {quiz.difficulty}
                    </span>
                    <span className={`col-span-2 md:col-span-1 text-[13.5px] font-semibold truncate ${unassigned ? 'text-[#4A443F]' : ''}`}>
                      {quiz.title}
                    </span>
                    <span className={`text-[12.5px] ${unassigned ? 'text-[#8A837D]' : 'text-[#6B6460]'}`}>
                      {quiz.words.length}개 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
                    </span>
                    <span className={`text-[12.5px] font-semibold truncate ${unassigned ? 'text-[#B4552D]' : 'text-primary'}`}>
                      {assignedLabel}
                    </span>
                    <span
                      className={`text-[12.5px] ${
                        unassigned ? 'text-[#B9B2AB]' : submittedCount === 0 ? 'text-[#B4552D] font-semibold' : 'text-[#6B6460]'
                      }`}
                    >
                      {unassigned ? '—' : `${submittedCount} / ${assignedCount}`}
                    </span>

                    <div className="flex items-center justify-end gap-3">
                      <div className="hidden md:group-hover:flex items-center gap-1.5">
                        <button
                          type="button"
                          title="공유"
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-[#F2EEE8] text-[#6B6460]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedQuizForShare(quiz);
                            setSendDialogOpen(true);
                            setSelectedClassId("");
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="결과"
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-[#F2EEE8] text-[#6B6460]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedResult(quiz);
                          }}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="배정"
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-[#F2EEE8] text-[#6B6460]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedQuizId((cur) => (cur === quiz.id ? null : quiz.id));
                          }}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="삭제"
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                          onClick={(e) => handleDeleteClick(e, quiz)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className={`text-[12.5px] text-right whitespace-nowrap ${unassigned ? 'text-[#8A837D]' : 'text-[#8A837D]'}`}>
                        {new Date(quiz.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {/* 모바일: 배정/삭제 진입점 (호버가 없는 화면이라 항상 노출) */}
                    <div className="col-span-2 flex md:hidden items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedQuizForShare(quiz);
                          setSendDialogOpen(true);
                          setSelectedClassId("");
                        }}
                        className="text-xs font-semibold text-[#6B6460] border border-[#E3DCD3] rounded-md px-2.5 py-1"
                      >
                        공유
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedResult(quiz);
                        }}
                        className="text-xs font-semibold text-[#6B6460] border border-[#E3DCD3] rounded-md px-2.5 py-1"
                      >
                        결과
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedQuizId((cur) => (cur === quiz.id ? null : quiz.id));
                        }}
                        className="text-xs font-semibold text-[#6B6460] border border-[#E3DCD3] rounded-md px-2.5 py-1"
                      >
                        배정
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, quiz)}
                        className="text-xs font-semibold text-destructive border border-[#E3DCD3] rounded-md px-2.5 py-1"
                      >
                        삭제
                      </button>
                    </div>
                  </Link>

                  {expandedQuizId === quiz.id && (
                    <div
                      className="px-[22px] py-3.5 border-b border-[#F4F0EA] bg-[#FBF9F6]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs font-semibold text-[#6B6460] mb-2">배정된 학생</p>
                      {expandedAssignments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">배정된 학생이 없어요</p>
                      ) : (
                        <div className="space-y-1">
                          {expandedAssignments.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between text-sm bg-white rounded-md px-2.5 py-1.5 border border-[#EFE9E2]"
                            >
                              <button
                                type="button"
                                className={a.classId ? 'hover:underline text-left' : 'text-left cursor-default'}
                                title={a.classId ? '이 클래스로 이동' : undefined}
                                onClick={() => a.classId && navigate(`/class/${a.classId}`)}
                              >
                                {a.displayName}
                              </button>
                              <button
                                type="button"
                                className="h-6 w-6 grid place-items-center rounded-md text-destructive hover:bg-destructive/10"
                                onClick={() => handleUnassignClick(a.id, a.displayName)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <ShareQuizDialogContent
          classes={classes as any}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          onSendQuiz={() => handleSendQuiz(selectedClassId, () => setSelectedClassId(""))}
          isSending={isSending}
          shareUrl={shareUrl}
          allowAnonymous={allowAnonymous}
          onSetAllowAnonymous={setAllowAnonymous}
          onGenerateLink={generateShareLink}
          isGeneratingLink={isGeneratingLink}
          onCopyLink={copyToClipboard}
        />
      </Dialog>
      <QuizResultsDialog
        quizId={selectedQuizForResult?.id || null}
        quizTitle={selectedQuizForResult?.title || ""}
        open={!!selectedQuizForResult}
        onOpenChange={(open) => !open && setSelectedResult(null)}
      />

      {/* Reassign Confirmation Dialog */}
      <AlertDialog open={reassignDialogOpen} onOpenChange={(open) => { if (!open) handleCancelReassign(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미 완료된 퀴즈입니다</AlertDialogTitle>
            <AlertDialogDescription>
              학생들이 이미 완료한 퀴즈입니다. 재할당하면 학생들이 다시 풀 수 있으며, 기존 풀이 기록은 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReassign}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>재할당</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>퀴즈 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 "{quizToDelete?.title || '이 퀴즈'}"를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 모든 할당 정보와 결과도 함께 삭제됩니다.
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

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={!!assignmentToUnassign} onOpenChange={(open) => !open && setAssignmentToUnassign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배정 취소</AlertDialogTitle>
            <AlertDialogDescription>
              "{assignmentToUnassign?.studentName}"에게 보낸 이 퀴즈 배정을 취소하시겠습니까?
              <br />
              이 배정만 취소되고, 다른 배정과 퀴즈 자체는 그대로 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigning}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassignConfirm}
              disabled={isUnassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigning ? '처리 중...' : '배정 취소'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
