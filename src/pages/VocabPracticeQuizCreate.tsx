/**
 * 어휘 보강 퀴즈 만들기 — 학생의 오답 이력과 무관하게, 선생님이 레벨을 지정해
 * 문장 은행에서 문제를 뽑아 특정 학생(들)에게만 개인 배정하는 퀴즈를 만든다.
 *
 * "오답 복습 퀴즈"(WrongAnswerQuizCreate)와 병행하는 별개 기능이다 — 저건 학생이
 * 실제로 틀린 문제를 모으고, 이건 선생님이 "이 학생은 A2가 부족하다" 같은 판단으로
 * 레벨을 지정해 새로 뽑는다.
 *
 * 저장 로직은 QuizImport.handleSave(퀴즈 모드)와 같은 순서를 따른다: quizzes →
 * quiz_answers → quiz_problems → 유형별 problems 테이블. 마지막으로
 * quiz_assignments에 학생마다 student_id만 넣는다(class_id는 절대 넣지 않는다 —
 * 넣으면 반 전체에 노출되는 버그를 재현한다).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { quizInsertErrorMessage } from '@/lib/supabaseErrors';
import type { TablesInsert, Database } from '@/integrations/supabase/types';
import { buildProblems, type ImportRow } from '@/lib/quiz/importFormat';
import type { BaseStage } from '@/types/quiz';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  ArrowLeft,
  Users,
  BookOpen,
  ChevronRight,
  Settings2,
  Shuffle,
  Check,
  Link2,
  Keyboard,
  Type,
  Magnet,
  PenLine,
  Mic,
  BookMarked,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClassInfo {
  id: string;
  name: string;
}

interface StudentInfo {
  student_id: string;
  name: string;
}

interface SentenceBankRow {
  id: string;
  word: string;
  meaning: string | null;
  level: string;
  seq: number;
  sentence: string;
  answer: string;
  hint: string | null;
  translation: string | null;
  source: string;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const STAGE_CARDS: { key: BaseStage; label: string; desc: string; icon: typeof Link2 }[] = [
  { key: 'matchup', label: '짝 맞추기', desc: '단어 매칭', icon: Link2 },
  { key: 'type_answer', label: '단어 받아쓰기', desc: '뜻 보고 단어 쓰기', icon: Keyboard },
  { key: 'fill_blank', label: '빈칸 채우기', desc: '문장 완성하기', icon: Type },
  { key: 'word_magnet', label: '문장 순서 맞추기', desc: '순서대로 단어 배치', icon: Magnet },
  { key: 'sentence_making', label: '문장 만들기', desc: '단어 보고 문장 쓰기', icon: PenLine },
  { key: 'recording', label: '말하기 연습', desc: '읽거나 듣고 따라 말하기', icon: Mic },
];

const STEPS = ['학생 선택', '레벨·단어', '유형·생성'];

// Fisher-Yates. 순서만 섞으면 되므로 원본 배열은 건드리지 않는다.
function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function VocabPracticeQuizCreate() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();

  const [step, setStep] = useState(1);

  // Step 1 — 학생
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Step 2 — 레벨 + 단어
  const [level, setLevel] = useState<string>('A1');
  const [wordCount, setWordCount] = useState(10);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  // Step 3 — 유형 + 제목
  const [quizTitle, setQuizTitle] = useState('');
  const [stages, setStages] = useState<Record<BaseStage, boolean>>({
    matchup: true,
    type_answer: false,
    fill_blank: true,
    word_magnet: false,
    sentence_making: false,
    recording: false,
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', user!.id);
      if (error) throw error;
      return data as ClassInfo[];
    },
    enabled: !!user?.id && can(PERMISSIONS.CREATE_QUIZ),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students', selectedClassId],
    queryFn: async () => {
      // class_members.student_id와 profiles.user_id는 FK로 직접 안 이어져 있어
      // 조인이 PGRST200으로 깨진다(WrongAnswerQuizCreate에서 이미 겪은 문제) — 두 번 조회.
      const { data: members, error: membersError } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('class_id', selectedClassId);
      if (membersError) throw membersError;

      const studentIds = (members ?? []).map((m) => m.student_id);
      if (studentIds.length === 0) return [] as StudentInfo[];

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', studentIds);
      if (profilesError) throw profilesError;

      const nameByUserId = new Map((profileRows ?? []).map((p) => [p.user_id, p.name]));
      return studentIds.map((id) => ({
        student_id: id,
        name: nameByUserId.get(id) ?? '이름 없음',
      })) as StudentInfo[];
    },
    enabled: !!selectedClassId,
  });

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    (students ?? []).forEach((s) => map.set(s.student_id, s.name));
    return map;
  }, [students]);

  // 문장 은행 — 고른 레벨의 모든 행. 같은 단어가 여러 문장(행)으로 중복될 수 있다.
  const { data: bankRows, isLoading: bankLoading } = useQuery({
    queryKey: ['sentence-bank-by-level', level],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sentence_bank')
        .select('*')
        .eq('level', level)
        .order('word');
      if (error) throw error;
      return data as SentenceBankRow[];
    },
    enabled: !!level,
  });

  // 단어별 대표 문장 1개 — seq가 가장 작은 행, 동률이면 source==='import' 우선.
  const repByWord = useMemo(() => {
    const map = new Map<string, SentenceBankRow>();
    (bankRows ?? []).forEach((row) => {
      const cur = map.get(row.word);
      if (!cur) {
        map.set(row.word, row);
        return;
      }
      const better =
        row.seq < cur.seq || (row.seq === cur.seq && row.source === 'import' && cur.source !== 'import');
      if (better) map.set(row.word, row);
    });
    return map;
  }, [bankRows]);

  const availableWords = useMemo(() => [...repByWord.keys()], [repByWord]);

  // 체크된 단어를 목록 맨 위로 올려서 스크롤 없이 바로 보이게 한다.
  const orderedWords = useMemo(() => {
    const selectedSet = new Set(selectedWords);
    const selected = availableWords.filter((w) => selectedSet.has(w));
    const rest = availableWords.filter((w) => !selectedSet.has(w));
    return [...selected, ...rest];
  }, [availableWords, selectedWords]);

  // 레벨이 바뀌거나(재조회) 그 레벨의 은행 데이터가 막 도착했을 때 wordCount개를
  // 자동으로 미리 체크한다. wordCount는 일부러 의존성에서 뺐다 — 개수만 바꿀 땐
  // "다시 뽑기"를 눌러야 다시 섞이고, 입력 중에 매번 재선택되면 안 되기 때문이다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelectedWords(shuffle(availableWords).slice(0, wordCount));
  }, [level, bankRows]);

  const rollRandom = () => {
    setSelectedWords(shuffle(availableWords).slice(0, Math.min(wordCount, availableWords.length)));
  };

  const toggleWord = (word: string) => {
    setSelectedWords((prev) => (prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]));
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === students?.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students?.map((s) => s.student_id) || []);
    }
  };

  const defaultTitle = useMemo(() => {
    const names = selectedStudents.map((id) => studentNameById.get(id) ?? '학생');
    if (names.length === 0) return `${level} 어휘 보강`;
    if (names.length === 1) return `${level} 어휘 보강 — ${names[0]}`;
    return `${level} 어휘 보강 — ${names[0]} 외 ${names.length - 1}명`;
  }, [level, selectedStudents, studentNameById]);

  const goToStep3 = () => {
    if (!quizTitle.trim()) setQuizTitle(defaultTitle);
    setStep(3);
  };

  const anyStage = Object.values(stages).some(Boolean);
  const canSave = selectedStudents.length > 0 && selectedWords.length > 0 && anyStage;

  const createQuizMutation = useMutation({
    mutationFn: async () => {
      const rows: ImportRow[] = selectedWords
        .map((w) => repByWord.get(w))
        .filter((r): r is SentenceBankRow => !!r)
        .map((r) => ({
          word: r.word,
          meaning: r.meaning ?? '',
          level: r.level,
          sentence: r.sentence,
          answer: r.answer,
          hint: r.hint ?? '',
          translation: r.translation ?? '',
        }));

      if (rows.length === 0) throw new Error('선택한 단어가 없어요');
      if (!anyStage) throw new Error('퀴즈 유형을 최소 하나 선택해 주세요');

      const built = buildProblems(rows, { level, perWordLimit: 1 });
      if (built.problems.length === 0) throw new Error('문제를 만들 수 없어요');

      const title = quizTitle.trim() || defaultTitle;

      const quizInsert: Record<string, unknown> = {
        title,
        words: built.words,
        difficulty: level as Database['public']['Enums']['difficulty_level'],
        translation_language: 'en' as Database['public']['Enums']['translation_language'],
        words_per_set: Math.min(5, built.words.length) || 5,
        timer_seconds: null,
        problems: JSON.parse(JSON.stringify(built.problems)),
        teacher_id: user!.id,
        fill_blank_enabled: stages.fill_blank,
        sentence_making_enabled: stages.sentence_making,
        recording_enabled: stages.recording,
        matchup_enabled: stages.matchup,
        type_answer_enabled: stages.type_answer,
        word_magnet_enabled: stages.word_magnet,
      };

      const { data, error } = await supabase
        .from('quizzes')
        .insert(quizInsert as TablesInsert<'quizzes'>)
        .select()
        .single();
      if (error) throw new Error(quizInsertErrorMessage(error, '퀴즈를 만들지 못했어요'));

      const quizId = data.id;

      // quiz_answers는 필수 — 실패하면 방금 만든 quizzes 행을 되돌린다.
      const { error: answersError } = await supabase.from('quiz_answers').insert(
        built.problems.map((p) => ({
          quiz_id: quizId,
          problem_id: p.id,
          correct_answer: p.answer,
          word: p.word,
        }))
      );
      if (answersError) {
        console.error('Failed to save quiz answers:', answersError);
        await supabase.from('quizzes').delete().eq('id', quizId);
        throw new Error('문제 정보를 저장하지 못했어요');
      }

      const { error: problemsError } = await supabase.from('quiz_problems').insert(
        built.problems.map((p) => ({
          quiz_id: quizId,
          problem_id: p.id,
          word: p.word,
          sentence: p.sentence,
          hint: p.hint || null,
          translation: p.translation || null,
          sentence_audio_url: null,
          hint_audio_url: null,
        }))
      );
      if (problemsError) console.error('Failed to save quiz problems:', problemsError);

      if (stages.matchup && built.matchup.length) {
        const { error: e } = await supabase.from('matchup_problems').insert(
          built.matchup.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            korean_text: p.korean_text,
            meaning_text: p.meaning_text,
            sort_order: i,
          }))
        );
        if (e) console.error('Failed to save matchup problems:', e);
      }

      if (stages.type_answer && built.typeAnswer.length) {
        const { error: e } = await supabase.from('type_answer_problems').insert(
          built.typeAnswer.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            prompt: p.prompt,
            answer: p.answer,
            sort_order: i,
          }))
        );
        if (e) console.error('Failed to save type answer problems:', e);
      }

      if (stages.word_magnet && built.wordMagnet.length) {
        const { error: e } = await supabase.from('word_magnet_problems').insert(
          built.wordMagnet.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            base_text: p.base_text,
            translation: p.translation || null,
            items: p.items,
            sort_order: i,
          })) as unknown as Database['public']['Tables']['word_magnet_problems']['Insert'][]
        );
        if (e) console.error('Failed to save word magnet problems:', e);
      }

      if (stages.sentence_making && built.sentenceMaking.length) {
        const { error: e } = await supabase.from('sentence_making_problems').insert(
          built.sentenceMaking.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            word: p.word,
            word_meaning: p.word_meaning || null,
            model_answer: p.model_answer,
            sort_order: i,
          }))
        );
        if (e) console.error('Failed to save sentence making problems:', e);
      }

      if (stages.recording && built.recording.length) {
        const { error: e } = await supabase.from('recording_problems').insert(
          built.recording.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            sentence: p.sentence,
            mode: p.mode,
            translation: p.translation || null,
            source_type: 'reuse' as const,
            sort_order: i,
            label: null,
          }))
        );
        if (e) console.error('Failed to save recording problems:', e);
      }

      // ── 개인 배정 ── class_id는 절대 넣지 않는다. 넣으면 반 전체에 노출된다.
      let assignFailed = false;
      const assignRows: TablesInsert<'quiz_assignments'>[] = selectedStudents.map((studentId) => ({
        quiz_id: quizId,
        student_id: studentId,
      }));
      const { error: assignError } = await supabase.from('quiz_assignments').insert(assignRows);
      if (assignError) {
        console.error('Failed to assign vocab practice quiz:', assignError);
        assignFailed = true;
      }

      return { quizId, wordCount: built.words.length, assignFailed };
    },
    onSuccess: ({ quizId, wordCount, assignFailed }) => {
      if (assignFailed) {
        toast.warning('퀴즈는 만들었지만 학생 배정에 실패했어요');
      } else {
        toast.success(`어휘 보강 퀴즈를 만들었어요 (단어 ${wordCount}개 · 학생 ${selectedStudents.length}명)`);
      }
      navigate(`/quiz/${quizId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '퀴즈를 만들지 못했어요');
    },
  });

  if (authLoading || classesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!can(PERMISSIONS.CREATE_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectedClassName = classes?.find((c) => c.id === selectedClassId)?.name ?? '';

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookMarked className="h-6 w-6" />
            어휘 보강 퀴즈 만들기
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            레벨을 지정해 문장 은행에서 문제를 뽑아 특정 학생에게만 보내요.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, idx) => {
            const stepNumber = idx + 1;
            const reached = step >= stepNumber;
            const done = step > stepNumber;
            return (
              <div key={label} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div
                  className={`flex items-center gap-2 ${
                    reached ? 'text-primary' : 'text-muted-foreground'
                  } ${step === stepNumber ? 'font-bold' : 'font-semibold'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      reached ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : stepNumber}
                  </div>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 1: 학생 선택 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                학생 선택
              </CardTitle>
              <CardDescription>퀴즈를 받을 클래스와 학생을 고르세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>클래스</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={(v) => {
                    setSelectedClassId(v);
                    setSelectedStudents([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="클래스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClassId && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label>학생 ({selectedStudents.length}명 선택됨)</Label>
                  </div>
                  {studentsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : students?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">등록된 학생이 없습니다.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Checkbox
                          checked={selectedStudents.length === students?.length}
                          onCheckedChange={toggleAllStudents}
                        />
                        <Label>전체 선택</Label>
                      </div>
                      <div className="grid gap-2 max-h-64 overflow-y-auto">
                        {students?.map((student) => (
                          <div
                            key={student.student_id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted"
                          >
                            <Checkbox
                              checked={selectedStudents.includes(student.student_id)}
                              onCheckedChange={() => toggleStudentSelection(student.student_id)}
                            />
                            <Label>{student.name}</Label>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={selectedStudents.length === 0}>
                  다음 · 레벨·단어로
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: 레벨 + 단어 선택 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                레벨·단어
              </CardTitle>
              <CardDescription>
                {selectedClassName && `${selectedClassName} · `}학생 {selectedStudents.length}명 ·{' '}
                {selectedWords.length}개 단어 선택됨
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>레벨</Label>
                <div className="grid grid-cols-6 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`py-2.5 rounded-full border-2 font-bold text-sm transition-all ${
                        level === l
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="wordCount">문제 개수</Label>
                  <Input
                    id="wordCount"
                    type="number"
                    min={1}
                    value={wordCount}
                    onChange={(e) => setWordCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24"
                  />
                </div>
                <Button type="button" variant="outline" className="gap-1.5" onClick={rollRandom}>
                  <Shuffle className="h-4 w-4" />
                  다시 뽑기
                </Button>
              </div>

              {bankLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableWords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  이 레벨의 문장 은행에 단어가 없어요.
                </p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {orderedWords.map((word) => {
                    const row = repByWord.get(word)!;
                    return (
                      <div
                        key={word}
                        className="flex items-start gap-3 p-2 rounded hover:bg-muted"
                      >
                        <Checkbox
                          className="mt-1"
                          checked={selectedWords.includes(word)}
                          onCheckedChange={() => toggleWord(word)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-sm">{word}</span>
                            {row.meaning && (
                              <span className="text-xs text-muted-foreground">{row.meaning}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{row.sentence}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  이전
                </Button>
                <Button onClick={goToStep3} disabled={selectedWords.length === 0}>
                  다음 · 유형·생성으로
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: 유형 + 제목 + 생성 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                유형·생성
              </CardTitle>
              <CardDescription>단어 {selectedWords.length}개로 만들 퀴즈를 설정하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">퀴즈 제목</Label>
                <Input
                  id="title"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder={defaultTitle}
                />
              </div>

              <div className="space-y-2">
                <Label>퀴즈 유형</Label>
                <div className="grid grid-cols-2 gap-3">
                  {STAGE_CARDS.map(({ key, label, desc, icon: Icon }) => {
                    const on = stages[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStages((s) => ({ ...s, [key]: !s[key] }))}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          on ? 'border-primary bg-accent' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {on && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="font-bold text-sm text-foreground">{label}</span>
                        </div>
                        <div className={`text-xs ${on ? 'text-primary' : 'text-muted-foreground'}`}>
                          {desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!anyStage && (
                  <p className="text-xs text-destructive">퀴즈 유형을 하나 이상 골라 주세요.</p>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  이전
                </Button>
                <Button
                  onClick={() => createQuizMutation.mutate()}
                  disabled={!canSave || createQuizMutation.isPending}
                >
                  {createQuizMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  퀴즈 만들기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
