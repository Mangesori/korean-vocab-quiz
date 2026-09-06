import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LevelBadge } from '@/components/ui/level-badge';
import { formatDateShort } from '@/lib/formatDate';

interface TeacherDetailDialogProps {
  teacher: { user_id: string; email: string | null; profile: { name: string } | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClassRow {
  id: string;
  name: string;
  created_at: string;
  studentCount: number;
}

interface QuizRow {
  id: string;
  title: string;
  difficulty: string | null;
  created_at: string;
  assignmentCount: number;
}

// 관리자용 읽기전용 상세 보기. 기존 편집 가능한 ClassDetail/Quizzes 컴포넌트는
// 재사용하지 않고(수정/삭제 등 부가 기능까지 딸려와 오히려 복잡해짐) 여기서
// 단순 요약 표만 별도로 그린다.
export function TeacherDetailDialog({ teacher, open, onOpenChange }: TeacherDetailDialogProps) {
  const teacherId = teacher?.user_id;

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['admin-teacher-classes', teacherId],
    queryFn: async () => {
      const { data: classRows, error } = await supabase
        .from('classes')
        .select('id, name, created_at')
        .eq('teacher_id', teacherId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!classRows || classRows.length === 0) return [] as ClassRow[];

      const classIds = classRows.map((c) => c.id);
      const { data: memberRows, error: memberError } = await supabase
        .from('class_members')
        .select('class_id')
        .in('class_id', classIds);
      if (memberError) throw memberError;

      const counts = new Map<string, number>();
      for (const m of memberRows ?? []) {
        counts.set(m.class_id, (counts.get(m.class_id) ?? 0) + 1);
      }

      return classRows.map((c) => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        studentCount: counts.get(c.id) ?? 0,
      })) as ClassRow[];
    },
    enabled: open && !!teacherId,
  });

  const { data: quizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['admin-teacher-quizzes', teacherId],
    queryFn: async () => {
      const { data: quizRows, error } = await supabase
        .from('quizzes')
        .select('id, title, difficulty, created_at')
        .eq('teacher_id', teacherId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!quizRows || quizRows.length === 0) return [] as QuizRow[];

      const quizIds = quizRows.map((q) => q.id);
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('quiz_assignments')
        .select('quiz_id')
        .in('quiz_id', quizIds);
      if (assignmentError) throw assignmentError;

      const counts = new Map<string, number>();
      for (const a of assignmentRows ?? []) {
        counts.set(a.quiz_id, (counts.get(a.quiz_id) ?? 0) + 1);
      }

      return quizRows.map((q) => ({
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        created_at: q.created_at,
        assignmentCount: counts.get(q.id) ?? 0,
      })) as QuizRow[];
    },
    enabled: open && !!teacherId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teacher?.profile?.name || '(이름 없음)'}</DialogTitle>
          <p className="text-sm text-muted-foreground">{teacher?.email || '(이메일 없음)'}</p>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-medium mb-2">클래스</h3>
            {classesLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : !classes || classes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">클래스가 없습니다</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead className="w-[90px] text-right">학생 수</TableHead>
                      <TableHead className="w-[110px]">생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.studentCount}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateShort(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2">퀴즈</h3>
            {quizzesLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : !quizzes || quizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">퀴즈가 없습니다</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-[70px]">난이도</TableHead>
                      <TableHead className="w-[90px] text-right">배정 횟수</TableHead>
                      <TableHead className="w-[110px]">생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quizzes.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.title}</TableCell>
                        <TableCell>
                          {q.difficulty ? <LevelBadge level={q.difficulty} /> : <span className="text-muted-foreground text-xs">미지정</span>}
                        </TableCell>
                        <TableCell className="text-right">{q.assignmentCount}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateShort(q.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
