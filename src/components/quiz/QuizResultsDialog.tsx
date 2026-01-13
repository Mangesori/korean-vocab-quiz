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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quizTitle} - 결과 목록</DialogTitle>
        </DialogHeader>
        
        {quizId && <QuizResultsList quizId={quizId} />}
      </DialogContent>
    </Dialog>
  );
}
