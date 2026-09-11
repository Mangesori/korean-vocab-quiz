import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LevelBadge } from '@/components/ui/level-badge';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface QuizOption {
  id: string;
  title: string;
  difficulty: string;
  words: string[];
}

interface AssignQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  teacherId: string;
  /** 이미 이 클래스에 배정된 퀴즈 id — 목록에서 "이미 배정됨"으로 표시한다. */
  assignedQuizIds: string[];
}

export function AssignQuizDialog({
  open,
  onOpenChange,
  classId,
  className,
  teacherId,
  assignedQuizIds,
}: AssignQuizDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['teacher-quizzes-for-assign', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, difficulty, words')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuizOption[];
    },
    enabled: open && !!teacherId,
  });

  const assignedSet = useMemo(() => new Set(assignedQuizIds), [assignedQuizIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (quizzes ?? []).filter((quiz) => !q || quiz.title.toLowerCase().includes(q));
  }, [quizzes, search]);

  const toggle = (quizId: string) => {
    if (assignedSet.has(quizId)) return;
    setSelected((prev) => (prev.includes(quizId) ? prev.filter((id) => id !== quizId) : [...prev, quizId]));
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSearch('');
      setSelected([]);
    }
    onOpenChange(next);
  };

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setIsAssigning(true);
    try {
      // 이 클래스 멤버에게 같은 퀴즈가 이미 개인 배정(student_id)돼 있으면 클래스
      // 배정이 그들을 포함하므로 중복이다 — 정리한다 (useQuizSharing.doAssign과 동일 로직).
      const { data: members } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('class_id', classId);
      const memberIds = (members ?? []).map((m) => m.student_id);

      if (memberIds.length > 0) {
        const { data: redundant } = await supabase
          .from('quiz_assignments')
          .select('id')
          .in('quiz_id', selected)
          .in('student_id', memberIds);
        if (redundant && redundant.length > 0) {
          await supabase
            .from('quiz_assignments')
            .delete()
            .in('id', redundant.map((r) => r.id));
        }
      }

      const { error } = await supabase.from('quiz_assignments').insert(
        selected.map((quizId) => ({ quiz_id: quizId, class_id: classId }))
      );
      if (error) throw error;

      toast.success(
        selected.length === 1 ? '퀴즈를 배정했습니다' : `퀴즈 ${selected.length}개를 배정했습니다`
      );
      queryClient.invalidateQueries({ queryKey: ['classDetail', classId] });
      handleClose(false);
    } catch (error) {
      console.error('Assign quiz error:', error);
      toast.error('퀴즈 배정에 실패했습니다');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>퀴즈 배정</DialogTitle>
          <p className="text-sm text-muted-foreground">{className}에 배정할 퀴즈를 고르세요.</p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A29B94]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목으로 검색…"
            className="pl-10 bg-[#FAF8F5] border-[#E3DCD3] rounded-[11px]"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {search ? '검색 결과가 없습니다' : '만든 퀴즈가 없습니다'}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-[12px] border border-[#EFE9E2] divide-y divide-[#F4F0EA]">
            {filtered.map((quiz) => {
              const alreadyAssigned = assignedSet.has(quiz.id);
              const isChecked = selected.includes(quiz.id);
              return (
                <label
                  key={quiz.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${
                    alreadyAssigned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={alreadyAssigned}
                    onCheckedChange={() => toggle(quiz.id)}
                  />
                  <LevelBadge level={quiz.difficulty} />
                  <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{quiz.title}</span>
                  <span className="text-[11.5px] text-[#8A837D] shrink-0">
                    {alreadyAssigned ? '이미 배정됨' : `${quiz.words?.length ?? 0}개 단어`}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {selected.length > 0 ? `${selected.length}개 선택됨` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isAssigning}>
              취소
            </Button>
            <Button onClick={handleAssign} disabled={selected.length === 0 || isAssigning}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              배정하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
