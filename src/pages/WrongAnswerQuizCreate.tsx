import { useState, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { readEdgeFunctionError, isQuotaExceeded, quizInsertErrorMessage } from '@/lib/supabaseErrors';
import type { TablesInsert } from '@/integrations/supabase/types';
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
  STAGE_ENABLED_KEY,
  STAGE_LABELS,
  STAGE_SHORT_LABELS,
  type BaseStage,
  type Problem,
} from '@/types/quiz';
import {
  Loader2,
  ArrowLeft,
  FileX,
  Users,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Settings2,
  Type,
  Keyboard,
  Check,
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

// class_members + profiles 조인 결과 행 (PostgREST 조인은 생성 타입이 중첩을 잘 못 잡아 직접 선언)
interface ClassMemberRow {
  student_id: string;
  profiles: { name: string };
}

// get_class_wrong_answers RPC가 jsonb 배열로 돌려주는 원본 행.
// 유형(source)마다 word/correct_answer/sentence의 의미가 다르다 —
// fill_blank: word=기본형, correct_answer=활용형, sentence=빈칸( ) 포함 문장
// matchup:    word=한국어 단어, correct_answer=뜻, sentence=''
// type_answer: word=correct_answer=한국어 단어, sentence=뜻 프롬프트
// word_magnet: word=correct_answer=문장 전체, sentence=''
interface RpcClassWrongAnswerRow {
  student_id: string | null;
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

// 펼침에서 "누가 뭐라고 답했는지"를 보여주기 위해 원본 행을 그대로 보존한 항목
interface WrongAnswerEntry {
  student_id: string;
  source: string;
  sentence: string;
  correct_answer: string;
  user_answer: string;
  translation: string | null;
  completed_at: string;
}

interface WrongAnswerData {
  word: string;
  // 아래 3개는 "빈칸 채우기 문제로 만들 때 쓸 대표값" — fill_blank 행에서만 채운다.
  // fill_blank 오답이 없는 단어는 sentence가 ''이고 correct_answer는 단어 자신이다.
  correct_answer: string;
  sentence: string;
  translation: string | null;
  count: number;
  students: Set<string>;
  entries: WrongAnswerEntry[];
  sources: Set<string>;
  latest_at: string;
  // 받아쓰기(type_answer) 프롬프트로 쓸 단어 뜻. 짝맞추기/받아쓰기 오답에서만 얻을 수 있다.
  meaning: string | null;
  // 문장 순서 맞추기 전용 그룹은 word가 단어가 아니라 문장 전체라 어휘 퀴즈로 만들 수 없다.
  selectable: boolean;
}

// 펼침 상세 한 덩어리 — 같은 문장/유형에 대해 학생별 답변을 모아 보여준다.
interface DetailBlock {
  source: string;
  sentence: string;
  correct_answer: string;
  translation: string | null;
  answers: { student_id: string; user_answer: string }[];
}

// generate-quiz 엣지 함수 응답 중 이 화면이 쓰는 부분만.
interface GenerateQuizResponse {
  problems?: Problem[];
  typeAnswerProblems?: { problem_id: string; prompt: string; answer: string }[];
}

// get_class_wrong_answers는 아직 src/integrations/supabase/types.ts에 등록돼 있지 않아
// supabase.rpc의 함수명 유니온에 없다. 타입 생성기를 다시 돌리기 전까지 쓰는 우회.
// 반드시 supabase 객체에 붙여서 호출할 것 — rpc()는 내부에서 this.rest를 쓰기 때문에
// 메서드만 떼어내(const rpc = supabase.rpc) 호출하면 런타임에 깨진다.
type UntypedRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const BLANK_RE = /\(\s*\)/;

// 이 화면에서 만들 수 있는 퀴즈 유형.
// 빈칸 채우기는 quizzes.problems JSONB만으로 출제되고, 받아쓰기는 type_answer_problems 행을
// 따로 넣어야 한다. 짝 맞추기·문장 순서 맞추기는 여기서 만들지 않는다(README 참고: 보고 내용).
const QUIZ_TYPES: { stage: Extract<BaseStage, 'fill_blank' | 'type_answer'>; icon: typeof Type; desc: string }[] = [
  { stage: 'fill_blank', icon: Type, desc: '문장 완성하기' },
  { stage: 'type_answer', icon: Keyboard, desc: '뜻 보고 단어 쓰기' },
];

const DIFFICULTY_LEVELS = [
  { level: 'A1', label: '입문' },
  { level: 'A2', label: '기초' },
  { level: 'B1', label: '중급' },
  { level: 'B2', label: '중상급' },
  { level: 'C1', label: '고급' },
  { level: 'C2', label: '최상급' },
] as const;

const TRANSLATION_LANGUAGES = [
  { value: 'en', label: '영어 (English)' },
  { value: 'zh_CN', label: '중국어 간체 (简体中文)' },
  { value: 'zh_TW', label: '중국어 번체 (繁體中文)' },
  { value: 'ja', label: '일본어 (日本語)' },
  { value: 'vi', label: '베트남어 (Tiếng Việt)' },
  { value: 'th', label: '태국어 (ภาษาไทย)' },
  { value: 'id', label: '인도네시아어 (Bahasa Indonesia)' },
  { value: 'es', label: '스페인어 (Español)' },
  { value: 'fr', label: '프랑스어 (Français)' },
  { value: 'de', label: '독일어 (Deutsch)' },
  { value: 'ru', label: '러시아어 (Русский)' },
];

const STEPS = ['대상', '문제 선택', '설정·생성'];

// 퀴즈 유형(source) → 축약 라벨. 모르는 유형은 '기타'.
const sourceLabel = (source: string) => STAGE_SHORT_LABELS[source as BaseStage] ?? '기타';

// 문장의 빈칸 ( ) 을 정답으로 채워 초록 강조한 조각을 만든다. (오답 노트 화면과 동일 규칙)
function renderSentence(raw: string, answer: string) {
  const parts = raw.split(/\(\s*\)/);
  if (parts.length < 2) return raw;
  return (
    <span>
      {parts.map((part, idx) => (
        <span key={idx}>
          {part}
          {idx < parts.length - 1 && <span className="text-success font-bold">{answer}</span>}
        </span>
      ))}
    </span>
  );
}

// 같은 유형+문장+정답끼리 묶고 그 아래에 학생별 답변을 모은다.
function groupEntries(entries: WrongAnswerEntry[]): DetailBlock[] {
  const map = new Map<string, DetailBlock>();
  entries.forEach((e) => {
    const key = `${e.source}|${e.sentence}|${e.correct_answer}`;
    let block = map.get(key);
    if (!block) {
      block = {
        source: e.source,
        sentence: e.sentence,
        correct_answer: e.correct_answer,
        translation: e.translation,
        answers: [],
      };
      map.set(key, block);
    }
    // 같은 학생이 같은 답으로 여러 번 틀린 건 한 줄로 합친다.
    if (!block.answers.some((a) => a.student_id === e.student_id && a.user_answer === e.user_answer)) {
      block.answers.push({ student_id: e.student_id, user_answer: e.user_answer });
    }
  });
  return [...map.values()];
}

// "AI로 새 예문 생성"이 실패해 기존 문장으로 만든 퀴즈에 대해, 예문 생성만 다시 시도한다.
// 퀴즈를 새로 만들지 않고 이미 만든 퀴즈의 problems를 갈아끼운다(중복 생성 방지).
// 토스트 액션은 페이지를 떠난 뒤에 눌리므로 컴포넌트 밖(모듈 스코프)에 둔다.
async function retryRegeneration(
  quizId: string,
  words: string[],
  difficulty: string,
  translationLanguage: string
) {
  const toastId = toast.loading('새 예문 생성 중...');
  try {
    // 이미 저장된 퀴즈의 problems만 갈아끼우므로 새 퀴즈를 만들지 않는다 → 한도 사전 체크 대상 아님.
    const { data, error } = await supabase.functions.invoke<GenerateQuizResponse>('generate-quiz', {
      body: { words, difficulty, translationLanguage, wordsPerSet: 5, purpose: 'regenerate' },
    });
    if (error || !data?.problems?.length) throw error ?? new Error('problems 없음');

    const { error: updateError } = await supabase
      .from('quizzes')
      .update({ problems: JSON.parse(JSON.stringify(data.problems)) })
      .eq('id', quizId);
    if (updateError) throw updateError;

    toast.success('새 예문으로 바꿨어요', { id: toastId });
  } catch {
    toast.error('새 예문 생성에 또 실패했어요', { id: toastId });
  }
}

export default function WrongAnswerQuizCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [difficulty, setDifficulty] = useState('B1');
  const [translationLanguage, setTranslationLanguage] = useState('en');
  const [regenerate, setRegenerate] = useState(false);
  const [assignToClass, setAssignToClass] = useState(true);
  const [step, setStep] = useState(1);
  const [sortBy, setSortBy] = useState<'count' | 'recent'>('count');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedWrongAnswers, setSelectedWrongAnswers] = useState<string[]>([]);
  const [fillBlankEnabled, setFillBlankEnabled] = useState(true);
  const [typeAnswerEnabled, setTypeAnswerEnabled] = useState(false);

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
      // class_members.student_id와 profiles.user_id는 둘 다 auth.users를 참조할 뿐
      // 서로 직접 FK가 없다. 그래서 예전의 `profiles!inner(name)` 조인은 PostgREST에서
      // 항상 PGRST200("Could not find a relationship")으로 실패했고, 학생 목록이 비어
      // 학생을 고를 수 없으니 '다음 · 문제로'가 영구 비활성이 되어 이 화면이 통째로
      // 막혀 있었다. 조인 대신 두 번 조회해서 이름을 붙인다.
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

  // 오답 집계 — 학생 오답 노트와 같은 소스(4유형 통합 RPC)를 쓴다.
  // 예전엔 quiz_results.answers JSON을 직접 파싱해 빈칸 채우기 오답만 잡혔고,
  // 그래서 같은 학생인데 학생 화면과 선생님 화면의 오답 수가 달랐다.
  // 권한(담당 교사 여부)은 RPC 안에서 처리되므로 여기서 또 거르지 않는다.
  const { data: wrongAnswers, isLoading: wrongAnswersLoading } = useQuery({
    queryKey: ['wrong-answers-aggregate', selectedStudents],
    queryFn: async () => {
      if (selectedStudents.length === 0) return [] as WrongAnswerData[];

      const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
        'get_class_wrong_answers',
        { _student_ids: selectedStudents }
      );
      if (error) throw error;

      const rows = (data ?? []) as RpcClassWrongAnswerRow[];
      const map = new Map<string, WrongAnswerData>();

      rows.forEach((row) => {
        const source = row.source || 'unknown';
        // 기본형(word)으로 묶는다. 비어 있으면 정답으로 폴백.
        const word = (row.word && row.word.trim()) || row.correct_answer;
        if (!word) return;

        let group = map.get(word);
        if (!group) {
          group = {
            word,
            // fill_blank 행을 만나기 전까지의 기본값. matchup의 correct_answer는 '뜻'이라
            // 빈칸 채우기 정답으로 쓰면 안 되므로 단어 자신을 정답으로 둔다.
            correct_answer: word,
            sentence: '',
            translation: null,
            count: 0,
            students: new Set<string>(),
            entries: [],
            sources: new Set<string>(),
            latest_at: '',
            meaning: null,
            selectable: false,
          };
          map.set(word, group);
        }

        group.count++;
        group.sources.add(source);
        if (row.student_id) group.students.add(row.student_id);

        const completedAt = row.completed_at ?? '';
        if (completedAt > group.latest_at) group.latest_at = completedAt;

        // 빈칸 치환은 fill_blank 행에만 적용한다. 다른 유형은 sentence가 비어 있거나
        // (matchup/word_magnet) 뜻 프롬프트(type_answer)라 치환 대상이 아니다.
        if (source === 'fill_blank' && !group.sentence && row.sentence) {
          group.sentence = row.sentence;
          group.correct_answer = row.correct_answer;
          group.translation = row.translation;
        }

        // 뜻: 짝 맞추기의 정답(meaning_text) → 받아쓰기의 프롬프트(뜻) 순으로 사용
        if (!group.meaning) {
          if (source === 'matchup' && row.correct_answer?.trim()) {
            group.meaning = row.correct_answer.trim();
          } else if (source === 'type_answer' && row.sentence?.trim()) {
            group.meaning = row.sentence.trim();
          }
        }

        group.entries.push({
          student_id: row.student_id ?? '',
          source,
          sentence: row.sentence ?? '',
          correct_answer: row.correct_answer,
          user_answer: row.user_answer ?? '',
          translation: row.translation,
          completed_at: completedAt,
        });
      });

      const list = [...map.values()];
      list.forEach((g) => {
        // 문장 순서 맞추기만 있는 그룹은 word가 문장 전체라 어휘 퀴즈 문항이 될 수 없다.
        g.selectable = !(g.sources.size === 1 && g.sources.has('word_magnet'));
      });
      return list;
    },
    enabled: selectedStudents.length > 0,
  });

  const sortedWrongAnswers = useMemo(() => {
    const list = [...(wrongAnswers ?? [])];
    if (sortBy === 'recent') {
      list.sort((a, b) => b.latest_at.localeCompare(a.latest_at));
    } else {
      list.sort((a, b) => b.count - a.count);
    }
    return list;
  }, [wrongAnswers, sortBy]);

  const createQuizMutation = useMutation({
    mutationFn: async () => {
      const selectedProblems = (wrongAnswers ?? []).filter((wa) =>
        selectedWrongAnswers.includes(wa.word)
      );

      if (selectedProblems.length === 0) {
        throw new Error('선택한 문제가 없어요');
      }
      if (!fillBlankEnabled && !typeAnswerEnabled) {
        throw new Error('퀴즈 유형을 최소 하나 선택해 주세요');
      }

      const words = selectedProblems.map((p) => p.word);

      // 빈칸 채우기는 빈칸( )이 있는 문장이 있어야 출제된다. 짝 맞추기/받아쓰기에서만
      // 틀린 단어는 문장이 없으므로, 새 예문 생성을 켜지 않으면 빈 문제가 된다.
      if (fillBlankEnabled && !regenerate) {
        const missing = selectedProblems.filter((p) => !p.sentence);
        if (missing.length > 0) {
          throw new Error(
            `문장이 없는 단어가 있어요 (${missing
              .map((p) => p.word)
              .join(', ')}) — "AI로 새 예문 생성"을 켜주세요`
          );
        }
      }

      let problems: Problem[] = selectedProblems.map((p, index) => ({
        id: `wrong-${index}`,
        word: p.word,
        answer: p.correct_answer,
        sentence: p.sentence,
        hint: '',
        translation: p.translation || '',
      }));

      // 받아쓰기 프롬프트로 쓸 뜻. 기존 오답에서 얻은 뜻이 우선(학생이 실제로 본 뜻이라서).
      const meaningByWord = new Map<string, string>();
      selectedProblems.forEach((p) => {
        if (p.meaning) meaningByWord.set(p.word, p.meaning);
      });

      // AI 호출이 필요한 경우:
      //  - 새 예문 생성을 켰거나(regenerate)
      //  - 받아쓰기를 켰는데 뜻을 모르는 단어가 있을 때
      const needMeanings = typeAnswerEnabled && selectedProblems.some((p) => !p.meaning);
      let regenerateFailed = false;

      if (regenerate || needMeanings) {
        const { data: genData, error: genError } = await supabase.functions.invoke<GenerateQuizResponse>(
          'generate-quiz',
          {
            body: {
              words,
              difficulty,
              translationLanguage,
              wordsPerSet: 5,
              typeAnswerEnabled,
              // 바로 아래에서 quizzes에 INSERT하는 새 퀴즈다 → 한도 사전 체크 대상.
              purpose: 'create',
            },
          }
        );

        if (genError || !genData?.problems?.length) {
          // 한도 초과면 아래 INSERT가 트리거에 어차피 막힌다. 여기서 조용히 폴백하면
          // 그때까지 헛일을 하고, 뜻을 못 구해 '받아쓰기에 쓸 단어 뜻이 없어요' 같은
          // 엉뚱한 문구로 끝날 수도 있다. 한도 문구를 그대로 올린다.
          if (genError) {
            const parsed = await readEdgeFunctionError(genError, '새 예문 생성에 실패했어요');
            if (isQuotaExceeded(parsed)) throw new Error(parsed.message);
          }
          // 그 외 실패는 예전처럼 기존 문장으로 폴백하되(선생님이 실패를 모르지 않도록)
          // onSuccess에서 알리고 재시도를 제공한다.
          if (regenerate) regenerateFailed = true;
        } else {
          if (regenerate) problems = genData.problems;
          // AI가 만든 뜻으로 빈자리만 채운다.
          (genData.typeAnswerProblems ?? []).forEach((p) => {
            if (p.prompt?.trim() && !meaningByWord.has(p.answer)) {
              meaningByWord.set(p.answer, p.prompt.trim());
            }
          });
        }
      }

      // 받아쓰기 문항. 뜻이 없는 단어는 프롬프트를 만들 수 없어 제외한다.
      const typeAnswerProblems = typeAnswerEnabled
        ? selectedProblems
            .map((p, index) => ({
              problem_id: `ta-${index}`,
              prompt: (meaningByWord.get(p.word) ?? '').trim(),
              answer: p.word,
            }))
            .filter((p) => p.prompt && p.answer)
        : [];

      // 유형 플래그만 켜고 문항 데이터가 없으면 학생 화면에 빈 스테이지가 생겨
      // 진행이 막힌다(QuizTake는 플래그만 보고 스테이지를 만든다). 그래서
      // 실제 문항이 있을 때만 플래그를 켠다.
      const typeAnswerReady = typeAnswerProblems.length > 0;
      if (!fillBlankEnabled && !typeAnswerReady) {
        throw new Error('받아쓰기에 쓸 단어 뜻이 없어요 — 빈칸 채우기를 함께 선택해 주세요');
      }

      const quizInsert: Record<string, unknown> = {
        teacher_id: user!.id,
        title: quizTitle || '오답 복습 퀴즈',
        words,
        difficulty,
        words_per_set: 5,
        timer_enabled: false,
        translation_language: translationLanguage,
        problems: JSON.parse(JSON.stringify(problems)),
        [STAGE_ENABLED_KEY.fill_blank]: fillBlankEnabled,
        [STAGE_ENABLED_KEY.type_answer]: typeAnswerReady,
      };

      const { data, error } = await supabase
        .from('quizzes')
        .insert(quizInsert as TablesInsert<'quizzes'>)
        .select()
        .single();

      // 한도 트리거(enforce_quiz_quota)에 막히면 트리거가 던진 한국어 문구가 여기로 온다.
      // onError가 message를 그대로 띄우므로, 그 외 DB 에러(영문)는 헬퍼가 fallback으로 덮는다.
      if (error) throw new Error(quizInsertErrorMessage(error, '퀴즈를 만들지 못했어요'));

      let typeAnswerDropped = false;
      if (typeAnswerReady) {
        const rowsToInsert: TablesInsert<'type_answer_problems'>[] = typeAnswerProblems.map((p) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          prompt: p.prompt,
          answer: p.answer,
        }));
        const { error: taError } = await supabase.from('type_answer_problems').insert(rowsToInsert);
        if (taError) {
          // 문항 저장에 실패했는데 플래그가 켜져 있으면 학생이 빈 스테이지에 갇힌다. 플래그를 되돌린다.
          console.error('Failed to save type answer problems:', taError);
          await supabase
            .from('quizzes')
            .update({ [STAGE_ENABLED_KEY.type_answer]: false })
            .eq('id', data.id);
          typeAnswerDropped = true;
        }
      }

      // 생성한 퀴즈를 선택한 클래스에 바로 배정. 실패는 치명적이지 않으므로 경고만.
      if (assignToClass && selectedClassId) {
        try {
          const { error: assignError } = await supabase
            .from('quiz_assignments')
            .insert({ quiz_id: data.id, class_id: selectedClassId });
          if (assignError) throw assignError;
        } catch {
          toast.warning('퀴즈는 만들었지만 클래스 배정에 실패했어요');
        }
      }

      const skippedTypeAnswer =
        typeAnswerEnabled && typeAnswerReady && typeAnswerProblems.length < selectedProblems.length;

      return { quiz: data, words, regenerateFailed, typeAnswerDropped, skippedTypeAnswer };
    },
    onSuccess: ({ quiz, words, regenerateFailed, typeAnswerDropped, skippedTypeAnswer }) => {
      toast.success('오답 복습 퀴즈를 만들었어요');

      if (regenerateFailed) {
        toast.warning('새 예문 생성 실패 — 기존 문장으로 만들었어요', {
          duration: 10000,
          action: {
            label: '재시도',
            onClick: () => retryRegeneration(quiz.id, words, difficulty, translationLanguage),
          },
        });
      }
      if (typeAnswerDropped) {
        toast.warning('받아쓰기 문제를 저장하지 못해 빼고 만들었어요');
      } else if (skippedTypeAnswer) {
        toast.warning('뜻을 모르는 단어는 받아쓰기에서 뺐어요');
      }

      navigate(`/quiz/${quiz.id}`);
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

  const toggleWrongAnswerSelection = (word: string) => {
    setSelectedWrongAnswers((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  const toggleExpand = (word: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const selectedClassName = classes?.find((c) => c.id === selectedClassId)?.name ?? '';

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

        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileX className="h-6 w-6" />
            오답 기반 복습 퀴즈 만들기
          </h1>
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

        {/* Step 1: 대상 (클래스 + 학생) */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                대상
              </CardTitle>
              <CardDescription>오답을 분석할 클래스와 학생을 고르세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>클래스</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={(v) => {
                    setSelectedClassId(v);
                    setSelectedStudents([]);
                    setSelectedWrongAnswers([]);
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
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedClassId || selectedStudents.length === 0}
                >
                  다음 · 문제로
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: 문제 선택 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                문제 선택
              </CardTitle>
              <CardDescription>
                {selectedClassName && `${selectedClassName} · `}학생 {selectedStudents.length}명 기준
                · {selectedWrongAnswers.length}개 선택됨
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  선택한 학생의 전체 오답 이력이에요
                </p>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v === 'recent' ? 'recent' : 'count')}
                >
                  <SelectTrigger className="w-[150px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">자주 틀린 순</SelectItem>
                    <SelectItem value="recent">최신순</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {wrongAnswersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sortedWrongAnswers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  선택한 학생들의 오답 데이터가 없습니다.
                </p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {sortedWrongAnswers.map((wa) => {
                    const isExpanded = expanded.has(wa.word);
                    const mainSource = wa.entries[0]?.source ?? 'unknown';
                    const extraSourceCount = wa.sources.size - 1;
                    const blocks = isExpanded ? groupEntries(wa.entries) : [];

                    return (
                      <div key={wa.word} className="rounded-lg border bg-card overflow-hidden">
                        {/* 접힌 줄 — 문장 미리보기 없이 화살표만 */}
                        <div
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => toggleExpand(wa.word)}
                        >
                          <Checkbox
                            checked={selectedWrongAnswers.includes(wa.word)}
                            disabled={!wa.selectable}
                            onCheckedChange={() => toggleWrongAnswerSelection(wa.word)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0 max-w-[40%] truncate">
                            {wa.word}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium shrink-0">
                            {sourceLabel(mainSource)}
                            {extraSourceCount > 0 && ` +${extraSourceCount}`}
                          </span>
                          {!wa.selectable && (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium shrink-0">
                              퀴즈 생성 미지원
                            </span>
                          )}
                          <span className="text-xs font-semibold text-destructive shrink-0">
                            {wa.count}회 · {wa.students.size}명
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(wa.word);
                            }}
                            className="ml-auto shrink-0 flex items-center justify-center h-8 w-8 -mr-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            aria-label={isExpanded ? '접기' : '펼치기'}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* 펼침 — 문장(정답 강조) + 번역 + 학생별 답변 */}
                        {isExpanded && (
                          <div className="border-t px-3 py-3 space-y-3">
                            {blocks.map((block, idx) => {
                              const hasBlank = BLANK_RE.test(block.sentence);
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                                    {sourceLabel(block.source)}
                                  </span>
                                  {hasBlank ? (
                                    <p className="text-sm leading-relaxed break-keep">
                                      {renderSentence(block.sentence, block.correct_answer)}
                                    </p>
                                  ) : (
                                    <>
                                      {block.sentence && (
                                        <p className="text-sm text-muted-foreground leading-relaxed break-keep">
                                          {block.sentence}
                                        </p>
                                      )}
                                      <p className="text-sm leading-relaxed">
                                        <span className="text-xs text-muted-foreground mr-1.5">
                                          정답
                                        </span>
                                        <span className="text-success font-bold">
                                          {block.correct_answer}
                                        </span>
                                      </p>
                                    </>
                                  )}
                                  {block.translation && (
                                    <p className="text-xs text-muted-foreground leading-relaxed break-keep">
                                      {block.translation}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
                                    {block.answers.map((a, i) => (
                                      <span key={i} className="text-xs">
                                        <span className="text-muted-foreground mr-1">
                                          {studentNameById.get(a.student_id) ?? '학생'}
                                        </span>
                                        <span className="text-destructive font-medium">
                                          &ldquo;{a.user_answer || '(입력 없음)'}&rdquo;
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  이전
                </Button>
                <Button onClick={() => setStep(3)} disabled={selectedWrongAnswers.length === 0}>
                  다음 · 설정으로
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: 설정·생성 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                설정·생성
              </CardTitle>
              <CardDescription>
                문제 {selectedWrongAnswers.length}개로 만들 퀴즈를 설정하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">퀴즈 제목</Label>
                <Input
                  id="title"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="오답 복습 퀴즈"
                />
              </div>

              {/* 난이도 — 브랜드 그린 단색 (선택=채움, 미선택=중립) */}
              <div className="space-y-2">
                <Label>난이도</Label>
                <div className="grid grid-cols-6 gap-2">
                  {DIFFICULTY_LEVELS.map(({ level }) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`py-2.5 rounded-full border-2 font-bold text-sm transition-all ${
                        difficulty === level
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const selected = DIFFICULTY_LEVELS.find((d) => d.level === difficulty);
                    return selected ? `${selected.level} · ${selected.label}` : null;
                  })()}
                </p>
              </div>

              {/* 번역 언어 */}
              <div className="space-y-2">
                <Label>번역 언어</Label>
                <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSLATION_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 퀴즈 유형 */}
              <div className="space-y-2">
                <Label>퀴즈 유형</Label>
                <div className="grid grid-cols-2 gap-3">
                  {QUIZ_TYPES.map(({ stage, icon: Icon, desc }) => {
                    const enabled = stage === 'fill_blank' ? fillBlankEnabled : typeAnswerEnabled;
                    const setEnabled =
                      stage === 'fill_blank' ? setFillBlankEnabled : setTypeAnswerEnabled;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          enabled ? 'border-primary bg-accent' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {enabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                        <div className="flex items-center gap-2 mb-1">
                          <Icon
                            className={`w-4 h-4 ${enabled ? 'text-primary' : 'text-muted-foreground'}`}
                          />
                          <span className="font-bold text-sm text-foreground">
                            {STAGE_LABELS[stage]}
                          </span>
                        </div>
                        <div className={`text-xs ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                          {desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {typeAnswerEnabled && (
                  <p className="text-xs text-muted-foreground">
                    받아쓰기는 단어 뜻이 필요해요 — 뜻을 모르는 단어는 AI가 채우거나 빠져요
                  </p>
                )}
              </div>

              {/* 생성 옵션 */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="regenerate"
                    checked={regenerate}
                    onCheckedChange={(v) => setRegenerate(!!v)}
                  />
                  <Label htmlFor="regenerate" className="cursor-pointer">
                    AI로 새 예문 생성 (기존 문장 재사용 안 함)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="assignToClass"
                    checked={assignToClass}
                    disabled={!selectedClassId}
                    onCheckedChange={(v) => setAssignToClass(!!v)}
                  />
                  <Label htmlFor="assignToClass" className="cursor-pointer">
                    선택한 클래스에 바로 배정
                  </Label>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  이전
                </Button>
                <Button
                  onClick={() => createQuizMutation.mutate()}
                  disabled={
                    selectedWrongAnswers.length === 0 ||
                    (!fillBlankEnabled && !typeAnswerEnabled) ||
                    createQuizMutation.isPending
                  }
                >
                  {createQuizMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  퀴즈 생성
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
