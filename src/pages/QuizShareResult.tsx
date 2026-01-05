import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, TrendingUp, Users, BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QuizResult {
  quizTitle: string;
  score: number;
  total: number;
  answers: Array<{
    problemId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    sentence: string;
  }>;
}

export default function QuizShareResult() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    // Load result from localStorage
    const resultData = localStorage.getItem('anonymous_quiz_result');
    if (resultData) {
      setResult(JSON.parse(resultData));
    } else {
      // No result found, redirect to home
      navigate('/');
    }
  }, [navigate]);

  const handleSignup = () => {
    // Navigate to signup page
    navigate('/auth?mode=signup');
  };

  if (!result) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p>결과를 불러오는 중...</p>
        </div>
      </AppLayout>
    );
  }

  const percentage = Math.round((result.score / result.total) * 100);
  const wrongAnswers = result.answers.filter(a => !a.isCorrect);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Score Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-center">{result.quizTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-primary/10">
                <div className="text-4xl font-bold text-primary">
                  {percentage}%
                </div>
              </div>
              <p className="text-lg text-muted-foreground">
                {result.score} / {result.total} 정답
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Signup CTA Card - Only show for anonymous users */}
        {!user && (
          <Card className="mb-6 border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                🎯 학습 기록을 저장하고 더 많은 기능을 사용하세요!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">모든 퀴즈 결과 자동 저장</p>
                    <p className="text-sm text-muted-foreground">언제든지 과거 결과를 확인하세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">성적 분석 및 진도 추적</p>
                    <p className="text-sm text-muted-foreground">약점을 파악하고 실력을 향상시키세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">선생님과 연결</p>
                    <p className="text-sm text-muted-foreground">클래스에 참여하고 피드백을 받으세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">듣기 기능 사용</p>
                    <p className="text-sm text-muted-foreground">모든 문장을 음성으로 들을 수 있습니다</p>
                  </div>
                </div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full text-lg h-14"
                onClick={handleSignup}
              >
                무료 회원가입하기
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <button 
                  onClick={() => navigate('/auth?mode=login')}
                  className="text-primary hover:underline"
                >
                  로그인
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wrong Answers */}
        {wrongAnswers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                틀린 문제 ({wrongAnswers.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {wrongAnswers.map((answer, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">문제 {idx + 1}</p>
                  <p className="mb-3">{answer.sentence}</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">내 답:</span>
                      <span className="text-destructive font-medium">{answer.userAnswer || "(답 없음)"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">정답:</span>
                      <span className="text-success font-medium">{answer.correctAnswer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate('/')}>
            홈으로
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
