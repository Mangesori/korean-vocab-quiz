import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, Eye } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";

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
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>퀴즈 제목</TableHead>
                    <TableHead className="w-[140px]">배정일</TableHead>
                    <TableHead className="w-[160px]">제출 시간</TableHead>
                    <TableHead className="w-[120px]">상태</TableHead>
                    <TableHead className="w-[80px]">점수</TableHead>
                    <TableHead className="w-[100px] text-center">상세보기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        배정된 퀴즈가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">{activity.quiz_title}</TableCell>
                        <TableCell>
                          {format(new Date(activity.assigned_at), "yyyy-MM-dd", { locale: ko })}
                        </TableCell>
                        <TableCell>
                          {activity.completed_at ? (
                            format(new Date(activity.completed_at), "MM-dd HH:mm", { locale: ko })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.status === "completed" ? (
                            <Badge className="bg-green-500 flex w-fit items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 완료
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex w-fit items-center gap-1">
                              <Clock className="w-3 h-3" /> 미완료
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.status === "completed" ? (
                            <span className="font-medium">
                              {activity.score} / {activity.total_questions}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
      
      {/* Quiz Result Popup */}
      <QuizResultDialog
        isOpen={!!selectedResult}
        onClose={() => setSelectedResult(null)}
        result={selectedResult}
        studentName={studentName}
      />
    </>
  );
}
