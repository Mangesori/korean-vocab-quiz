import { useState } from "react";
import { useStudentHistory, StudentQuizActivity } from "@/hooks/useStudentHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Eye } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";
import { formatDateShort } from "@/lib/formatDate";

interface ScoreCellProps {
  score: number | null;
  total: number | null;
  enabled: boolean;
}

function ScoreCell({ score, total, enabled }: ScoreCellProps) {
  if (!enabled) return <span className="text-muted-foreground">—</span>;
  if (score === null) return <span className="text-muted-foreground text-xs">미완료</span>;
  return <span className="font-semibold text-sm">{score}/{total ?? "?"}</span>;
}

interface StudentHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;
}

export function StudentHistoryDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
}: StudentHistoryDialogProps) {
  const { activities, isLoading } = useStudentHistory(studentId, classId);
  const [selectedResult, setSelectedResult] = useState<StudentQuizActivity | null>(null);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{studentName} 학생의 활동 기록</DialogTitle>
            <DialogDescription>
              이 학생의 퀴즈 배정 현황과 완료한 퀴즈 결과를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>퀴즈 제목</TableHead>
                    <TableHead className="whitespace-nowrap">배정일</TableHead>
                    <TableHead className="whitespace-nowrap">빈칸 채우기</TableHead>
                    <TableHead className="whitespace-nowrap">매치업</TableHead>
                    <TableHead className="whitespace-nowrap">답 입력</TableHead>
                    <TableHead className="whitespace-nowrap">워드 마그넷</TableHead>
                    <TableHead className="whitespace-nowrap">문장 만들기</TableHead>
                    <TableHead className="whitespace-nowrap">말하기 연습</TableHead>
                    <TableHead className="whitespace-nowrap text-center">상세보기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                        배정된 퀴즈가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">
                          <div className="truncate">{activity.quiz_title}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateShort(activity.assigned_at)}
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.fill_blank_score}
                            total={activity.fill_blank_total}
                            enabled={activity.fill_blank_enabled ?? true}
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.matchup_score}
                            total={activity.matchup_total}
                            enabled={activity.matchup_enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.type_answer_score}
                            total={activity.type_answer_total}
                            enabled={activity.type_answer_enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.word_magnet_score}
                            total={activity.word_magnet_total}
                            enabled={activity.word_magnet_enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.sentence_making_score}
                            total={activity.sentence_making_total}
                            enabled={activity.sentence_making_enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreCell
                            score={activity.recording_score}
                            total={activity.recording_total}
                            enabled={activity.recording_enabled}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            disabled={activity.status !== "completed"}
                            onClick={() => activity.status === "completed" && setSelectedResult(activity)}
                          >
                            <Eye className={`w-4 h-4 ${activity.status !== "completed" ? "text-muted-foreground" : "text-primary"}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuizResultDialog
        isOpen={!!selectedResult}
        onClose={() => setSelectedResult(null)}
        result={selectedResult}
        studentName={studentName}
        quizId={selectedResult?.quiz_id || ""}
      />
    </>
  );
}
