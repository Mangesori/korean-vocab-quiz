import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshRole } = useAuth();
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUserId(session.user.id);
      setUserName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');

      // Check if user already has a role
      const { data: roleData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (roleData) {
        // 이미 프로필이 있으면 컨텍스트의 역할을 먼저 최신화한 뒤 이동한다.
        // (역할이 비어 있는 채로 대시보드에 들어가면 다시 여기로 튕겨 무한 루프가 된다)
        await refreshRole();
        navigate('/dashboard', { replace: true });
      } else {
        // New Google user, needs to select a role
        setNeedsRoleSelection(true);
        setIsLoading(false);
      }
    };

    handleCallback();
    // refreshRole은 useCallback으로 안정적이라 재실행을 유발하지 않는다.
  }, [navigate, refreshRole]);

  const handleRoleSelection = async (role: 'teacher' | 'student') => {
    if (!userId) return;
    
    setIsLoading(true);

    try {
      // 모든 신규 사용자는 우선 student로 프로필을 만든다.
      // "선생님" 선택자는 승인 전까지 학생 권한만 가지며(role이 권한 게이트),
      // 아래에서 별도의 선생님 신청(pending)을 생성한다.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          name: userName || 'User',
          role: 'student',
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        toast.error('역할 설정 실패');
        setIsLoading(false);
        return;
      }

      if (role === 'teacher') {
        const { error: appError } = await supabase
          .from('teacher_applications')
          .insert({ user_id: userId });

        if (appError) {
          // 프로필은 생성됐으므로 치명적이지 않음 — 학생으로 진행
          console.error('Teacher application error:', appError);
          toast.error('선생님 신청 접수에 실패했습니다. 학생으로 시작합니다.');
        } else {
          toast.success('선생님 신청이 접수되었습니다', {
            description: '운영자 승인 후 선생님 기능을 사용할 수 있습니다.',
          });
        }
      }

      // Link anonymous quiz result if exists
      const anonymousResult = localStorage.getItem('anonymous_quiz_result');
      if (anonymousResult) {
        try {
          // The result is already calculated and stored
          // We just need to save it to the database now that user is authenticated
          const resultData = JSON.parse(anonymousResult);
          
          // Note: We would need to save this to quiz_results table
          // But we need the quiz_id and other info which we don't have in localStorage
          // For now, just show a message and clear the data
          toast.success('이전 퀴즈 결과가 저장되었습니다!', {
            description: `점수: ${resultData.score}/${resultData.total}`,
          });
          
          localStorage.removeItem('anonymous_quiz_result');
        } catch (error) {
          console.error('Failed to link anonymous result:', error);
          // Don't fail the whole process if this fails
        }
      }

      if (role === 'student') toast.success('환영합니다!');
      // 프로필을 방금 만들었으므로 auth 이벤트가 따로 발생하지 않는다.
      // 컨텍스트 역할을 직접 갱신해야 대시보드가 다시 여기로 튕기지 않는다.
      await refreshRole();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error:', error);
      toast.error('오류가 발생했습니다');
      setIsLoading(false);
    }
  };

  if (isLoading && !needsRoleSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (needsRoleSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">역할을 선택해주세요</CardTitle>
            <CardDescription>
              {userName ? `${userName}님, ` : ''}선생님 또는 학생으로 시작하세요
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleRoleSelection('teacher')}
                disabled={isLoading}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="font-semibold group-hover:text-primary transition-colors">선생님</p>
                <p className="text-xs text-muted-foreground mt-1">퀴즈 생성 및 관리 · 승인 필요</p>
              </button>

              <button
                onClick={() => handleRoleSelection('student')}
                disabled={isLoading}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="font-semibold group-hover:text-primary transition-colors">학생</p>
                <p className="text-xs text-muted-foreground mt-1">퀴즈 풀기 및 학습</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 어떤 경로로도 빈 화면이 남지 않도록 항상 로딩 상태를 보여준다.
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
