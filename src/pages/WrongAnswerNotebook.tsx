import { useState, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateShort } from '@/lib/formatDate';
import {
  Loader2,
  Search,
  FileX,
  ArrowLeft,
  Play,
  X,
  ListChecks,
  ChevronDown,
} from 'lucide-react';

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

// 그룹별로 모으는 문장 단위 항목 (문장마다 정답/내 답/번역이 다를 수 있음)
interface GroupedSentence {
  raw: string;
  answer: string;
  user_answer: string;
  translation: string | null;
}

type GroupedItem = WrongAnswer & {
  count: number;
  sentences: GroupedSentence[];
};

// 문장의 빈칸 ( ) 을 정답으로 채워 초록 강조한 조각을 만든다.
function renderSentence(raw: string, answer: string) {
  const parts = raw.split(/\(\s*\)|\(\)/);
  if (parts.length < 2) return raw;
  return (
    <span>
      {parts.map((part, idx) => (
        <span key={idx}>
          {part}
          {idx < parts.length - 1 && (
            <span className="text-success font-bold">{answer}</span>
          )}
        </span>
      ))}
    </span>
  );
}

export default function WrongAnswerNotebook() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [quizFilter, setQuizFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showMastered, setShowMastered] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 통합 RPC로 오답 조회 (최신순으로 이미 정렬돼 옴)
  const { data: wrongAnswers, isLoading } = useQuery({
    queryKey: ['wrong-answers-unified', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_student_wrong_answers', {
        _student_id: user!.id,
      });

      if (error) throw error;

      const rows = (data ?? []) as any[];
      const wrongAnswersList: WrongAnswer[] = rows.map((row: any, idx: number) => ({
        id: `${row.source}-${idx}`,
        quiz_title: row.quiz_title || '퀴즈',
        word: row.word || row.correct_answer,
        correct_answer: row.correct_answer,
        user_answer: row.user_answer || '',
        sentence: row.sentence || '',
        translation: row.translation ?? null,
        audio_url: row.audio_url ?? null,
        completed_at: row.completed_at ?? '',
      }));

      return wrongAnswersList;
    },
    enabled: !!user?.id,
  });

  // 졸업(마스터)한 단어 조회
  const { data: masteredRows } = useQuery({
    queryKey: ['wa-mastered', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('wrong_answer_progress')
        .select('word, mastered_at')
        .eq('student_id', user!.id)
        .not('mastered_at', 'is', null);
      return data ?? [];
    },
  });

  const masteredWords = useMemo(
    () => new Set((masteredRows ?? []).map((r: any) => r.word)),
    [masteredRows]
  );

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

  // 단어별 그룹화 + 틀린 횟수 집계 + 문장 목록 수집 (자주 틀린 순 정렬)
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedItem>();
    filteredWrongAnswers?.forEach((item) => {
      const ex = map.get(item.word);
      const sentenceKey = `${item.sentence}|${item.correct_answer}`;
      if (ex) {
        ex.count++;
        // 대표 항목은 가장 최근에 틀린 것으로 유지 (sentences 는 보존)
        if (item.completed_at > ex.completed_at) {
          const keepSentences = ex.sentences;
          Object.assign(ex, item, { count: ex.count, sentences: keepSentences });
        }
        // 문장 dedup 후 추가
        if (item.sentence && !ex.sentences.some((s) => `${s.raw}|${s.answer}` === sentenceKey)) {
          ex.sentences.push({
            raw: item.sentence,
            answer: item.correct_answer,
            user_answer: item.user_answer,
            translation: item.translation,
          });
        }
      } else {
        map.set(item.word, {
          ...item,
          count: 1,
          sentences: item.sentence
            ? [{
                raw: item.sentence,
                answer: item.correct_answer,
                user_answer: item.user_answer,
                translation: item.translation,
              }]
            : [],
        });
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [filteredWrongAnswers]);

  // 졸업 단어 숨김/표시 처리
  const masteredCount = useMemo(
    () => grouped.filter((g) => masteredWords.has(g.word)).length,
    [grouped, masteredWords]
  );
  const visibleGroups = useMemo(
    () => (showMastered ? grouped : grouped.filter((g) => !masteredWords.has(g.word))),
    [grouped, masteredWords, showMastered]
  );

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

  // 펼침 토글 (다중 오픈 허용)
  const toggleExpand = (word: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  // 선택 토글
  const toggleSelection = (word: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  // 전체 선택/해제 (단어 단위, 화면에 보이는 그룹 기준)
  const toggleSelectAll = () => {
    if (visibleGroups.length === 0) return;
    if (selectedIds.size === visibleGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleGroups.map((item) => item.word)));
    }
  };

  const enterSelectionMode = () => setIsSelectionMode(true);
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // 연습 퀴즈 시작 (선택된 단어의 대표 항목을 PracticeProblem 형식으로 직렬화)
  const startPracticeQuiz = () => {
    const selectedGroups = visibleGroups.filter((g) => selectedIds.has(g.word));
    if (selectedGroups.length === 0) return;

    const practiceProblems = selectedGroups.map((g) => ({
      id: g.id,
      word: g.word,
      correct_answer: g.correct_answer,
      sentence: g.sentence,
      translation: g.translation,
      audio_url: g.audio_url,
    }));

    localStorage.setItem('practice_problems', JSON.stringify(practiceProblems));
    navigate('/wrong-answers/practice');
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/dashboard'))}
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileX className="h-6 w-6" />
            오답 노트
          </h1>
          <p className="text-muted-foreground mt-1">총 {totalCount}개의 오답</p>
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
              <Button variant="outline" onClick={toggleSelectAll} className="whitespace-nowrap">
                {selectedIds.size === visibleGroups.length && visibleGroups.length > 0
                  ? '전체 해제'
                  : '전체 선택'}
              </Button>
              <Button variant="ghost" onClick={exitSelectionMode} className="whitespace-nowrap">
                <X className="h-4 w-4 mr-1" />
                취소
              </Button>
            </>
          ) : (
            <Button onClick={enterSelectionMode} className="whitespace-nowrap gap-2">
              <ListChecks className="h-4 w-4" />
              오답 퀴즈 만들기
            </Button>
          )}
        </div>

        {masteredCount > 0 && (
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setShowMastered((v) => !v)}>
              🎓 졸업한 단어 {masteredCount}개 {showMastered ? '숨기기' : '보기'}
            </Button>
          </div>
        )}

        {visibleGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? '검색 결과가 없습니다.' : '아직 오답이 없습니다. 퀴즈를 풀어보세요!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map((item) => {
              const isMastered = masteredWords.has(item.word);
              const isExpanded = expanded.has(item.word);
              const isSelected = selectedIds.has(item.word);
              return (
                <div
                  key={item.word}
                  className={`rounded-lg border bg-card overflow-hidden transition-all ${
                    isSelectionMode && isSelected ? 'ring-2 ring-primary' : ''
                  } ${isMastered ? 'opacity-60' : ''}`}
                >
                  {/* 닫힘(헤더) 한 줄 */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() =>
                      isSelectionMode ? toggleSelection(item.word) : toggleExpand(item.word)
                    }
                  >
                    {isSelectionMode && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(item.word)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                      {item.word}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {item.quiz_title}
                    </span>
                    {item.count > 1 && (
                      <span className="text-xs font-medium text-destructive shrink-0">
                        ●{item.count}회
                      </span>
                    )}
                    {isMastered && <span className="text-xs shrink-0">🎓</span>}
                    <span className="ml-auto text-xs text-muted-foreground shrink-0 tabular-nums">
                      {formatDateShort(item.completed_at)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.word);
                      }}
                      className="shrink-0 flex items-center justify-center h-8 w-8 -mr-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                      aria-label={isExpanded ? '접기' : '펼치기'}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* 펼침(상세) — 문장별: 문장 → 번역 → 내 답변 */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-3">
                      {item.sentences.map((s, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <p className="text-sm leading-relaxed">
                            {renderSentence(s.raw, s.answer)}
                          </p>
                          {s.translation && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {s.translation}
                            </p>
                          )}
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[11px] font-semibold">
                              내 답변
                            </span>
                            <span className="text-xs text-destructive font-medium">
                              {s.user_answer || '(입력 없음)'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 플로팅 바 - 선택 모드일 때 표시 */}
      {isSelectionMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50">
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
    </div>
  );
}
