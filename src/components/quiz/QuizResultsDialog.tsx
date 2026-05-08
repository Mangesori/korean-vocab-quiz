import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuizResultsList } from "@/components/quiz/QuizResultsList";

interface QuizResultsDialogProps {
  quizId: string | null;
  quizTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuizResultsDialog({
  quizId,
  quizTitle,
  open,
  onOpenChange,
}: QuizResultsDialogProps) {
  const { data: quizSettings } = useQuery({
    queryKey: ['quiz-settings', quizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('quizzes')
        .select('sentence_making_enabled, recording_enabled')
        .eq('id', quizId!)
        .single();
      return data;
    },
    enabled: !!quizId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quizTitle} - 결과 목록</DialogTitle>
        </DialogHeader>

        {quizId && (
          <QuizResultsList
            quizId={quizId}
            sentenceMakingEnabled={quizSettings?.sentence_making_enabled ?? false}
            recordingEnabled={quizSettings?.recording_enabled ?? false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
