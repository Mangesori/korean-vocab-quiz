import { useState, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateShort } from '@/lib/formatDate';
import { STAGE_LABELS, type BaseStage } from '@/types/quiz';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  FileX,
  ArrowLeft,
  Play,
  X,
  ListChecks,
  ChevronDown,
  HelpCircle,
  BookMarked,
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
  source: string;
}

// get_student_wrong_answers RPC가 jsonb 배열로 돌려주는 행 모양.
// 유형(source)마다 word/correct_answer의 의미가 다르다 —
// matchup: word=한국어 단어, correct_answer=뜻 / word_magnet: word=correct_answer=문장 전체.
interface RpcWrongAnswerRow {
  quiz_title: string | null;
  word: string | null;
  correct_answer: string;
  user_answer: string | null;
  sentence: string | null;
  translation: string | null;
  audio_url: string | null;
  completed_at: string | null;
  source: string | null;
}

// 그룹별로 모으는 오답 단위 항목 (항목마다 유형/정답/내 답/번역이 다를 수 있음)
interface GroupedSentence {
  raw: string;
  answer: string;
  user_answer: string;
  translation: string | null;
  audio_url: string | null;
  source: string;
}

type GroupedItem = WrongAnswer & {
  count: number;
  sentences: GroupedSentence[];
};

// 연습 화면(WrongAnswerPractice)에 localStorage로 넘기는 문항 모양.
// in_word_bank=false 인 문항은 "보기"(word bank)에 노출하지 않는다.
interface PracticeProblem {
  id: string;
  word: string;
  correct_answer: string;
  sentence: string;
  translation: string | null;
  audio_url: string | null;
  source: string;
  in_word_bank?: boolean;
}

// converted=true 면 원래 짝맞추기/문장순서 오답을 받아쓰기 문항으로 바꿔 출제한다는 뜻.
type PracticePlan = { problem: PracticeProblem; converted: boolean } | null;

// 2회 연속 정답이면 마스터 (supabase/migrations/20260710000001_add_wrong_answer_progress.sql)
const MASTER_STREAK = 2;

const BLANK_RE = /\(\s*\)/;

// 문장에 빈칸 ( ) 이 있는지 판정
const hasBlank = (text: string) => BLANK_RE.test(text);

// 받아쓰기 프롬프트로 쓸 문자열에서 빈칸 ( ) 을 제거한다.
// 연습 화면의 hasBlank()가 false여야 빈칸 UI가 아닌 받아쓰기 UI로 렌더되기 때문.
const stripBlanks = (text: string) =>
  text.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();

// 퀴즈 유형(source) → 한국어 라벨. 모르는 유형은 '기타'.
const sourceLabel = (source: string) => STAGE_LABELS[source as BaseStage] ?? '기타';

