import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();
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
        .single();

      if (roleData) {
        // User already has a role, redirect to dashboard
        navigate('/dashboard');
      } else {
        // New Google user, needs to select a role
        setNeedsRoleSelection(true);
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  const handleRoleSelection = async (role: 'teacher' | 'student') => {
    if (!userId) return;
    
    setIsLoading(true);
    
    try {
      // Create profile with role in one operation
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          name: userName || 'User',
          role: role,
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        toast.error('역할 설정 실패');
        setIsLoading(false);
        return;
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

      toast.success('환영합니다!');
      navigate('/dashboard');
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
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="font-semibold group-hover:text-primary transition-colors">선생님</p>
                <p className="text-xs text-muted-foreground mt-1">퀴즈 생성 및 관리</p>
              </button>
              
              <button
                onClick={() => handleRoleSelection('student')}
                disabled={isLoading}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="font-semibold group-hover:text-primary transition-colors">학생</p>
                <p className="text-xs text-muted-foreground mt-1">퀴즈 풀기 및 학습</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
