import { useState, useMemo } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  FileX,
  ArrowLeft,
  Play,
  X,
  ListChecks,
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
  audio_url: string | null;
  completed_at: string;
}

export default function WrongAnswerNotebook() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [quizFilter, setQuizFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

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
              audio_url: answer.audioUrl || null,
              completed_at: result.completed_at,
            });
          }
        });
      });

      return wrongAnswersList;
    },
    enabled: !!user?.id,
  });

  // 퀴즈 목록 추출 - hooks must be before any conditional returns
  const quizTitles = useMemo(() => {
    const titles = new Set<string>();
    wrongAnswers?.forEach((item) => titles.add(item.quiz_title));
    return Array.from(titles);
  }, [wrongAnswers]);

  // 필터링
  const filteredWrongAnswers = useMemo(() => {
    return wrongAnswers?.filter((item) => {
      const matchesSearch =
        item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sentence.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.quiz_title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesQuiz = quizFilter === 'all' || item.quiz_title === quizFilter;
      return matchesSearch && matchesQuiz;
    });
  }, [wrongAnswers, searchTerm, quizFilter]);

  const totalCount = wrongAnswers?.length || 0;

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

  // 선택 토글
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (!filteredWrongAnswers) return;
    if (selectedIds.size === filteredWrongAnswers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWrongAnswers.map((item) => item.id)));
    }
  };

  // 선택 모드 진입
  const enterSelectionMode = () => {
    setIsSelectionMode(true);
  };

  // 선택 모드 종료
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // 연습 퀴즈 시작
  const startPracticeQuiz = () => {
    const selectedProblems = wrongAnswers?.filter((item) => selectedIds.has(item.id));
    if (!selectedProblems || selectedProblems.length === 0) return;

    localStorage.setItem('practice_problems', JSON.stringify(selectedProblems));
    navigate('/wrong-answers/practice');
  };

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

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="단어 또는 퀴즈 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={quizFilter} onValueChange={setQuizFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="퀴즈 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 퀴즈</SelectItem>
              {quizTitles.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={toggleSelectAll}
                className="whitespace-nowrap"
              >
                {selectedIds.size === filteredWrongAnswers?.length && filteredWrongAnswers?.length > 0
                  ? '전체 해제'
                  : '전체 선택'}
              </Button>
              <Button
                variant="ghost"
                onClick={exitSelectionMode}
                className="whitespace-nowrap"
              >
                <X className="h-4 w-4 mr-1" />
                취소
              </Button>
            </>
          ) : (
            <Button
              onClick={enterSelectionMode}
              className="whitespace-nowrap gap-2"
            >
              <ListChecks className="h-4 w-4" />
              오답 퀴즈 만들기
            </Button>
          )}
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
              <Card
                key={item.id}
                className={`overflow-hidden transition-all ${
                  isSelectionMode ? 'cursor-pointer' : ''
                } ${
                  isSelectionMode && selectedIds.has(item.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => isSelectionMode && toggleSelection(item.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {isSelectionMode && (
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
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
                    <div className="rounded-lg border bg-muted/30 px-4 py-2">
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

      {/* 플로팅 바 - 선택 모드일 때 표시 */}
      {isSelectionMode && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto z-50">
          <div className="bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg flex items-center justify-between md:justify-center gap-4">
            <span className="font-medium whitespace-nowrap">
              {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '문제를 선택하세요'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={startPracticeQuiz}
              disabled={selectedIds.size === 0}
              className="gap-2 whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              퀴즈 시작
            </Button>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
