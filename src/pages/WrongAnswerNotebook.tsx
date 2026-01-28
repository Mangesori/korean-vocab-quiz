import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Search,
  FileX,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface WrongAnswer {
  id: string;
  quiz_title: string;
  word: string;
  correct_answer: string;
  user_answer: string;
  sentence: string;
  translation: string | null;
  completed_at: string;
}

export default function WrongAnswerNotebook() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // quiz_results에서 직접 오답 조회
  const { data: wrongAnswers, isLoading } = useQuery({
    queryKey: ['wrong-answers-from-results', user?.id],
    queryFn: async () => {
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select(`
          id,
          answers,
          completed_at,
          quizzes (
            id,
            title
          )
        `)
        .eq('student_id', user!.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      const wrongAnswersList: WrongAnswer[] = [];

      results?.forEach((result: any) => {
        const answers = result.answers as any[];
        answers?.forEach((answer: any) => {
          if (!answer.isCorrect) {
            wrongAnswersList.push({
              id: `${result.id}-${answer.problemId}`,
              quiz_title: result.quizzes?.title || '퀴즈',
              word: answer.word || answer.correctAnswer,
              correct_answer: answer.correctAnswer,
              user_answer: answer.userAnswer || '',
              sentence: answer.sentence || '',
              translation: answer.translation || null,
              completed_at: result.completed_at,
            });
          }
        });
      });

      return wrongAnswersList;
    },
    enabled: !!user?.id,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const filteredWrongAnswers = wrongAnswers?.filter((item) => {
    const matchesSearch =
      item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sentence.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.quiz_title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalCount = wrongAnswers?.length || 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
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

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileX className="h-6 w-6" />
            오답 노트
          </h1>
          <p className="text-muted-foreground mt-1">
            총 {totalCount}개의 오답
          </p>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="단어 또는 퀴즈 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filteredWrongAnswers?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? '검색 결과가 없습니다.'
                  : '아직 오답이 없습니다. 퀴즈를 풀어보세요!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredWrongAnswers?.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                        {item.word}
                      </span>
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        {item.quiz_title}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.completed_at), 'M월 d일', { locale: ko })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 문장 섹션 */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">문장</p>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-base leading-relaxed">
                        {(() => {
                          const parts = item.sentence.split(/\(\s*\)|\(\)/);
                          if (parts.length < 2) return item.sentence;
                          return (
                            <span>
                              {parts.map((part, idx) => (
                                <span key={idx}>
                                  {part}
                                  {idx < parts.length - 1 && (
                                    <span className="text-success font-bold mx-1">
                                      {item.correct_answer}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* 정답 / 내 답 섹션 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">정답</p>
                      <p className="px-3 py-2 rounded-md bg-muted/30 text-sm font-medium text-success">
                        {item.correct_answer}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">내 답</p>
                      <p className="px-3 py-2 rounded-md bg-muted/30 text-sm font-medium text-destructive">
                        {item.user_answer || '(입력 없음)'}
                      </p>
                    </div>
                  </div>

                  {/* 번역 섹션 */}
                  {item.translation && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">번역</p>
                      <p className="px-3 py-2 rounded-md bg-muted/30 text-sm">
                        {item.translation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <MobileBottomNav />
    </div>
  );
}
