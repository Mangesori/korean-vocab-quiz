
import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText, Clock, Pencil, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Quiz } from "@/hooks/useQuizData";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShareQuizDialogContent } from "./ShareQuizDialog";

interface QuizHeaderProps {
  quiz: Quiz;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenSendDialog: () => void;
}

export function QuizHeader({ quiz, onUpdateTitle, onDelete, onOpenSendDialog }: QuizHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  const handleTitleSave = async () => {
    if (!editedTitle.trim()) return;
    await onUpdateTitle(editedTitle.trim());
    setIsEditingTitle(false);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div className="flex-1">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-2xl sm:text-3xl font-bold h-auto py-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                else if (e.key === 'Escape') setIsEditingTitle(false);
              }}
            />
            <Button size="sm" onClick={handleTitleSave} disabled={!editedTitle.trim()}>저장</Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditingTitle(false)}>취소</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{quiz.title}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditedTitle(quiz.title);
                setIsEditingTitle(true);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
          <LevelBadge level={quiz.difficulty} />
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <FileText className="w-4 h-4" />
            {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
          </span>
          {quiz.timer_enabled && quiz.timer_seconds && (
            <span className="text-muted-foreground flex items-center gap-1 text-sm">
              <Clock className="w-4 h-4" />
              {quiz.timer_seconds}초
            </span>
          )}
          <span className="text-muted-foreground text-sm">
            {format(new Date(quiz.created_at), "yyyy년 M월 d일", { locale: ko })}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" onClick={onOpenSendDialog}>
          <Send className="w-4 h-4 mr-2" /> <span className="whitespace-nowrap">퀴즈 보내기</span>
        </Button>
        <Button variant="outline" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
