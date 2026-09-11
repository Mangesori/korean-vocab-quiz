
import { useState } from "react";
import { FileText, Clock, Pencil, Trash2, Send, Radio, MoreVertical, Users, ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Quiz } from "@/hooks/useQuizData";
import { DuplicateQuizDialog } from "./DuplicateQuizDialog";
import { formatDateShort } from '@/lib/formatDate';
import { useQuizAssignedStudents } from "./QuizAssignedStudents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuizHeaderProps {
  quiz: Quiz;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenSendDialog: () => void;
  /** 라이브로 진행 가능한 유형이 하나라도 켜져 있을 때만 넘어온다 — 없으면 버튼 자체를 안 보여준다. */
  onOpenLiveDialog?: () => void;
  /** "배정"/"단어" 인라인 트리거의 펼침 상태 — 두 개가 독립적으로 동시에 열릴 수 있다. */
  assignedOpen: boolean;
  wordsOpen: boolean;
  onToggleAssigned: () => void;
  onToggleWords: () => void;
}

// 1단: 제목 + 메타 한 줄(배정·단어 인라인 트리거 포함) + 액션. 실물 버튼은 [퀴즈 보내기]뿐이고
// 나머지(라이브·복제·삭제)는 ⋮ 드롭다운 안으로 들어간다 — 문제 편집까지 닿는 단수를 줄이기 위한
// 16-3 헤더 압축. "배정"/"단어" 카드는 더 이상 자체 트리거를 갖지 않고, 여기 메타 줄의
// 인라인 버튼이 QuizDetail의 펼침 상태를 토글한다.
export function QuizHeader({
  quiz,
  onUpdateTitle,
  onDelete,
  onOpenSendDialog,
  onOpenLiveDialog,
  assignedOpen,
  wordsOpen,
  onToggleAssigned,
  onToggleWords,
}: QuizHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  // 접힌 상태에서도 값이 바로 보여야 하므로(펼치지 않아도 답을 알 수 있게) 헤더가
  // 독립적으로 배정 학생 쿼리를 구독한다 — QuizAssignedStudents 카드와 쿼리 키가 같아
  // React Query 캐시를 그대로 재사용한다(중복 네트워크 요청 없음).
  const { data: assignedStudents = [] } = useQuizAssignedStudents(quiz.id);
  const assignedLabel =
    assignedStudents.length === 1 ? assignedStudents[0].displayName : `${assignedStudents.length}명`;

  const handleTitleSave = async () => {
    if (!editedTitle.trim()) return;
    await onUpdateTitle(editedTitle.trim());
    setIsEditingTitle(false);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div className="flex-1 min-w-0">
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
          <div className="flex items-start gap-2 group">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words min-w-0">{quiz.title}</h1>
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
        {/* 메타 한 줄 — 배정·단어는 별도 가로줄이 아니라 이 줄 안에 인라인 트리거로 들어간다. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
          <LevelBadge level={quiz.difficulty} />
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
          </span>
          {quiz.timer_enabled && quiz.timer_seconds && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {quiz.timer_seconds}초
            </span>
          )}
          <span className="text-border">|</span>
          <span>{formatDateShort(quiz.created_at)}</span>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={onToggleAssigned}
            aria-expanded={assignedOpen}
            className="inline-flex items-center gap-1.5 font-semibold text-primary"
          >
            <Users className="w-3.5 h-3.5" />
            배정 {assignedLabel}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${assignedOpen ? "rotate-180" : ""}`} />
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={onToggleWords}
            aria-expanded={wordsOpen}
            className="inline-flex items-center gap-1.5 font-semibold text-primary"
          >
            단어 {quiz.words.length}개
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${wordsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button
          className="flex-1 sm:flex-none h-11 rounded-[11px] sm:h-10 sm:rounded-md"
          onClick={onOpenSendDialog}
        >
          <Send className="w-4 h-4 mr-2" /> <span className="whitespace-nowrap">퀴즈 보내기</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-11 w-11 sm:h-10 sm:w-10 shrink-0" aria-label="더보기">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onOpenLiveDialog && (
              <DropdownMenuItem onClick={onOpenLiveDialog} className="gap-2">
                <Radio className="w-4 h-4 text-destructive" />
                라이브 세션 시작
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setDuplicateOpen(true)} className="gap-2">
              <Copy className="w-4 h-4" />
              복제
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 드롭다운이 닫힐 때 함께 언마운트되지 않도록 DropdownMenu 바깥에서 렌더링한다. */}
        <DuplicateQuizDialog quiz={quiz} open={duplicateOpen} onOpenChange={setDuplicateOpen} />
      </div>
    </div>
  );
}
