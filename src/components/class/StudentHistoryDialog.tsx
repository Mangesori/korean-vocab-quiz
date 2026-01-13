import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useStudentHistory } from "@/hooks/useStudentHistory";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
          <Tabs defaultValue="assigned" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assigned">배정된 퀴즈 현황</TabsTrigger>
              <TabsTrigger value="completed">완료한 퀴즈 상세</TabsTrigger>
            </TabsList>

            <TabsContent value="assigned" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>퀴즈 제목</TableHead>
                      <TableHead className="w-[180px]">배정일</TableHead>
                      <TableHead className="w-[160px]">상태</TableHead>
                      <TableHead className="w-[160px]">점수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          배정된 퀴즈가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.map((activity) => (
                        <TableRow key={activity.quiz_id}>
                          <TableCell className="font-medium">{activity.title}</TableCell>
                          <TableCell>
                            {format(new Date(activity.created_at), "yyyy-MM-dd", { locale: ko })}
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
                            {activity.result ? (
                              <span className="font-medium">
                                {activity.result.score} / {activity.result.total_questions}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
               {/* Just showing completed ones specifically */}
               <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>퀴즈 제목</TableHead>
                      <TableHead className="w-[180px]">완료일</TableHead>
                      <TableHead className="w-[160px]">점수</TableHead>
                      <TableHead className="w-[160px]">정답률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.filter(a => a.status === "completed").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          완료한 퀴즈가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.filter(a => a.status === "completed").map((activity) => (
                        <TableRow key={activity.quiz_id}>
                          <TableCell className="font-medium">{activity.title}</TableCell>
                          <TableCell>
                            {activity.result && format(new Date(activity.result.completed_at), "yyyy-MM-dd HH:mm", { locale: ko })}
                          </TableCell>
                          <TableCell>
                             {activity.result?.score} / {activity.result?.total_questions}
                          </TableCell>
                          <TableCell>
                            {activity.result && Math.round((activity.result.score / activity.result.total_questions) * 100)}%
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
