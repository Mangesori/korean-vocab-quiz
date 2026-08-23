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
  batch_label: string | null;
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

const STEPS = ['학생', '단어', '유형·설정'];

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
  // 배치별 필터 — "이번에 새로 추가한 단어들만" 같은 요청에 대응한다.
  // 'all'이면 배치 구분 없이 이 레벨의 모든 단어를 보여준다.
  const [batchFilter, setBatchFilter] = useState<string>('all');
  // 복습 큐 바로 추가 — 하루 몇 개씩 노출할지(Anki식 신규 카드 드립).
  const [perDay, setPerDay] = useState(20);

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

  // 선택된 학생들에게 "어휘 보강 퀴즈"로 이미 보낸 단어 — 두 번째 보강을 만들 때
  // 같은 단어를 또 고르지 않도록 목록에서 아예 뺀다. 이 기능(개인 배정 + 제목에
  // "어휘 보강" 포함)으로 나간 것만 본다 — 오답 복습 퀴즈 등 다른 개인 배정은 제외.
  const { data: alreadySentWords } = useQuery({
    queryKey: ['vocab-practice-sent-words', selectedStudents],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_assignments')
        .select('student_id, quizzes!inner(words, kind)')
        .in('student_id', selectedStudents)
        .is('class_id', null)
        .eq('quizzes.kind', 'vocab_practice');
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((row) => {
        (row.quizzes?.words ?? []).forEach((w: string) => set.add(w));
      });
      return set;
    },
    enabled: selectedStudents.length > 0,
  });

  // 이 레벨에 있는 배치 라벨 목록(필터 드롭다운용). 라벨 없는 행(기존 100단어 등)도
  // 섞여 있을 수 있어 '(배치 없음)'을 별도 옵션으로 둔다.
  const availableBatches = useMemo(() => {
    const set = new Set((bankRows ?? []).map((r) => r.batch_label).filter((b): b is string => !!b));
    return [...set].sort();
  }, [bankRows]);
  const hasUnlabeled = useMemo(
    () => (bankRows ?? []).some((r) => !r.batch_label),
    [bankRows]
  );

  // 배치 필터가 걸리면 그 배치(또는 '배치 없음')에 속한 행만 대상으로 삼는다.
  const filteredBankRows = useMemo(() => {
    if (batchFilter === 'all') return bankRows ?? [];
    if (batchFilter === '__none__') return (bankRows ?? []).filter((r) => !r.batch_label);
    return (bankRows ?? []).filter((r) => r.batch_label === batchFilter);
  }, [bankRows, batchFilter]);

  // 단어별 대표 문장 1개 — seq가 가장 작은 행, 동률이면 source==='import' 우선.
  const repByWord = useMemo(() => {
    const map = new Map<string, SentenceBankRow>();
    filteredBankRows.forEach((row) => {
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
  }, [filteredBankRows]);

  const availableWords = useMemo(
    () => [...repByWord.keys()].filter((w) => !alreadySentWords?.has(w)),
    [repByWord, alreadySentWords]
  );

  // 체크된 단어를 목록 맨 위로 올려서 스크롤 없이 바로 보이게 한다.
  const orderedWords = useMemo(() => {
    const selectedSet = new Set(selectedWords);
    const selected = availableWords.filter((w) => selectedSet.has(w));
    const rest = availableWords.filter((w) => !selectedSet.has(w));
    return [...selected, ...rest];
  }, [availableWords, selectedWords]);

  // 레벨이 바뀌면 배치 필터를 초기화한다 — 다른 레벨엔 그 배치 라벨이 없을 수 있다.
  useEffect(() => {
    setBatchFilter('all');
  }, [level]);

  // 레벨/배치 필터가 바뀌거나(재조회) 그 조건의 은행 데이터가 막 도착했을 때
  // wordCount개를 자동으로 미리 체크한다. wordCount는 일부러 의존성에서 뺐다 —
  // 개수만 바꿀 땐 "다시 뽑기"를 눌러야 다시 섞이고, 입력 중에 매번 재선택되면
  // 안 되기 때문이다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelectedWords(shuffle(availableWords).slice(0, wordCount));
  }, [level, bankRows, batchFilter]);

  const rollRandom = () => {
    setSelectedWords(shuffle(availableWords).slice(0, Math.min(wordCount, availableWords.length)));
  };

  const toggleWord = (word: string) => {
    setSelectedWords((prev) => (prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]));
  };

  // 지금 보이는(필터된) 단어 전체를 선택/해제. 다른 배치에서 이미 골라 둔 단어는
  // 건드리지 않는다 — 배치를 바꿔가며 여러 배치에서 조금씩 고르는 흐름을 지원한다.
  const allVisibleSelected = availableWords.length > 0 && availableWords.every((w) => selectedWords.includes(w));
  const toggleAllVisibleWords = () => {
    setSelectedWords((prev) => {
      if (allVisibleSelected) {
        const visible = new Set(availableWords);
        return prev.filter((w) => !visible.has(w));
      }
      const merged = new Set(prev);
      availableWords.forEach((w) => merged.add(w));
      return [...merged];
    });
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
        source: 'imported',
        kind: 'vocab_practice',
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

  // 퀴즈를 만들지 않고, 고른 단어를 학생의 오답 복습 큐(wrong_answer_progress)에 바로
  // 시딩한다. 하루 perDay개씩 due_at을 분산시켜 "오늘의 복습"에서 Anki처럼 조금씩
  // 새 단어가 나오게 한다. 여러 학생이 선택돼 있으면 학생마다 RPC를 순차 호출한다.
  const seedReviewMutation = useMutation({
    mutationFn: async () => {
      const words = selectedWords
        .map((w) => repByWord.get(w))
        .filter((r): r is SentenceBankRow => !!r)
        .map((r) => ({ word: r.word, level: r.level }));

      if (words.length === 0) throw new Error('선택한 단어가 없어요');

      let totalSeeded = 0;
      let totalSkipped = 0;
      const failedStudents: string[] = [];

      for (const studentId of selectedStudents) {
        const { data, error } = await supabase.rpc('seed_review_words', {
          _student_id: studentId,
          _words: words,
          _per_day: perDay,
        });
        if (error) {
          console.error('Failed to seed review words:', studentId, error);
          failedStudents.push(studentNameById.get(studentId) ?? studentId);
          continue;
        }
        const result = data as { seeded?: string[]; skipped?: string[] } | null;
        totalSeeded += result?.seeded?.length ?? 0;
        totalSkipped += result?.skipped?.length ?? 0;
      }

      return { totalSeeded, totalSkipped, failedStudents };
    },
    onSuccess: ({ totalSeeded, totalSkipped, failedStudents }) => {
      const parts = [`${totalSeeded}개 단어를 오늘부터 하루 ${perDay}개씩 추가했어요.`];
      if (totalSkipped > 0) parts.push(`${totalSkipped}개는 이미 복습 중이라 건너뛰었어요.`);
      if (failedStudents.length > 0) {
        toast.warning(`${parts.join(' ')} (실패: ${failedStudents.join(', ')})`);
      } else {
        toast.success(parts.join(' '));
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '복습 큐에 추가하지 못했어요');
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
        <div className="flex items-center gap-2.5 mb-8">
          {STEPS.map((label, idx) => {
            const stepNumber = idx + 1;
            const done = step > stepNumber;
            const current = step === stepNumber;
            return (
              <div key={label} className="flex items-center gap-2.5">
                {idx > 0 && <ChevronRight className="h-[13px] w-[13px] text-[#C4BDB6]" />}
                <div className={`flex items-center gap-2 ${!done && !current ? 'opacity-45' : ''}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11.5px] font-bold shrink-0 ${
                      done || current ? 'bg-primary text-white' : 'border-[1.5px] border-[#C4BDB6] text-[#8A837D]'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                  </div>
                  <span
                    className={`hidden sm:inline text-[13px] ${
                      done ? 'font-semibold text-primary' : current ? 'font-bold' : 'font-semibold text-[#6B6460]'
                    }`}
                  >
                    {label}
                  </span>
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
                학생
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

        {/* Step 2: 단어 */}
        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* 1. 헤더 */}
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-base font-bold">보강할 단어</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedClassName && `${selectedClassName} · `}학생 {selectedStudents.length}명 · {selectedWords.length}개 선택됨
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground shrink-0">
                  {availableWords.length}개 중
                </span>
              </div>

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

              {/* 2. 컨트롤 줄 */}
              <div className="flex items-end gap-3 pt-2 border-t flex-wrap">
                <div className="space-y-1.5">
                  <Label htmlFor="wordCount">문제 개수</Label>
                  <Input
                    id="wordCount"
                    type="number"
                    min={1}
                    value={wordCount}
                    onChange={(e) => setWordCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 rounded-[9px]"
                  />
                </div>
                <Button type="button" variant="outline" className="gap-1.5 rounded-[9px]" onClick={rollRandom}>
                  <Shuffle className="h-4 w-4" />
                  다시 뽑기
                </Button>
                {(availableBatches.length > 0 || hasUnlabeled) && (
                  <div className="space-y-1.5">
                    <Label>배치 필터</Label>
                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                      <SelectTrigger className="w-[220px] rounded-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 배치</SelectItem>
                        {availableBatches.map((label) => (
                          <SelectItem key={label} value={label}>{label}</SelectItem>
                        ))}
                        {hasUnlabeled && <SelectItem value="__none__">(배치 없음)</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* 3. 안내 스트립 */}
              {!!alreadySentWords?.size && (
                <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#EBE5DE] rounded-[10px] px-3.5 py-2.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#6B6460] shrink-0" />
                  <span className="text-[11.5px] text-[#6B6460]">
                    이 학생에게 이미 보낸 어휘 보강 단어는 목록에서 제외했어요 ({alreadySentWords.size}개)
                  </span>
                </div>
              )}

              {bankLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableWords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  이 레벨의 문장 은행에 단어가 없어요.
                </p>
              ) : (
                <div className="rounded-[13px] border overflow-hidden">
                  {/* 4. 목록 헤더 — 전체 선택/해제 */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisibleWords} />
                    <span className="text-xs font-semibold text-muted-foreground">
                      전체 선택 / 해제 ({batchFilter === 'all' ? '전체' : '이 배치'} {availableWords.length}개)
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y">
                    {orderedWords.map((word) => {
                      const row = repByWord.get(word)!;
                      return (
                        <div
                          key={word}
                          className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40"
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
                </div>
              )}

              {/* 5. 하단 */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {selectedWords.length}개 선택됨 · 전체 {availableWords.length}개 중
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-[11px] border-[#E3DCD3] text-[#4A443F]"
                    onClick={() => setStep(1)}
                  >
                    이전
                  </Button>
                  <Button className="rounded-[11px]" onClick={goToStep3} disabled={selectedWords.length === 0}>
                    다음 · 유형·설정으로
                  </Button>
                </div>
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
                유형·설정
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

              {/* 퀴즈로 만들지 않고 복습 큐에 바로 시딩 — 생성이 아니라 적재라 성격이 달라 여기로 옮김 */}
              <div className="flex items-end gap-3 pt-3 border-t flex-wrap">
                <div className="space-y-1.5">
                  <Label htmlFor="perDay">하루 노출 개수</Label>
                  <Input
                    id="perDay"
                    type="number"
                    min={1}
                    value={perDay}
                    onChange={(e) => setPerDay(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={selectedWords.length === 0 || selectedStudents.length === 0 || seedReviewMutation.isPending}
                  onClick={() => seedReviewMutation.mutate()}
                >
                  {seedReviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  복습 큐에 바로 추가(하루 {perDay}개씩)
                </Button>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="rounded-[11px] border-[#E3DCD3] text-[#4A443F]"
                  onClick={() => setStep(2)}
                >
                  이전
                </Button>
                <Button
                  className="rounded-[11px]"
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
