
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { LevelBadge } from '@/components/ui/level-badge';

interface Assignment {
  id: string;
  quiz_id: string;
  assigned_at: string;
  quizzes: {
    id: string;
    title: string;
    difficulty: string;
    words: string[];
  };
}

export default function ClassAssignedQuizzes() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  
  const [className, setClassName] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
    // Fetch class name
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('name')
      .eq('id', id)
      .single();

    if (classError || !cls) {
      toast.error('클래스를 찾을 수 없습니다');
      navigate('/classes');
      return;
    }

    setClassName(cls.name);

    // Fetch assignments
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('quiz_assignments')
      .select(`
        id,
        quiz_id,
        assigned_at,
        quizzes (
          id,
          title,
          difficulty,
          words
        )
      `)
      .eq('class_id', id)
      .order('assigned_at', { ascending: false });

    if (assignmentsError) {
      toast.error('퀴즈 목록을 불러오지 못했습니다');
      return;
    }

    if (assignmentsData) {
      // @ts-ignore: Supabase types complexity
      setAssignments(assignmentsData);
    }

    setIsLoading(false);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.VIEW_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate(`/class/${id}`)} className="self-start mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> 클래스로 돌아가기
          </Button>

          <div className="flex items-center gap-2">
             <div className="bg-primary/10 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{className}</h1>
              <p className="text-muted-foreground">배정된 퀴즈 목록 ({assignments.length}개)</p>
            </div>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/10">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
             <p className="text-lg font-medium text-muted-foreground">배정된 퀴즈가 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assignments.map((assignment) => (
              <div 
                key={assignment.id} 
                className="group relative flex flex-col p-4 border rounded-lg hover:border-primary/50 transition-all bg-card hover:shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                    {assignment.quizzes?.title || '삭제된 퀴즈'}
                  </h4>
                  <LevelBadge level={assignment.quizzes?.difficulty || 'A1'} />
                </div>
                
                <div className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                    {assignment.quizzes?.words?.slice(0, 5).join(', ')}
                    {(assignment.quizzes?.words?.length || 0) > 5 ? '...' : ''}
                </div>

                <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground border-t">
                  <div className="flex items-center bg-muted/50 px-2 py-1 rounded">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(assignment.assigned_at), 'yyyy.MM.dd', { locale: ko })}
                  </div>
                  <div className="flex gap-1 ml-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate(`/quiz/${assignment.quiz_id}`)}
                    >
                      문제 보기
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate(`/quiz/${assignment.quiz_id}?tab=results`)}
                    >
                      결과 확인
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
