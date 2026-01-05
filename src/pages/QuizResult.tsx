import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Trophy,
  CheckCircle,
  XCircle,
  Home,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { LevelBadge } from '@/components/ui/level-badge';

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
}

interface UserAnswer {
  problemId: string;
  answer: string;
  isCorrect: boolean;
}

interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  problems: Problem[];
  words_per_set: number;
}

interface Result {
  id: string;
  score: number;
  total_questions: number;
  answers: UserAnswer[];
  completed_at: string;
}

export default function QuizResult() {
  const { id, resultId } = useParams<{ id: string; resultId: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user && id && resultId) {
      fetchData();
    }
  }, [user, id, resultId]);

  const fetchData = async () => {
    // Fetch quiz
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();

    // Fetch result
    const { data: resultData } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (quizData && resultData) {
      setQuiz(quizData as unknown as Quiz);
      setResult(resultData as unknown as Result);
    }
    setIsLoading(false);
  };

  const toggleTranslation = (key: string) => {
    setShowTranslations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || role !== 'student') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!quiz || !result) return null;

  const percentage = Math.round((result.score / result.total_questions) * 100);
  const isGood = percentage >= 80;
  const isMedium = percentage >= 50 && percentage < 80;

  const getAnswerForProblem = (problemId: string) => {
    return result.answers.find(a => a.problemId === problemId);
  };

  // Group problems by set
  const wordsPerSet = quiz.words_per_set || 5;
  const groupedProblems: Problem[][] = [];
  for (let i = 0; i < quiz.problems.length; i += wordsPerSet) {
    groupedProblems.push(quiz.problems.slice(i, i + wordsPerSet));
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Result Summary */}
        <Card className="mb-8 overflow-hidden">
          <div className={`p-6 sm:p-8 text-center ${isGood ? 'bg-success/10' : isMedium ? 'bg-warning/10' : 'bg-destructive/10'}`}>
            <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${isGood ? 'bg-success/20' : isMedium ? 'bg-warning/20' : 'bg-destructive/20'}`}>
              <Trophy className={`w-8 h-8 sm:w-10 sm:h-10 ${isGood ? 'text-success' : isMedium ? 'text-warning' : 'text-destructive'}`} />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{quiz.title}</h1>
            <LevelBadge level={quiz.difficulty} className="mb-4" />
            
            <div className={`text-5xl sm:text-6xl font-bold mb-2 ${isGood ? 'text-success' : isMedium ? 'text-warning' : 'text-destructive'}`}>
              {percentage}%
            </div>
            <p className="text-muted-foreground">
              {result.score} / {result.total_questions} 정답
            </p>
            
            <p className="mt-4 text-base sm:text-lg font-medium">
              {isGood ? '정말 잘했어요! 🎉' : isMedium ? '좋아요! 조금만 더 힘내세요! 💪' : '다시 한번 도전해보세요! 📚'}
            </p>
          </div>
          
          <CardContent className="p-4">
            <div className="flex gap-3 justify-center">
              <Link to="/dashboard">
                <Button variant="outline">
                  <Home className="w-4 h-4 mr-2" /> 대시보드
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Problem Review - Grouped by Set */}
        <div className="space-y-6">
          {groupedProblems.map((setProblems, setIdx) => (
            <div key={setIdx} className="bg-card rounded-2xl shadow-lg p-4 sm:p-6 border">
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-foreground">
                세트 {setIdx + 1}
              </h3>
              <div className="space-y-3">
                {setProblems.map((problem, idx) => {
                  const userAnswer = getAnswerForProblem(problem.id);
                  const isCorrect = userAnswer?.isCorrect;
                  const completedSentence = problem.sentence.replace(/\(\s*\)|\(\)/, problem.answer);
                  const translationKey = `result-${setIdx}-${idx}`;
                  const showTranslation = showTranslations[translationKey];
                  
                  return (
                    <div 
                      key={problem.id}
                      className={`p-4 rounded-xl ${
                        isCorrect ? 'bg-success/10 border-2 border-success/30' : 'bg-destructive/10 border-2 border-destructive/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-foreground mb-1 text-lg">
                            {completedSentence}
                          </p>
                          {!isCorrect && (
                            <div className="text-sm mt-2">
                              <span className="text-destructive">내 답안: {userAnswer?.answer || '(답 없음)'}</span>
                              <span className="text-muted-foreground mx-2">→</span>
                              <span className="text-success">정답: {problem.answer}</span>
                            </div>
                          )}
                          
                          {problem.translation && (
                            <div className="mt-3">
                              <button
                                onClick={() => toggleTranslation(translationKey)}
                                className="text-sm px-4 py-2 bg-info/10 text-info rounded-full hover:bg-info/20 transition-all inline-flex items-center gap-1"
                              >
                                <Globe className="w-3 h-3" />
                                {showTranslation ? '번역 숨기기' : '번역 보기 🌐'}
                                {showTranslation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              
                              {showTranslation && (
                                <div className="mt-2 p-3 bg-info/10 rounded-lg border-2 border-info/30">
                                  <p className="text-foreground">{problem.translation}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link to="/dashboard" className="block">
            <Button className="w-full" size="lg">
              새 퀴즈 풀기 ✨
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
