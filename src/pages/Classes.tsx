import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Loader2, Search, Copy, Archive, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isResultComplete } from '@/types/quiz';

interface ClassRow {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  archived_at: string | null;
}

type SortMode = 'recent' | 'created';
const SORT_STORAGE_KEY = 'classes-sort-mode';

interface ResultRow {
  quiz_id: string;
  student_id: string | null;
  score: number;
  total_questions: number;
  completed_at: string;
  fill_blank_score: number | null;
  matchup_score: number | null;
  type_answer_score: number | null;
  word_magnet_score: number | null;
  sentence_making_score: number | null;
  recording_score: number | null;
}

interface ClassStats {
  assignedQuizCount: number;
  avgScore: number | null;
  lastActivity: string | null;
  pendingCount: number;
  memberNames: string[];
}

const initials = (name: string) => name.slice(0, 2);

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) return '방금 전';
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

export default function Classes() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'recent';
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    return stored === 'created' ? 'created' : 'recent';
  });
  const [viewingArchive, setViewingArchive] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ClassRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, invite_code, created_at, archived_at')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
    enabled: !!user && can(PERMISSIONS.CREATE_CLASS),
  });

  const activeClasses = useMemo(() => classes.filter((c) => !c.archived_at), [classes]);
  const archivedClasses = useMemo(() => classes.filter((c) => !!c.archived_at), [classes]);

  useEffect(() => {
    if (viewingArchive && classes.length > 0 && archivedClasses.length === 0) {
      setViewingArchive(false);
    }
  }, [viewingArchive, classes, archivedClasses]);

  const classIds = useMemo(() => classes.map((c) => c.id), [classes]);

  // 카드 지표(배정 퀴즈/평균 점수/마지막 활동/미제출)를 클래스마다 개별 조회하던 걸
  // 없애고, 이 반들의 class_members·퀴즈·배정·결과를 한 번씩만 배치로 가져와
  // 클라이언트에서 계산한다 — Quizzes.tsx(2단계)와 같은 방식.
  const { data: statsByClass } = useQuery({
    queryKey: ['classStats', classIds.join(',')],
    queryFn: async () => {
      const [{ data: membersData }, { data: quizzesData }] = await Promise.all([
        supabase.from('class_members').select('class_id, student_id').in('class_id', classIds),
        supabase
          .from('quizzes')
          .select('id, fill_blank_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, sentence_making_enabled, recording_enabled')
          .eq('teacher_id', user!.id),
      ]);

      const quizzes = quizzesData ?? [];
      const quizIds = quizzes.map((q) => q.id);
      const quizMap = new Map(quizzes.map((q) => [q.id, q]));

      const studentIds = [...new Set((membersData ?? []).map((m) => m.student_id))];
      const { data: profilesData } = studentIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', studentIds)
        : { data: [] as { user_id: string; name: string }[] };
      const nameById = new Map((profilesData ?? []).map((p) => [p.user_id, p.name]));

      const [{ data: assignmentsData }, { data: resultsData }] = await Promise.all([
        quizIds.length
          ? supabase.from('quiz_assignments').select('quiz_id, class_id, student_id, assigned_at').in('quiz_id', quizIds)
          : Promise.resolve({ data: [] as { quiz_id: string; class_id: string | null; student_id: string | null; assigned_at: string }[] }),
        quizIds.length
          ? supabase
              .from('quiz_results')
              .select(
                'quiz_id, student_id, score, total_questions, completed_at, fill_blank_score, matchup_score, type_answer_score, word_magnet_score, sentence_making_score, recording_score'
              )
              .in('quiz_id', quizIds)
              .not('student_id', 'is', null)
          : Promise.resolve({ data: [] as ResultRow[] }),
      ]);
      const results = (resultsData ?? []) as ResultRow[];

      const membersByClass = new Map<string, string[]>();
      (membersData ?? []).forEach((m) => {
        const arr = membersByClass.get(m.class_id) ?? [];
        arr.push(m.student_id);
        membersByClass.set(m.class_id, arr);
      });

      // 학생이 이 선생님의 여러 반에 속할 수도 있지만, 카드 지표는 첫 번째로 찾은
      // 반에 귀속시킨다 (드문 경우라 근사로 충분하다).
      const classByStudent = new Map<string, string>();
      membersByClass.forEach((studentIds, classId) => {
        studentIds.forEach((sid) => {
          if (!classByStudent.has(sid)) classByStudent.set(sid, classId);
        });
      });

      type Pair = { classId: string; studentId: string; quizId: string; assignedAt: string };
      const pairs: Pair[] = [];
      (assignmentsData ?? []).forEach((a) => {
        if (a.class_id && membersByClass.has(a.class_id)) {
          (membersByClass.get(a.class_id) ?? []).forEach((sid) =>
            pairs.push({ classId: a.class_id!, studentId: sid, quizId: a.quiz_id, assignedAt: a.assigned_at })
          );
        } else if (a.student_id) {
          const classId = classByStudent.get(a.student_id);
          if (classId) pairs.push({ classId, studentId: a.student_id, quizId: a.quiz_id, assignedAt: a.assigned_at });
        }
      });

      const resultsByStudentQuiz = new Map<string, ResultRow[]>();
      const resultsByStudent = new Map<string, ResultRow[]>();
      results.forEach((r) => {
        if (!r.student_id) return;
        const key = `${r.student_id}:${r.quiz_id}`;
        const arr1 = resultsByStudentQuiz.get(key) ?? [];
        arr1.push(r);
        resultsByStudentQuiz.set(key, arr1);
        const arr2 = resultsByStudent.get(r.student_id) ?? [];
        arr2.push(r);
        resultsByStudent.set(r.student_id, arr2);
      });

      const perClass = new Map<string, { assignedQuizIds: Set<string>; pendingStudents: Set<string> }>();
      pairs.forEach((p) => {
        const entry = perClass.get(p.classId) ?? { assignedQuizIds: new Set<string>(), pendingStudents: new Set<string>() };
        entry.assignedQuizIds.add(p.quizId);
        const quiz = quizMap.get(p.quizId);
        const key = `${p.studentId}:${p.quizId}`;
        const hasComplete = !!quiz && (resultsByStudentQuiz.get(key) ?? []).some(
          (r) => new Date(r.completed_at) > new Date(p.assignedAt) && isResultComplete(quiz as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>)
        );
        if (!hasComplete) entry.pendingStudents.add(p.studentId);
        perClass.set(p.classId, entry);
      });

      const map = new Map<string, ClassStats>();
      classes.forEach((c) => {
        const memberIds = membersByClass.get(c.id) ?? [];
        const classResults = memberIds.flatMap((sid) => resultsByStudent.get(sid) ?? []);
        const validResults = classResults.filter((r) => r.total_questions > 0);
        const avgScore =
          validResults.length > 0
            ? Math.round(validResults.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0) / validResults.length)
            : null;
        const lastActivity =
          classResults.length > 0
            ? classResults.reduce((latest, r) => (new Date(r.completed_at) > new Date(latest) ? r.completed_at : latest), classResults[0].completed_at)
            : null;
        const entry = perClass.get(c.id);
        map.set(c.id, {
          assignedQuizCount: entry?.assignedQuizIds.size ?? 0,
          avgScore,
          lastActivity,
          pendingCount: entry?.pendingStudents.size ?? 0,
          memberNames: memberIds.map((sid) => nameById.get(sid) ?? '이름 없음'),
        });
      });
      return map;
    },
    enabled: !!user && classIds.length > 0,
  });

  const handleCreateClass = async () => {
    if (!newClass.name.trim()) {
      toast.error('클래스 이름을 입력해주세요');
      return;
    }

    setIsCreating(true);

    try {
      const { data: codeData } = await supabase.rpc('generate_invite_code');

      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: newClass.name.trim(),
          description: newClass.description.trim() || null,
          teacher_id: user?.id,
          invite_code: codeData,
        })
        .select('id, name, invite_code, created_at, archived_at')
        .single();

      if (error) throw error;

      toast.success('클래스가 생성되었습니다!');
      queryClient.setQueryData(['classes', user?.id], (prev: ClassRow[] | undefined) => [
        data as ClassRow,
        ...(prev ?? [])
      ]);
      setDialogOpen(false);
      setNewClass({ name: '', description: '' });
    } catch (error) {
      console.error('Create error:', error);
      toast.error('클래스 생성에 실패했습니다');
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('초대 코드가 복사되었습니다');
  };

  const setClassArchivedAt = (classId: string, archivedAt: string | null) => {
    queryClient.setQueryData(['classes', user?.id], (prev: ClassRow[] | undefined) =>
      (prev ?? []).map((c) => (c.id === classId ? { ...c, archived_at: archivedAt } : c))
    );
  };

  const archiveClass = async (classId: string) => {
    const { error } = await supabase.from('classes').update({ archived_at: new Date().toISOString() }).eq('id', classId);
    if (error) {
      console.error('Archive error:', error);
      toast.error('클래스 보관에 실패했습니다');
      return;
    }
    setClassArchivedAt(classId, new Date().toISOString());
  };

  const unarchiveClass = async (classId: string) => {
    const { error } = await supabase.from('classes').update({ archived_at: null }).eq('id', classId);
    if (error) {
      console.error('Unarchive error:', error);
      toast.error('보관 해제에 실패했습니다');
      return;
    }
    setClassArchivedAt(classId, null);
  };

  const handleArchiveClass = async (cls: ClassRow) => {
    await archiveClass(cls.id);
    toast.success('클래스를 보관했습니다', {
      action: {
        label: '되돌리기',
        onClick: () => {
          void unarchiveClass(cls.id);
        },
      },
    });
  };

  const handleUnarchiveClass = async (cls: ClassRow) => {
    await unarchiveClass(cls.id);
    toast.success('보관을 해제했습니다');
  };

  const openRenameDialog = (cls: ClassRow) => {
    setRenameTarget(cls);
    setRenameValue(cls.name);
  };

  const handleRenameClass = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsRenaming(true);
    try {
      const { error } = await supabase.from('classes').update({ name: renameValue.trim() }).eq('id', renameTarget.id);
      if (error) throw error;
      queryClient.setQueryData(['classes', user?.id], (prev: ClassRow[] | undefined) =>
        (prev ?? []).map((c) => (c.id === renameTarget.id ? { ...c, name: renameValue.trim() } : c))
      );
      toast.success('클래스 이름을 수정했습니다');
      setRenameTarget(null);
    } catch (error) {
      console.error('Rename error:', error);
      toast.error('이름 수정에 실패했습니다');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      queryClient.setQueryData(['classes', user?.id], (prev: ClassRow[] | undefined) =>
        (prev ?? []).filter((c) => c.id !== deleteTarget.id)
      );
      toast.success('클래스를 삭제했습니다');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('클래스 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.CREATE_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const baseClasses = viewingArchive ? archivedClasses : activeClasses;

  const searchedClasses = baseClasses.filter((cls) => {
    const searchLower = searchQuery.toLowerCase();
    const memberNames = statsByClass?.get(cls.id)?.memberNames ?? [];
    return (
      cls.name.toLowerCase().includes(searchLower) ||
      memberNames.some((name) => name.toLowerCase().includes(searchLower))
    );
  });

  const filteredClasses = [...searchedClasses].sort((a, b) => {
    if (sortMode === 'created') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const aActivity = statsByClass?.get(a.id)?.lastActivity ?? null;
    const bActivity = statsByClass?.get(b.id)?.lastActivity ?? null;
    if (aActivity && bActivity) {
      return new Date(bActivity).getTime() - new Date(aActivity).getTime();
    }
    if (aActivity) return -1;
    if (bActivity) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <AppLayout>
      <div className="bg-[#FAF8F5] px-[18px] sm:px-[30px] py-[26px] sm:py-[30px]">
        <div className="flex items-center justify-between">
          <div className="text-[21px] font-bold tracking-[-0.4px] pl-2">내 클래스</div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="bg-primary text-white text-[13px] font-bold rounded-[11px] px-5 py-[11px] whitespace-nowrap">
                ＋ 새 클래스
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 클래스 만들기</DialogTitle>
                <DialogDescription>클래스 정보를 입력하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="className">클래스 이름 *</Label>
                  <Input
                    id="className"
                    placeholder="예: 초급 한국어 A반"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classDesc">설명 (선택)</Label>
                  <Textarea
                    id="classDesc"
                    placeholder="클래스에 대한 간단한 설명"
                    value={newClass.description}
                    onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateClass}
                  disabled={isCreating || !newClass.name.trim()}
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  클래스 만들기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2.5 mt-[18px] flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A29B94]" />
            <Input
              placeholder="클래스 이름 또는 학생 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-[#E3DCD3] rounded-[11px] text-[13px] h-auto py-[11px]"
            />
          </div>

          <div className="flex items-center bg-white border border-[#E3DCD3] rounded-[11px] p-1 shrink-0">
            <button
              type="button"
              onClick={() => setSortMode('recent')}
              className={`text-xs rounded-[8px] px-[13px] py-[7px] transition-colors ${
                sortMode === 'recent' ? 'bg-primary text-white font-bold' : 'text-[#6B6460] font-semibold'
              }`}
            >
              최근 활동순
            </button>
            <button
              type="button"
              onClick={() => setSortMode('created')}
              className={`text-xs rounded-[8px] px-[13px] py-[7px] transition-colors ${
                sortMode === 'created' ? 'bg-primary text-white font-bold' : 'text-[#6B6460] font-semibold'
              }`}
            >
              만든 순서
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3.5">
          <span className="text-xs text-[#8A837D]">
            {viewingArchive ? `보관함 ${archivedClasses.length}개` : `클래스 ${activeClasses.length}개`}
          </span>
          {!viewingArchive && archivedClasses.length > 0 && (
            <button
              type="button"
              onClick={() => setViewingArchive(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#4A443F]"
            >
              <Archive className="w-3.5 h-3.5" />
              보관함 <span className="text-[#1A1714] font-bold">{archivedClasses.length}</span>
            </button>
          )}
          {viewingArchive && (
            <button
              type="button"
              onClick={() => setViewingArchive(false)}
              className="text-xs font-semibold text-primary"
            >
              ← 내 클래스로
            </button>
          )}
        </div>

        {filteredClasses.length === 0 ? (
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {searchQuery ? '검색 결과가 없습니다' : '아직 클래스가 없습니다'}
              </p>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? '다른 검색어를 입력해보세요' : '첫 번째 클래스를 만들어보세요'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> 새 클래스 만들기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {filteredClasses.map((cls) => {
              const stats = statsByClass?.get(cls.id);
              const memberCount = stats?.memberNames.length ?? 0;
              const isSolo = memberCount === 1;
              const isStale =
                !!stats?.lastActivity && Date.now() - new Date(stats.lastActivity).getTime() > 30 * 24 * 3_600_000;
              const isArchived = !!cls.archived_at;

              return (
                <Link key={cls.id} to={`/class/${cls.id}`} className="block h-full">
                  <div
                    className={`relative bg-white border border-[#EBE5DE] rounded-[14px] px-5 py-[18px] h-full flex flex-col hover:border-primary/40 transition-colors ${
                      isArchived ? 'grayscale opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-[34px] h-[34px] rounded-full grid place-items-center shrink-0 text-[11.5px] font-bold"
                        style={{
                          backgroundColor: isStale ? '#F3F0EA' : '#E8F1EB',
                          color: isStale ? '#8A837D' : undefined,
                        }}
                      >
                        <span className={isStale ? '' : 'text-primary'}>
                          {isSolo ? initials(stats!.memberNames[0]) : <Users className="w-[17px] h-[17px]" strokeWidth={2} />}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[15px] font-bold tracking-[-0.2px] truncate"
                          style={{ color: isStale ? '#4A443F' : undefined }}
                        >
                          {isSolo ? stats!.memberNames[0] : cls.name}
                        </div>
                        <div className="text-[11.5px] text-[#8A837D] mt-0.5 truncate">
                          {isSolo ? `1:1 · ${cls.name}` : `학생 ${memberCount}명`}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className="shrink-0 mt-0.5 p-0.5"
                            aria-label="클래스 메뉴"
                          >
                            <MoreVertical className="w-4 h-4" style={{ stroke: '#4A443F', strokeWidth: 2.2 }} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[150px]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <DropdownMenuItem
                            className="text-[12.5px] font-semibold"
                            onClick={() => openRenameDialog(cls)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" /> 이름 수정
                          </DropdownMenuItem>
                          {isArchived ? (
                            <DropdownMenuItem
                              className="text-[12.5px] font-semibold"
                              onClick={() => handleUnarchiveClass(cls)}
                            >
                              <Archive className="w-3.5 h-3.5 mr-2" /> 보관 해제
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-[12.5px] font-semibold"
                              onClick={() => handleArchiveClass(cls)}
                            >
                              <Archive className="w-3.5 h-3.5 mr-2" /> 보관하기
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[12.5px] font-semibold text-[#C1554A] focus:text-[#C1554A]"
                            onClick={() => setDeleteTarget(cls)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-col gap-[9px] mt-4 pt-3.5 border-t border-[#F2EDE7]">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#6B6460]">배정된 퀴즈</span>
                        <span className="text-[13px] font-bold">{stats?.assignedQuizCount ?? 0}</span>
                      </div>

                      {isSolo ? (
                        stats?.lastActivity ? (
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#6B6460]">마지막 활동</span>
                            <span className="text-[13px] font-bold" style={{ color: isStale ? '#8A837D' : undefined }}>
                              {relativeTime(stats.lastActivity)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[12px] text-[#8A837D]">아직 활동 없음</div>
                        )
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#6B6460]">미제출</span>
                          <span
                            className="text-[13px] font-bold"
                            style={{ color: (stats?.pendingCount ?? 0) > 0 ? '#B4552D' : undefined }}
                          >
                            {stats?.pendingCount ?? 0}명
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#6B6460]">초대 코드</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyInviteCode(cls.invite_code);
                          }}
                          title="초대 코드 복사"
                          className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary tracking-[0.06em]"
                        >
                          {cls.invite_code}
                          <Copy className="w-[13px] h-[13px]" />
                        </button>
                      </div>
                    </div>

                    {isArchived ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnarchiveClass(cls);
                        }}
                        className="block text-center mt-3.5 bg-primary text-white text-xs font-bold rounded-[9px] py-2.5 w-full"
                      >
                        보관 해제
                      </button>
                    ) : (
                      <span className="block text-center mt-3.5 bg-primary text-white text-xs font-bold rounded-[9px] py-2.5">
                        클래스 열기
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이름 수정</DialogTitle>
            <DialogDescription>클래스 이름을 입력하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="renameClassName">클래스 이름 *</Label>
              <Input
                id="renameClassName"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleRenameClass} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>클래스 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              '{deleteTarget?.name}' 클래스를 삭제하면 되돌릴 수 없습니다. 정말 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteClass();
              }}
              disabled={isDeleting}
              className="bg-[#C1554A] hover:bg-[#C1554A]/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