// 문장의 빈칸 ( ) 을 정답으로 채워 초록 강조한 조각을 만든다.
function renderSentence(raw: string, answer: string) {
  const parts = raw.split(/\(\s*\)/);
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

// 오답 데이터에서 단어장 항목(뜻·예문)을 자동으로 만든다.
function buildVocabularyEntry(item: GroupedItem) {
  // 뜻: 짝맞추기의 정답(meaning_text) → 받아쓰기의 프롬프트(뜻) 순으로 사용
  const matchup = item.sentences.find((s) => s.source === 'matchup' && s.answer.trim());
  const typeAnswer = item.sentences.find((s) => s.source === 'type_answer' && s.raw.trim());
  const meaning = matchup?.answer.trim() || typeAnswer?.raw.trim() || null;

  // 예문: 빈칸 채우기 문장의 빈칸을 정답으로 채워서 → 문장순서의 완성 문장 순으로 사용
  const fill = item.sentences.find((s) => s.source === 'fill_blank' && hasBlank(s.raw));
  const magnet = item.sentences.find((s) => s.source === 'word_magnet' && s.answer.trim());
  const example = fill
    ? fill.raw.replace(BLANK_RE, fill.answer).trim()
    : magnet?.answer.trim() || null;

  return { meaning, example };
}

export default function WrongAnswerNotebook() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, role, roleResolved } = useAuth();
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
      const { data, error } = await supabase.rpc('get_student_wrong_answers', {
        _student_id: user!.id,
      });

      if (error) throw error;

      const rows = (data ?? []) as unknown as RpcWrongAnswerRow[];
      const wrongAnswersList: WrongAnswer[] = rows.map((row, idx) => ({
        id: `${row.source}-${idx}`,
        quiz_title: row.quiz_title || '퀴즈',
        word: row.word || row.correct_answer,
        correct_answer: row.correct_answer,
        user_answer: row.user_answer || '',
        sentence: row.sentence || '',
        translation: row.translation ?? null,
        audio_url: row.audio_url ?? null,
        completed_at: row.completed_at ?? '',
        // source 폴백을 fill_blank로 두면 모르는 유형이 빈칸 채우기로 위장돼
        // 문장 없는 빈칸 문제로 출제된다. 정체 불명은 'unknown'으로 두고 '기타'로 표시.
        source: row.source || 'unknown',
      }));

      return wrongAnswersList;
    },
    enabled: !!user?.id,
  });

  // 오답 연습 진행도 (마스터 여부 + 연속 정답 수)
  const { data: progressRows } = useQuery({
    queryKey: ['wa-progress', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('wrong_answer_progress')
        .select('word, mastered_at, correct_streak')
        .eq('student_id', user!.id);
      return data ?? [];
    },
  });

  const masteredWords = useMemo(
    () => new Set((progressRows ?? []).filter((r) => r.mastered_at).map((r) => r.word)),
    [progressRows]
  );

  // 단어 → 연속 정답 수 (마스터까지 몇 번 남았는지 계산용)
  const streakByWord = useMemo(() => {
    const map = new Map<string, number>();
    (progressRows ?? []).forEach((r) => map.set(r.word, r.correct_streak ?? 0));
    return map;
  }, [progressRows]);

  // 이미 단어장에 담은 단어 (중복 담기 방지)
  const { data: vocabularyWords } = useQuery({
    queryKey: ['vocabulary-words', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('vocabulary_lists')
        .select('word')
        .eq('student_id', user!.id);
      return (data ?? []).map((r) => r.word as string);
    },
  });

  const savedWords = useMemo(() => new Set(vocabularyWords ?? []), [vocabularyWords]);

  const addToVocabulary = useMutation({
    mutationFn: async (item: GroupedItem) => {
      const { meaning, example } = buildVocabularyEntry(item);
      const { error } = await supabase.from('vocabulary_lists').insert({
        student_id: user!.id,
        word: item.word,
        meaning,
        example_sentence: example,
        notes: '오답 노트에서 담은 단어',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-words'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      toast.success('단어장에 담았어요');
    },
    onError: () => {
      toast.error('단어장에 담지 못했어요');
    },
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

  // 단어별 그룹화 + 틀린 횟수 집계 + 문장 목록 수집 (자주 틀린 순 정렬)
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedItem>();
    filteredWrongAnswers?.forEach((item) => {
      const ex = map.get(item.word);
      // 유형+문장+정답으로 dedup (문장이 없는 유형도 정답으로 구분됨)
      const entryKey = `${item.source}|${item.sentence}|${item.correct_answer}`;
      const makeEntry = (): GroupedSentence => ({
        raw: item.sentence,
        answer: item.correct_answer,
        user_answer: item.user_answer,
        translation: item.translation,
        audio_url: item.audio_url,
        source: item.source,
      });
      if (ex) {
        ex.count++;
        // 대표 항목은 가장 최근에 틀린 것으로 유지 (sentences 는 보존)
        if (item.completed_at > ex.completed_at) {
          const keepSentences = ex.sentences;
          Object.assign(ex, item, { count: ex.count, sentences: keepSentences });
        }
        // 항목 dedup 후 추가 (문장 유무와 무관하게 모든 유형 수집)
        if (!ex.sentences.some((s) => `${s.source}|${s.raw}|${s.answer}` === entryKey)) {
          ex.sentences.push(makeEntry());
        }
      } else {
        map.set(item.word, {
          ...item,
          count: 1,
          sentences: [makeEntry()],
        });
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [filteredWrongAnswers]);

  // 단어별 연습 문항 계획.
  // 1) 빈칸/받아쓰기 오답이 있으면 그대로 출제 (converted=false)
  // 2) 없으면 짝맞추기·문장순서 오답을 받아쓰기로 변환해 출제 (converted=true)
  // 3) 둘 다 불가능하면 null (연습 미지원)
  const practicePlans = useMemo(() => {
    const map = new Map<string, PracticePlan>();

    grouped.forEach((g) => {
      // 1) 지원 유형 우선순위: 빈칸 채우기 → 받아쓰기
      const direct =
        g.sentences.find((s) => s.source === 'fill_blank') ??
        g.sentences.find((s) => s.source === 'type_answer');

      if (direct) {
        map.set(g.word, {
          problem: {
            id: g.id,
            word: g.word,
            correct_answer: direct.answer,
            sentence: direct.raw,
            translation: direct.translation,
            audio_url: direct.audio_url,
            source: direct.source,
          },
          converted: false,
        });
        return;
      }

      // 2-a) 짝맞추기 → 받아쓰기. RPC 반환이 word=한국어 단어, correct_answer=뜻이라
      // 둘을 맞바꾸면 "뜻: apple" + 입력 → 정답 "사과" 형태가 된다.
      const matchup = g.sentences.find(
        (s) => s.source === 'matchup' && stripBlanks(s.answer).length > 0
      );
      if (matchup) {
        map.set(g.word, {
          problem: {
            id: g.id,
            word: g.word,
            correct_answer: g.word,
            sentence: stripBlanks(matchup.answer),
            translation: null,
            audio_url: matchup.audio_url,
            source: 'matchup',
          },
          converted: true,
        });
        return;
      }

      // 2-b) 문장순서 → 받아쓰기. word=correct_answer=base_text(문장 전체)이고
      // translation이 프롬프트가 된다. translation이 없으면 프롬프트를 만들 수 없어 제외.
      const magnet = g.sentences.find(
        (s) => s.source === 'word_magnet' && stripBlanks(s.translation ?? '').length > 0
      );
      if (magnet) {
        map.set(g.word, {
          problem: {
            id: g.id,
            word: g.word,
            correct_answer: g.word,
            sentence: stripBlanks(magnet.translation ?? ''),
            translation: null,
            audio_url: null,
            source: 'word_magnet',
            // word가 문장 전체라 보기 배지에 넣으면 정답이 그대로 노출된다.
            in_word_bank: false,
          },
          converted: true,
        });
        return;
      }

      // 3) 연습 미지원
      map.set(g.word, null);
    });

    return map;
  }, [grouped]);

  // 마스터 단어 숨김/표시 처리
  const masteredCount = useMemo(
    () => grouped.filter((g) => masteredWords.has(g.word)).length,
    [grouped, masteredWords]
  );
  const visibleGroups = useMemo(
    () => (showMastered ? grouped : grouped.filter((g) => !masteredWords.has(g.word))),
    [grouped, masteredWords, showMastered]
  );

  // 연습 가능한 그룹만 (전체 선택 대상)
  const selectableGroups = useMemo(
    () => visibleGroups.filter((g) => practicePlans.get(g.word)),
    [visibleGroups, practicePlans]
  );

  const selectedGroups = useMemo(
    () => visibleGroups.filter((g) => selectedIds.has(g.word)),
    [visibleGroups, selectedIds]
  );

  // 선택된 것 중 받아쓰기로 변환되는 개수 (하단 시작 바 안내용)
  const convertedCount = useMemo(
    () => selectedGroups.filter((g) => practicePlans.get(g.word)?.converted).length,
    [selectedGroups, practicePlans]
  );

  const totalCount = wrongAnswers?.length || 0;
  const uniqueWordCount = new Set((wrongAnswers ?? []).map((w) => w.word)).size;

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

  // role은 profiles 조회 결과라 authLoading이 끝난 뒤에도 잠깐 null이다. 그 틈에
  // role !== 'student'로 판단하면 정상적인 학생도 대시보드로 튕긴다(북마크나 새로고침으로
  // 이 URL을 직접 열 때 간헐적으로 발생. 스크린샷 캡처에서 실제로 재현됐다).
  // role이 확정되기 전에는 판단을 보류하고 로딩만 보여준다.
  // (role === null 대신 roleResolved로 본다 — 프로필이 없는 사용자는 무한 로딩 대신
  //  아래의 role !== 'student' 분기를 타고 대시보드로 간다.)
  if (!roleResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'student') {
    return <Navigate to="/dashboard" replace />;
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

  // 선택 토글 (연습 미지원 단어는 선택 불가)
  const toggleSelection = (word: string) => {
    if (!practicePlans.get(word)) return;
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

  // 전체 선택/해제 (단어 단위, 화면에 보이는 그룹 중 연습 가능한 것 기준)
  const toggleSelectAll = () => {
    if (selectableGroups.length === 0) return;
    if (selectedIds.size === selectableGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableGroups.map((item) => item.word)));
    }
  };

  const enterSelectionMode = () => setIsSelectionMode(true);
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // 연습 퀴즈 시작 — 빈칸/받아쓰기는 그대로, 짝맞추기·문장순서는 받아쓰기로 변환해 출제
  const startPracticeQuiz = () => {
    const practiceProblems = selectedGroups
      .map((g) => practicePlans.get(g.word)?.problem)
      .filter((p): p is PracticeProblem => !!p);

    if (practiceProblems.length === 0) {
      toast.info('연습할 수 있는 오답이 없어요');
      return;
    }

    localStorage.setItem('practice_problems', JSON.stringify(practiceProblems));
    navigate('/wrong-answers/practice');
  };

  const allSelected =
    selectableGroups.length > 0 && selectedIds.size === selectableGroups.length;

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
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
          <p className="text-muted-foreground mt-1">
            총 {uniqueWordCount}개 단어 · 오답 {totalCount}회
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
              <Button variant="outline" onClick={toggleSelectAll} className="whitespace-nowrap">
                {allSelected ? '전체 해제' : '전체 선택'}
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

        {isSelectionMode && (
          <p className="text-xs text-muted-foreground mb-4">
            모든 오답을 연습할 수 있어요 — 짝 맞추기·문장 순서는 받아쓰기로 바꿔 출제해요
          </p>
        )}

        {masteredCount > 0 && (
          <div className="mb-4 flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowMastered((v) => !v)}>
              ⭐ 마스터한 단어 {masteredCount}개 {showMastered ? '숨기기' : '보기'}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="마스터 기준 안내"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                연습에서 {MASTER_STREAK}회 연속으로 맞히면 마스터가 돼요
              </TooltipContent>
            </Tooltip>
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
              const plan = practicePlans.get(item.word);
              const canPractice = !!plan;
              const isConverted = !!plan?.converted;
              // 대표 유형 1개 + 나머지 개수 (여러 유형에서 틀린 단어)
              const uniqueSources = new Set(item.sentences.map((s) => s.source));
              const extraSourceCount = uniqueSources.size - 1;
              // 마스터까지 남은 횟수 (연속 정답이 1회 이상 쌓인 단어만 안내)
              const streak = streakByWord.get(item.word) ?? 0;
              const remainingToMaster = MASTER_STREAK - streak;
              const showRemaining =
                !isMastered && streak > 0 && remainingToMaster > 0;
              // 그룹 키가 문장 전체인 문장순서 전용 단어는 단어장에 담지 않는다.
              const isSentenceGroup = item.sentences.every((s) => s.source === 'word_magnet');
              const isSaved = savedWords.has(item.word);

              return (
                <div
                  key={item.word}
                  className={`rounded-lg border bg-card overflow-hidden transition-all ${
                    isSelectionMode && isSelected ? 'ring-2 ring-primary' : ''
                  } ${isMastered ? 'opacity-60' : ''}`}
                >
                  {/* 닫힘(헤더) 한 줄 */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isSelectionMode && !canPractice
                        ? 'cursor-default'
                        : 'cursor-pointer hover:bg-muted/40'
                    }`}
                    onClick={() =>
                      isSelectionMode ? toggleSelection(item.word) : toggleExpand(item.word)
                    }
                  >
                    {isSelectionMode && (
                      <Checkbox
                        checked={isSelected}
                        disabled={!canPractice}
                        onCheckedChange={() => toggleSelection(item.word)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0 max-w-[40%] truncate">
                      {item.word}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium shrink-0">
                      {sourceLabel(item.source)}
                      {extraSourceCount > 0 && ` +${extraSourceCount}`}
                    </span>
                    {isConverted && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                        받아쓰기로 연습
                      </span>
                    )}
                    {!canPractice && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium shrink-0">
                        연습 미지원
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                      {item.quiz_title}
                    </span>
                    {item.count > 1 && (
                      <span className="text-xs font-medium text-destructive shrink-0">
                        ●{item.count}회
                      </span>
                    )}
                    {showRemaining && (
                      <span className="text-[11px] font-medium text-primary shrink-0 hidden sm:inline">
                        마스터까지 {remainingToMaster}번
                      </span>
                    )}
                    {isMastered && <span className="text-xs shrink-0">⭐</span>}
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

                  {/* 펼침(상세) — 문장별: 유형 → 문장 → 번역 → 내 답변 */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-3">
                      {item.sentences.map((s, idx) => {
                        const blank = hasBlank(s.raw);
                        return (
                          <div key={idx} className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                              {sourceLabel(s.source)}
                            </span>
                            {blank ? (
                              // 빈칸 채우기: 문장 안에 정답을 채워 초록 강조
                              <p className="text-sm leading-relaxed">
                                {renderSentence(s.raw, s.answer)}
                              </p>
                            ) : (
                              // 문장이 없는 유형(짝맞추기/문장순서) 또는 프롬프트형(받아쓰기): 정답을 따로 표시
                              <>
                                {s.raw && (
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {s.raw}
                                  </p>
                                )}
                                <p className="text-sm leading-relaxed">
                                  <span className="text-xs text-muted-foreground mr-1.5">정답</span>
                                  <span className="text-success font-bold">{s.answer}</span>
                                </p>
                              </>
                            )}
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
                        );
                      })}

                      {!isSentenceGroup && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isSaved || addToVocabulary.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSaved) {
                                toast.info('이미 단어장에 있어요');
                                return;
                              }
                              addToVocabulary.mutate(item);
                            }}
                          >
                            <BookMarked className="h-4 w-4" />
                            {isSaved ? '단어장에 있어요' : '단어장에 담기'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 플로팅 바 - 선택 모드일 때 표시 */}
      {isSelectionMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg flex items-center justify-between md:justify-center gap-4">
            <span className="font-medium whitespace-nowrap text-sm">
              {selectedGroups.length > 0
                ? `${selectedGroups.length}개 선택됨${
                    convertedCount > 0 ? ` · ${convertedCount}개는 받아쓰기로 변환` : ''
                  }`
                : '문제를 선택하세요'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={startPracticeQuiz}
              disabled={selectedGroups.length === 0}
              className="gap-2 whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              퀴즈 시작
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
