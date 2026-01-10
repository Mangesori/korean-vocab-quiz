import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  ChevronRight,
  Users,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Assignment {
  id: string;
  quiz_id: string;
  assigned_at: string;
  quizzes: {
    id: string;
    title: string;
    words: string[];
    difficulty: string;
  };
}

interface Result {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  quizzes: {
    title: string;
  };
}

interface Class {
  id: string;
  name: string;
  classes: {
    name: string;
  };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    completedQuizzes: 0,
    averageScore: 0,
    totalClasses: 0
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    // Fetch class memberships
    const { data: membershipData } = await supabase
      .from('class_members')
      .select(`
        id,
        class_id,
        classes (
          id,
          name
        )
      `)
      .eq('student_id', user?.id);
    
    if (membershipData) {
      setClasses(membershipData);
    }

    // Fetch pending assignments (quizzes not yet completed)
    const { data: assignmentsData } = await supabase
      .from('quiz_assignments')
      .select(`
        id,
        quiz_id,
        assigned_at,
        quizzes (
          id,
          title,
          words,
          difficulty
        )
      `)
      .or(`student_id.eq.${user?.id},class_id.in.(${membershipData?.map(m => m.class_id).join(',') || 'null'})`)
      .order('assigned_at', { ascending: false });

    // Fetch completed results
    const { data: resultsData } = await supabase
      .from('quiz_results')
      .select(`
        id,
        quiz_id,
        score,
        total_questions,
        completed_at,
        quizzes (
          title
        )
      `)
      .eq('student_id', user?.id)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (resultsData) {
      setResults(resultsData as any);
      
      // Filter out completed quizzes from assignments
      const completedQuizIds = resultsData.map(r => r.quiz_id);
      const pendingAssignments = assignmentsData?.filter(
        a => !completedQuizIds.includes(a.quiz_id)
      ) || [];
      setAssignments(pendingAssignments as any);

      // Calculate stats
      const avgScore = resultsData.length > 0
        ? Math.round(resultsData.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / resultsData.length)
        : 0;

      setStats({
        totalQuizzes: (assignmentsData?.length || 0),
        completedQuizzes: resultsData.length,
        averageScore: avgScore,
        totalClasses: membershipData?.length || 0
      });
    }
  };

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      toast.error('초대 코드를 입력해주세요');
      return;
    }

    setIsJoining(true);

    // Find class by invite code using security definer function
    const { data: classData, error: classError } = await supabase
      .rpc('get_class_by_invite_code', { _invite_code: inviteCode.toUpperCase() })
      .single();

    if (classError || !classData) {
      toast.error('유효하지 않은 초대 코드입니다');
      setIsJoining(false);
      return;
    }

    // Check if already a member
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

    // Join class
    const { error: joinError } = await supabase
      .from('class_members')
      .insert({
        class_id: classData.id,
        student_id: user?.id
      });

    if (joinError) {
      toast.error('클래스 가입에 실패했습니다');
    } else {
      toast.success(`${classData.name} 클래스에 가입했습니다!`);
      setInviteCode('');
      setDialogOpen(false);
      fetchData();
    }

    setIsJoining(false);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            학생 대시보드
          </h1>
          <p className="text-muted-foreground mt-1">퀴즈를 풀고 학습을 이어가세요</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">받은 퀴즈</p>
                  <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                </div>
                <FileText className="w-8 h-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">완료한 퀴즈</p>
                  <p className="text-2xl font-bold">{stats.completedQuizzes}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-success/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">평균 점수</p>
                  <p className="text-2xl font-bold">{stats.averageScore}%</p>
                </div>
                <Trophy className="w-8 h-8 text-accent/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">가입된 클래스</p>
                  <p className="text-2xl font-bold">{stats.totalClasses}</p>
                </div>
                <Users className="w-8 h-8 text-info/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Join Class */}
        <Card className="mb-8">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">클래스 가입하기</p>
                <p className="text-sm text-muted-foreground">선생님께 받은 초대 코드로 가입하세요</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">코드 입력</Button>
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
                  <Button 
                    className="w-full" 
                    onClick={handleJoinClass}
                    disabled={isJoining}
                  >
                    {isJoining ? '가입 중...' : '가입하기'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pending Quizzes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">풀어야 할 퀴즈</CardTitle>
              <CardDescription>아직 완료하지 않은 퀴즈</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>풀어야 할 퀴즈가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <Link key={assignment.id} to={`/quiz/${assignment.quiz_id}/take`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{assignment.quizzes.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {assignment.quizzes.words.length}개 단어 · {assignment.quizzes.difficulty}
                            </p>
                          </div>
                        </div>
                        <Button size="sm">풀기</Button>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">최근 결과</CardTitle>
              <CardDescription>완료한 퀴즈 기록</CardDescription>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 완료한 퀴즈가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((result) => {
                    const percentage = Math.round((result.score / result.total_questions) * 100);
                    const isGood = percentage >= 80;
                    
                    return (
                      <div key={result.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isGood ? 'bg-success/10' : 'bg-warning/10'}`}>
                            {isGood ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <XCircle className="w-5 h-5 text-warning" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{result.quizzes.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(result.completed_at), 'M월 d일', { locale: ko })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-bold ${isGood ? 'text-success' : 'text-warning'}`}>
                              {percentage}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.score}/{result.total_questions}
                            </p>
                          </div>
                          <Link to={`/quiz/${result.quiz_id}/take`}>
                            <Button size="sm" variant="outline">다시 풀기</Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
