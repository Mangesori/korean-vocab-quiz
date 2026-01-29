import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  FileX,
  Users,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClassInfo {
  id: string;
  name: string;
}

interface StudentInfo {
  student_id: string;
  name: string;
}

interface WrongAnswerData {
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  count: number;
}

export default function WrongAnswerQuizCreate() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [step, setStep] = useState(1);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', user!.id);
      if (error) throw error;
      return data as ClassInfo[];
    },
    enabled: !!user?.id && can(PERMISSIONS.CREATE_QUIZ),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students', selectedClassId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_members')
        .select('student_id, profiles!inner(name)')
        .eq('class_id', selectedClassId);
      if (error) throw error;
      return data.map((d: any) => ({
        student_id: d.student_id,
        name: d.profiles.name,
      })) as StudentInfo[];
    },
    enabled: !!selectedClassId,
  });

  const { data: wrongAnswers, isLoading: wrongAnswersLoading } = useQuery({
    queryKey: ['wrong-answers-aggregate', selectedStudents],
    queryFn: async () => {
      if (selectedStudents.length === 0) return [];

      // Get quiz results for selected students
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select('answers')
        .in('student_id', selectedStudents);

      if (error) throw error;

      // Aggregate wrong answers
      const wrongAnswerMap = new Map<string, WrongAnswerData>();

      results.forEach((result) => {
        const answers = result.answers as any[];
        answers?.forEach((answer) => {
          if (!answer.isCorrect) {
            const key = answer.correctAnswer;
            const existing = wrongAnswerMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              wrongAnswerMap.set(key, {
                word: answer.correctAnswer,
                correct_answer: answer.correctAnswer,
                sentence: answer.sentence || '',
                translation: answer.translation || null,
                count: 1,
              });
            }
          }
        });
      });

      // Sort by count and return
      return Array.from(wrongAnswerMap.values()).sort((a, b) => b.count - a.count);
    },
    enabled: selectedStudents.length > 0,
  });

  const [selectedWrongAnswers, setSelectedWrongAnswers] = useState<string[]>([]);

  const createQuizMutation = useMutation({
    mutationFn: async () => {
      const selectedProblems = wrongAnswers?.filter((wa) =>
        selectedWrongAnswers.includes(wa.word)
      );

      if (!selectedProblems || selectedProblems.length === 0) {
        throw new Error('선택된 문제가 없습니다.');
      }

      const problems = selectedProblems.map((p, index) => ({
        id: `wrong-${index}`,
        word: p.word,
        answer: p.correct_answer,
        sentence: p.sentence,
        hint: '',
        translation: p.translation || '',
      }));

      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          teacher_id: user!.id,
          title: quizTitle || '오답 복습 퀴즈',
          words: selectedProblems.map((p) => p.word),
          difficulty: 'B1',
          words_per_set: 5,
          timer_enabled: false,
          translation_language: 'en',
          problems: problems,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('오답 복습 퀴즈가 생성되었습니다.');
      navigate(`/quiz/${data.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '퀴즈 생성에 실패했습니다.');
    },
  });

  if (authLoading || classesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'teacher' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === students?.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students?.map((s) => s.student_id) || []);
    }
  };

  const toggleWrongAnswerSelection = (word: string) => {
    setSelectedWrongAnswers((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              대시보드로 돌아가기
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileX className="h-6 w-6" />
            오답 기반 복습 퀴즈 만들기
          </h1>
          <p className="text-muted-foreground mt-1">
            학생들이 자주 틀린 문제로 복습 퀴즈를 생성합니다.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div
            className={`flex items-center gap-2 ${
              step >= 1 ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              1
            </div>
            <span className="hidden sm:inline">클래스 선택</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div
            className={`flex items-center gap-2 ${
              step >= 2 ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              2
            </div>
            <span className="hidden sm:inline">학생 선택</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div
            className={`flex items-center gap-2 ${
              step >= 3 ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              3
            </div>
            <span className="hidden sm:inline">문제 선택</span>
          </div>
        </div>

        {/* Step 1: Select Class */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                클래스 선택
              </CardTitle>
              <CardDescription>오답을 분석할 클래스를 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="클래스를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedClassId}
                >
                  다음
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Students */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                학생 선택
              </CardTitle>
              <CardDescription>
                오답을 분석할 학생을 선택하세요. ({selectedStudents.length}명 선택됨)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {studentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : students?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  등록된 학생이 없습니다.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedStudents.length === students?.length}
                      onCheckedChange={toggleAllStudents}
                    />
                    <Label>전체 선택</Label>
                  </div>
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {students?.map((student) => (
                      <div
                        key={student.student_id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedStudents.includes(student.student_id)}
                          onCheckedChange={() => toggleStudentSelection(student.student_id)}
                        />
                        <Label>{student.name}</Label>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  이전
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={selectedStudents.length === 0}
                >
                  다음
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Wrong Answers */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                문제 선택
              </CardTitle>
              <CardDescription>
                퀴즈에 포함할 오답을 선택하세요. ({selectedWrongAnswers.length}개 선택됨)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">퀴즈 제목</Label>
                <Input
                  id="title"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="오답 복습 퀴즈"
                />
              </div>

              {wrongAnswersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : wrongAnswers?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  선택한 학생들의 오답 데이터가 없습니다.
                </p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {wrongAnswers?.map((wa) => (
                    <div
                      key={wa.word}
                      className="flex items-center gap-3 p-3 rounded border hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedWrongAnswers.includes(wa.word)}
                        onCheckedChange={() => toggleWrongAnswerSelection(wa.word)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{wa.word}</span>
                          <span className="text-xs text-muted-foreground">
                            ({wa.count}회 틀림)
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {wa.sentence}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  이전
                </Button>
                <Button
                  onClick={() => createQuizMutation.mutate()}
                  disabled={selectedWrongAnswers.length === 0 || createQuizMutation.isPending}
                >
                  {createQuizMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  퀴즈 생성
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
