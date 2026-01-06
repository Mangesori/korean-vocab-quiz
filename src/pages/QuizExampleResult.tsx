import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ArrowRight, Volume2, Lightbulb } from "lucide-react";
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
    translation?: string;
    audioUrl?: string;
  }>;
}

export default function QuizExampleResult() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

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

  const toggleTranslation = (key: string) => {
    setShowTranslations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const playAudio = (audioUrl: string, problemId: string) => {
    if (playingAudio === problemId) {
      setPlayingAudio(null);
      return;
    }
    
    setPlayingAudio(problemId);
    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
    audio.play().catch(() => setPlayingAudio(null));
  };

  const handleSignup = () => {
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

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-2xl font-bold mb-4">{result.quizTitle}</h1>
             <div className="relative inline-flex items-center justify-center">
              <div className="text-6xl font-black bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent">
                {percentage}%
              </div>
              {percentage >= 100 && (
                <span className="absolute -top-4 -right-8 text-4xl animate-bounce">🎉</span>
              )}
            </div>
            <p className="mt-4 text-muted-foreground font-medium">
              {result.total}문제 중 {result.score}문제를 맞혔어요!
            </p>
             <p className="mt-2 text-lg font-bold text-foreground">
              {percentage >= 80 ? '정말 잘했어요! 👏' : percentage >= 50 ? '좋아요! 조금만 더 힘내볼까요? 💪' : '다시 한번 도전해보세요! 📚'}
            </p>
          </div>

          {/* Answer List */}
          <div className="space-y-4 mb-12">
             <div className="flex items-center gap-2 px-1 mb-4">
               <span className="text-lg font-bold text-foreground">전체 문제 복습</span>
               <div className="h-px bg-border flex-1" />
             </div>

             {result.answers.map((answer, idx) => {
                const parts = answer.sentence.split(/\(\s*.*?\s*\)|\(\)/);
                const translationKey = `result-${idx}`;
                const showTranslation = showTranslations[translationKey];
                
                return (
                  <Card 
                    key={idx}
                    className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Problem Number */}
                        <span className="text-primary font-bold text-lg mt-1 min-w-[32px]">
                          {idx + 1}.
                        </span>
                        
                        {/* Icon Indicator */}
                        <div className="mt-1 shrink-0">
                          {answer.isCorrect ? (
                            <div className="p-1 rounded-full bg-success/10 text-success">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="p-1 rounded-full bg-destructive/10 text-destructive">
                              <XCircle className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-3">
                          {/* Sentence Display with Buttons */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="text-lg leading-relaxed text-foreground flex-1">
                              {parts[0]}
                              <span className={answer.isCorrect ? "font-bold text-success mx-1 underline decoration-2 underline-offset-4" : "font-bold text-success mx-1"}>
                                {answer.correctAnswer}
                              </span>
                              {parts[1]}
                            </div>
                            
                            {/* Action Buttons - Both enabled for QuizExample */}
                            <div className="flex gap-2 shrink-0">
                              {/* Audio Button - Always enabled */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => answer.audioUrl && playAudio(answer.audioUrl, answer.problemId)}
                                disabled={!answer.audioUrl}
                              >
                                <Volume2 className={`w-4 h-4 mr-1 ${playingAudio === answer.problemId ? 'text-primary animate-pulse' : ''}`} />
                                듣기
                              </Button>
                              
                              {/* Translation Toggle - Always enabled */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => answer.translation && toggleTranslation(translationKey)}
                                disabled={!answer.translation}
                              >
                                <Lightbulb className={`w-4 h-4 mr-1 ${showTranslation ? 'text-warning' : ''}`} />
                                번역 보기
                              </Button>
                            </div>
                          </div>

                          {/* Incorrect Answer Feedback */}
                          {!answer.isCorrect && (
                            <div className="text-sm bg-destructive/5 text-destructive px-3 py-2 rounded-md inline-block">
                              <span className="font-medium mr-2">내 답안:</span>
                              <span className="line-through opacity-80">{answer.userAnswer || '(입력 없음)'}</span>
                            </div>
                          )}
                          
                          {/* Translation Display */}
                          {showTranslation && answer.translation && (
                            <div className="px-4 py-2 bg-info/10 rounded-lg text-sm border border-info/30 text-muted-foreground">
                              {answer.translation}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
             })}
          </div>

          {/* Signup CTA Card - Only show for anonymous users */}
          {!user && (
            <Card className="mb-12 border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <CardHeader className="text-center pb-2 relative z-10">
                <CardTitle className="text-3xl font-bold">
                   더 많은 기능을 경험해보세요! 🚀
                </CardTitle>
                <div className="text-muted-foreground text-base">
                  회원가입하고 나만의 단어장과 퀴즈를 만들어보세요.
                </div>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-background/60 p-4 rounded-xl flex items-start gap-3">
                    <div className="w-6 h-6 text-primary mt-1">📝</div>
                    <div>
                      <p className="font-bold text-base">나만의 퀴즈 생성</p>
                      <p className="text-sm text-muted-foreground">원하는 단어로 맞춤 퀴즈를 만들어보세요</p>
                    </div>
                  </div>
                  <div className="bg-background/60 p-4 rounded-xl flex items-start gap-3">
                    <div className="w-6 h-6 text-primary mt-1">🔊</div>
                    <div>
                      <p className="font-bold text-base">원어민 발음 듣기</p>
                      <p className="text-sm text-muted-foreground">모든 예문의 정확한 발음을 들어보세요</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center pt-2">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto min-w-[200px] h-12 text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                    onClick={handleSignup}
                  >
                    무료로 시작하기
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="mt-4 text-sm text-muted-foreground">
                    이미 계정이 있으신가요?{" "}
                    <button 
                      onClick={() => navigate('/auth?mode=login')}
                      className="text-primary font-semibold hover:underline"
                    >
                      로그인
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Home Button */}
          <div className="flex justify-center pb-12">
             <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> 홈으로 돌아가기
             </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
