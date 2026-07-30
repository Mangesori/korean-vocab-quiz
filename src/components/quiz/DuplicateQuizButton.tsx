import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { quizInsertErrorMessage } from '@/lib/supabaseErrors';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Quiz {
  id: string;
  title: string;
  words: string[];
  difficulty: string;
  words_per_set: number;
  timer_enabled: boolean;
  timer_seconds: number | null;
  translation_language: string;
  problems: any;
  api_provider?: string;
  recording_enabled?: boolean;
  sentence_making_enabled?: boolean;
  matchup_enabled?: boolean;
  type_answer_enabled?: boolean;
  word_magnet_enabled?: boolean;
  fill_blank_enabled?: boolean;
}

interface DuplicateQuizButtonProps {
  quiz: Quiz;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

// 문제 데이터가 흩어져 있는 7개 테이블 = select(quiz_id) → insert(newQuiz.id) 패턴이 전부 동일하다.
// 예전에는 테이블마다 이 패턴을 손으로 복붙했는데, 그래서 matchup/type_answer/word_magnet
// 유형이 추가됐을 때 복제 코드가 갱신되지 않아 복사본에서 해당 유형이 통째로 사라지는
// 버그가 났다. 배열 하나로 묶어두면 다음 유형 추가 시 항목 하나만 더하면 되므로
// 같은 실수가 재발하지 않는다. quiz_id/id/created_at은 복사 대상이 아니므로 cols에서 제외한다.
const PROBLEM_TABLES = [
  { table: 'quiz_answers', cols: ['problem_id', 'correct_answer', 'word'] },
  {
    table: 'quiz_problems',
    cols: [
      'problem_id',
      'word',
      'sentence',
      'hint',
      'translation',
      'sentence_audio_url',
      'hint_audio_url',
    ],
  },
  { table: 'matchup_problems', cols: ['problem_id', 'korean_text', 'meaning_text', 'sort_order'] },
  { table: 'type_answer_problems', cols: ['problem_id', 'prompt', 'answer', 'sort_order'] },
  {
    table: 'word_magnet_problems',
    cols: ['problem_id', 'base_text', 'translation', 'items', 'sort_order'],
  },
  {
    table: 'sentence_making_problems',
    cols: ['problem_id', 'word', 'model_answer', 'word_meaning', 'grading_criteria', 'sort_order'],
  },
  {
    table: 'recording_problems',
    cols: [
      'problem_id',
      'sentence',
      'mode',
      'source_type',
      'source_problem_id',
      'sentence_audio_url',
      'translation',
      'sort_order',
      'label',
    ],
  },
] as const;

function pick(row: Record<string, unknown>, cols: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const col of cols) {
    result[col] = row[col];
  }
  return result;
}

export function DuplicateQuizButton({
  quiz,
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: DuplicateQuizButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // 1. Create new quiz with copied data
      const { data: newQuiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          teacher_id: user.id,
          title: `${quiz.title} (복사본)`,
          words: quiz.words,
          difficulty: quiz.difficulty,
          words_per_set: quiz.words_per_set,
          timer_enabled: quiz.timer_enabled,
          timer_seconds: quiz.timer_seconds,
          translation_language: quiz.translation_language,
          problems: quiz.problems,
          api_provider: quiz.api_provider,
          recording_enabled: quiz.recording_enabled ?? false,
          sentence_making_enabled: quiz.sentence_making_enabled ?? false,
          matchup_enabled: quiz.matchup_enabled ?? false,
          type_answer_enabled: quiz.type_answer_enabled ?? false,
          word_magnet_enabled: quiz.word_magnet_enabled ?? false,
          // fill_blank_enabled만 DB 기본값이 true다(원래 유일한 퀴즈 유형이라 나중에
          // 컬럼이 추가됐을 때 기존 행이 전부 활성으로 남아야 했음). 그래서 여기만
          // `?? false`가 아니라 `!== false`를 써야 한다 — 안 그러면 빈칸 채우기를
          // 켠 채로 만든 퀴즈를 복제했을 때 복사본에서 오히려 꺼지는 반대 방향
          // 버그가 생긴다. src/types/quiz.ts의 isStageEnabled와 동일한 규칙.
          fill_blank_enabled: quiz.fill_blank_enabled !== false,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      try {
        for (const { table, cols } of PROBLEM_TABLES) {
          const { data: rows, error: selectError } = await supabase
            .from(table)
            .select('*')
            .eq('quiz_id', quiz.id);

          if (selectError) throw selectError;

          if (rows && rows.length > 0) {
            const newRows = rows.map((row) => ({
              ...pick(row as Record<string, unknown>, cols),
              quiz_id: newQuiz.id,
            }));

            // 7개 테이블을 하나의 루프로 도는 이상, insert()가 요구하는 테이블별
            // 정확한 Row 타입을 정적으로 좁힐 수 없다. cols는 위 PROBLEM_TABLES에서
            // 마이그레이션 스키마와 대조해 손으로 맞췄으므로 런타임 형태는 안전하다.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertError } = await supabase.from(table).insert(newRows as any);

            if (insertError) throw insertError;
          }
        }
      } catch (err) {
        // 트랜잭션이 없어서 7개 테이블 중 하나라도 insert가 실패하면 반쯤 복사된
        // 퀴즈가 남는다. 모든 문제 테이블의 quiz_id FK가 ON DELETE CASCADE이므로
        // quizzes 행만 지우면 이미 복사된 자식 행들도 함께 정리된다.
        await supabase.from('quizzes').delete().eq('id', newQuiz.id);
        throw err;
      }

      return newQuiz;
    },
    onSuccess: (newQuiz) => {
      toast.success('퀴즈가 복제되었습니다.');
      setOpen(false);
      navigate(`/quiz/${newQuiz.id}`);
    },
    onError: (error) => {
      console.error('Duplicate error:', error);
      // 복제도 quizzes INSERT라 한도 트리거(enforce_quiz_quota)에 막힌다. 예전엔 이 경로가
      // AI를 안 거쳐 한도를 통째로 우회했고 이제 처음으로 막히는데, 고정 문구('퀴즈 복제에
      // 실패했습니다.')로 덮으면 선생님이 실패 이유(= 한도 소진)를 전혀 알 수 없다.
      // 한도 에러만 트리거 문구를 그대로 쓰고, 나머지 DB 에러는 영문이라 fallback으로 덮는다.
      toast.error(quizInsertErrorMessage(error, '퀴즈를 복제하지 못했어요'));
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Copy className={`h-4 w-4 ${showLabel ? 'mr-2' : ''}`} />
          {showLabel && '복제'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>퀴즈 복제</AlertDialogTitle>
          <AlertDialogDescription>
            "{quiz.title}" 퀴즈를 복제하시겠습니까?
            <br />
            복제된 퀴즈는 새로운 퀴즈로 생성됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              duplicateMutation.mutate();
            }}
            disabled={duplicateMutation.isPending}
          >
            {duplicateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            복제하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
