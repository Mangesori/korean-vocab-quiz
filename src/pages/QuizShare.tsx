import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function QuizShare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [teacherName, setTeacherName] = useState<string>("");
  const [remainingAttempts, setRemainingAttempts] = useState<number>(0);
  const [anonymousName, setAnonymousName] = useState("");


  useEffect(() => {
    if (user?.user_metadata?.name) {
      setAnonymousName(user.user_metadata.name);
    }
  }, [user]);

  useEffect(() => {
    loadSharedQuiz();
  }, [token]);

  const loadSharedQuiz = async () => {
    try {
      // 1. Load share info
      const { data: shareData, error: shareError } = await supabase
        .from("quiz_shares")
        .select("*")
        .eq("share_token", token)
        .single();

      if (shareError || !shareData) {
        setError("유효하지 않은 링크입니다");
        setIsLoading(false);
        return;
      }

      // 2. Check expiration
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        setError("만료된 링크입니다");
        setIsLoading(false);
        return;
      }

      // 3. Check attempt limit
      const maxAttempts = shareData.max_attempts || 3;
      const completionCount = shareData.completion_count || 0;
      const remaining = maxAttempts - completionCount;
      
      if (remaining <= 0) {
        setError("응시 가능 횟수를 초과했습니다");
        setIsLoading(false);
        return;
      }
      
      setRemainingAttempts(remaining);

      // 4. Increment view count
      await supabase
        .from("quiz_shares")
        .update({ view_count: shareData.view_count + 1 })
        .eq("id", shareData.id);

      // 5. Load quiz
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", shareData.quiz_id)
        .single();

      if (quizError || !quizData) {
        setError("퀴즈를 불러올 수 없습니다");
        setIsLoading(false);
        return;
      }

      // 6. Load teacher name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", quizData.teacher_id)
        .single();

      setQuiz(quizData);
      setTeacherName(profileData?.name || "선생님");
      setIsLoading(false);
    } catch (error) {
      console.error("Load error:", error);
      setError("오류가 발생했습니다");
      setIsLoading(false);
    }
  };

  const startQuiz = () => {
    // Navigate to existing quiz take page with share token and name
    navigate(`/quiz/${quiz.id}/take?share=${token}&name=${encodeURIComponent(anonymousName.trim())}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Banner */}
        <Alert className="mb-6 border-primary bg-primary/5">
          <AlertDescription className="text-center">
            이 퀴즈는 <span className="font-semibold">{teacherName}</span>님이 공유했습니다
          </AlertDescription>
        </Alert>

        {/* Quiz Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{quiz.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">난이도:</span>{" "}
                <span className="font-medium">{quiz.difficulty}</span>
              </div>
              <div>
                <span className="text-muted-foreground">문제 수:</span>{" "}
                <span className="font-medium">{quiz.problems.length}개</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">남은 응시 횟수:</span>{" "}
                <span className="font-medium text-primary">{remainingAttempts}회</span>
              </div>
            </div>


            <div className="space-y-4 pt-4 border-t">
              {user ? (
                <div className="text-center space-y-2">
                  <p className="font-medium text-lg">
                    <span className="text-primary">{user.user_metadata.name}</span>님으로 참여합니다
                  </p>
                  <p className="text-sm text-muted-foreground">
                    준비되셨나요?
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    이름을 입력해주세요
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={anonymousName}
                      onChange={(e) => setAnonymousName(e.target.value)}
                      placeholder="홍길동"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {anonymousName.trim().length > 0 && anonymousName.trim().length < 2 && (
                      <p className="text-xs text-destructive mt-1">
                        이름은 2글자 이상 입력해주세요
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={startQuiz}
                disabled={(!user && (!anonymousName.trim() || anonymousName.trim().length < 2))}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                퀴즈 시작하기
              </button>
            </div>

            {!user && (
              <p className="text-sm text-muted-foreground text-center">
                로그인 없이 바로 시작할 수 있습니다
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
