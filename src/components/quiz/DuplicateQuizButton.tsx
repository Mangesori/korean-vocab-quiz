import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
}

interface DuplicateQuizButtonProps {
  quiz: Quiz;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
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
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // 2. Copy quiz_answers
      const { data: answers, error: answersError } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('quiz_id', quiz.id);

      if (answersError) throw answersError;

      if (answers && answers.length > 0) {
        const newAnswers = answers.map((answer) => ({
          quiz_id: newQuiz.id,
          problem_id: answer.problem_id,
          correct_answer: answer.correct_answer,
          word: answer.word,
        }));

        const { error: insertAnswersError } = await supabase
          .from('quiz_answers')
          .insert(newAnswers);

        if (insertAnswersError) throw insertAnswersError;
      }

      // 3. Copy quiz_problems (audio data)
      const { data: problems, error: problemsError } = await supabase
        .from('quiz_problems')
        .select('*')
        .eq('quiz_id', quiz.id);

      if (problemsError) throw problemsError;

      if (problems && problems.length > 0) {
        const newProblems = problems.map((problem) => ({
          quiz_id: newQuiz.id,
          problem_id: problem.problem_id,
          word: problem.word,
          sentence: problem.sentence,
          hint: problem.hint,
          translation: problem.translation,
          sentence_audio_url: problem.sentence_audio_url,
          hint_audio_url: problem.hint_audio_url,
        }));

        const { error: insertProblemsError } = await supabase
          .from('quiz_problems')
          .insert(newProblems);

        if (insertProblemsError) throw insertProblemsError;
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
      toast.error('퀴즈 복제에 실패했습니다.');
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
