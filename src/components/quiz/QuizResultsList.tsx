import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useQuizResults, QuizResult } from "@/hooks/useQuizResults";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, User, UserCircle, Loader2, Eye } from "lucide-react";
import { QuizReviewCard } from "@/components/quiz/QuizReviewCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QuizResultsListProps {
  quizId: string;
}

export function QuizResultsList({ quizId }: QuizResultsListProps) {
  const { results, isLoading } = useQuizResults(quizId);
  const [filterType, setFilterType] = useState<"all" | "anonymous" | "student">("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "score_high" | "score_low">("latest");
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);

  // Filter and Sort
  const filteredResults = results
    .filter((result) => {
      if (filterType === "anonymous") return result.is_anonymous;
      if (filterType === "student") return !result.is_anonymous;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "latest") {
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      }
      if (sortOrder === "score_high") {
        return b.score - a.score;
      }
      if (sortOrder === "score_low") {
        return a.score - b.score;
      }
      return 0;
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getScoreBadge = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return <Badge className="bg-green-500 hover:bg-green-600">{score}/{total}</Badge>;
    if (percentage >= 70) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{score}/{total}</Badge>;
    return <Badge className="bg-red-500 hover:bg-red-600">{score}/{total}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>총 {results.length}건의 제출</span>
          {results.length > 0 && (
            <span>
              (평균: {Math.round(results.reduce((acc, curr) => acc + (curr.score / curr.total_questions) * 100, 0) / results.length)}점)
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 보기</SelectItem>
              <SelectItem value="student">학생</SelectItem>
              <SelectItem value="anonymous">익명</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="score_high">높은 점수순</SelectItem>
              <SelectItem value="score_low">낮은 점수순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>점수</TableHead>
              <TableHead>정답률</TableHead>
              <TableHead>제출 시간</TableHead>
              <TableHead className="text-right">상세보기</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  제출된 결과가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              filteredResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {result.is_anonymous ? (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {(result.student_profile?.name || "?")[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">
                          {result.is_anonymous ? result.anonymous_name || "익명" : result.student_profile?.name || "알 수 없음"}
                        </div>
                        {result.is_anonymous && (
                          <span className="text-xs text-muted-foreground">익명 사용자</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getScoreBadge(result.score, result.total_questions)}
                  </TableCell>
                  <TableCell>
                    {Math.round((result.score / result.total_questions) * 100)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(result.completed_at), "yyyy-MM-dd HH:mm", { locale: ko })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedResult(result)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Result Detail Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>퀴즈 결과 상세</DialogTitle>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                   {selectedResult.is_anonymous ? (
                      <UserCircle className="h-10 w-10 text-muted-foreground" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                         <span className="text-lg font-bold text-primary">
                            {(selectedResult.student_profile?.name || "?")[0]}
                         </span>
                      </div>
                    )}
                   <div>
                      <p className="font-semibold text-lg">
                        {selectedResult.is_anonymous ? selectedResult.anonymous_name : selectedResult.student_profile?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedResult.completed_at), "yyyy년 M월 d일 a h:mm", { locale: ko })}
                      </p>
                   </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">
                    {selectedResult.score} / {selectedResult.total_questions}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    정답률 {Math.round((selectedResult.score / selectedResult.total_questions) * 100)}%
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-lg">문제별 상세</h3>
                <div className="grid gap-4">
                  {selectedResult.answers.map((answer: any, index: number) => {
                    const problemData = {
                      id: answer.problemId || String(index),
                      word: "",
                      answer: answer.correctAnswer,
                      sentence: answer.sentence || "문제 내용 없음",
                      hint: "",
                      translation: answer.translation || "",
                      sentence_audio_url: answer.audioUrl,
                    };
                    
                    return (
                      <QuizReviewCard
                        key={index}
                        problem={problemData}
                        userAnswer={answer.userAnswer}
                        isCorrect={answer.isCorrect}
                        problemNumber={index + 1}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
