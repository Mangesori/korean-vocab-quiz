import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle,
  XCircle,
  Home,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Volume2
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface Problem {
  id: string;
  word: string;
  answer: string;
  sentence: string;
  hint: string;
  translation: string;
  sentence_audio_url?: string;
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
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      // Fetch audio URLs from quiz_problems table
      const { data: problemsData } = await supabase
        .from('quiz_problems')
        .select('problem_id, sentence_audio_url')
        .eq('quiz_id', id);
      
      // Create audio URL map
      const audioMap = new Map(
        problemsData?.map(p => [p.problem_id, p.sentence_audio_url]) || []
      );
      
      // Add audio URLs to problems
      const problemsWithAudio = (quizData.problems as any[]).map(problem => ({
        ...problem,
        sentence_audio_url: audioMap.get(problem.id) || problem.sentence_audio_url,
      }));
      
      setQuiz({ ...quizData, problems: problemsWithAudio } as unknown as Quiz);
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

  const playAudio = useCallback((audioUrl: string, problemId: string) => {
    if (!audioUrl) return;
    
    // Stop currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (playingAudio === problemId) {
      setPlayingAudio(null);
      return;
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingAudio(problemId);
    
    audio.onended = () => {
      setPlayingAudio(null);
      audioRef.current = null;
    };
    
    audio.onerror = () => {
      console.error('Audio playback error');
      setPlayingAudio(null);
      audioRef.current = null;
    };
    
    audio.play().catch((err) => {
      console.error('Audio play error:', err);
      setPlayingAudio(null);
    });
  }, [playingAudio]);

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
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Result Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-2xl font-bold mb-4">{quiz.title}</h1>
            <div className="relative inline-flex items-center justify-center">
              <div className="text-6xl font-black bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent">
                {percentage}%
              </div>
              {percentage >= 100 && (
                <span className="absolute -top-4 -right-8 text-4xl animate-bounce">🎉</span>
              )}
            </div>
            <p className="mt-4 text-muted-foreground font-medium">
              {result.total_questions}문제 중 {result.score}문제를 맞혔어요!
            </p>
            <p className="mt-2 text-lg font-bold text-foreground">
              {isGood ? '정말 잘했어요! 👏' : isMedium ? '좋아요! 조금만 더 힘내볼까요? 💪' : '다시 한번 도전해보세요! 📚'}
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="rounded-full">
                <Home className="w-4 h-4 mr-2" /> 대시보드로 돌아가기
              </Button>
            </Link>
          </div>

          {/* Problem Review - Grouped by Set */}
          <div className="space-y-8">
            {groupedProblems.map((setProblems, setIdx) => (
              <div key={setIdx} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-lg font-bold text-foreground">세트 {setIdx + 1}</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <div className="grid gap-4">
                  {setProblems.map((problem, idx) => {
                    const userAnswer = getAnswerForProblem(problem.id);
                    const isCorrect = userAnswer?.isCorrect;
                    const parts = problem.sentence.split(/\(\s*\)|\(\)/);
                    const translationKey = `result-${setIdx}-${idx}`;
                    const showTranslation = showTranslations[translationKey];
                    const problemNumber = setIdx * wordsPerSet + idx + 1;
                    
                    return (
                      <Card 
                        key={problem.id}
                        className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {/* Problem Number */}
                            <span className="text-primary font-bold text-lg mt-1 min-w-[32px]">
                              {problemNumber}.
                            </span>
                            
                            {/* Icon Indicator */}
                            <div className="mt-1 shrink-0">
                               {isCorrect ? (
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
                                  <span className={isCorrect ? "font-bold text-success mx-1 underline decoration-2 underline-offset-4" : "font-bold text-success mx-1"}>
                                    {problem.answer}
                                  </span>
                                  {parts[1]}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex gap-2 shrink-0">
                                  {/* Audio Button */}
                                  {problem.sentence_audio_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => playAudio(problem.sentence_audio_url!, problem.id)}
                                    >
                                      <Volume2 className={`w-4 h-4 mr-1 ${playingAudio === problem.id ? 'text-primary animate-pulse' : ''}`} />
                                      듣기
                                    </Button>
                                  )}
                                  
                                  {/* Translation Toggle */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleTranslation(translationKey)}
                                  >
                                    <Lightbulb className={`w-4 h-4 mr-1 ${showTranslation ? 'text-warning' : ''}`} />
                                    번역 보기
                                  </Button>
                                </div>
                              </div>

                              {/* Incorrect Answer Feedback */}
                              {!isCorrect && (
                                <div className="text-sm bg-destructive/5 text-destructive px-3 py-2 rounded-md inline-block">
                                  <span className="font-medium mr-2">내 답안:</span>
                                  <span className="line-through opacity-80">{userAnswer?.answer || '(입력 없음)'}</span>
                                </div>
                              )}
                              
                              {/* Translation Display */}
                              {showTranslation && (
                                <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg animate-in slide-in-from-top-1 fade-in duration-200">
                                  {problem.translation}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 mb-20 text-center space-y-4">
            <Link to="/dashboard">
              <Button className="w-full sm:w-auto min-w-[200px] h-12 text-lg shadow-lg hover:shadow-xl transition-all" size="lg">
                새 퀴즈 풀기 ✨
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
