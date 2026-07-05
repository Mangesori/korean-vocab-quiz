import { useState } from "react";
import { useQuizResults, QuizResult } from "@/hooks/useQuizResults";
import { formatDateFull } from "@/lib/formatDate";
import { useSubmissionTimes } from "@/hooks/useSubmissionTimes";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { User, Loader2, Eye } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";

interface SubmissionTimeCellProps {
  result: QuizResult;
  sentenceMakingEnabled: boolean;
  recordingEnabled: boolean;
}

function SubmissionTimeCell({ result, sentenceMakingEnabled, recordingEnabled }: SubmissionTimeCellProps) {
  const isMultiStage = sentenceMakingEnabled || recordingEnabled;
  const { times, isLoading, fetchTimes } = useSubmissionTimes(
    result.id,
    sentenceMakingEnabled,
    recordingEnabled
  );

  const formattedDate = formatDateFull(result.completed_at);

  if (!isMultiStage) {
    return <span>{formattedDate}</span>;
  }

  return (
    <Popover onOpenChange={(open) => { if (open) fetchTimes(result.completed_at); }}>
      <PopoverTrigger asChild>
        <button className="text-sm underline decoration-dotted underline-offset-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          {formattedDate}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : times ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">빈칸 채우기</span>
              <span className="font-medium tabular-nums">
                {formatDateFull(times.fillBlank)}
              </span>
            </div>
            {sentenceMakingEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">문장 만들기</span>
                <span className="font-medium tabular-nums">
                  {times.sentenceMaking
                    ? formatDateFull(times.sentenceMaking)
                    : "대기 중"}
                </span>
              </div>
            )}
            {recordingEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">말하기 연습</span>
                <span className="font-medium tabular-nums">
                  {times.recording
                    ? formatDateFull(times.recording)
                    : "대기 중"}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface QuizResultsListProps {
  quizId: string;
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
}

export function QuizResultsList({ quizId, sentenceMakingEnabled, recordingEnabled }: QuizResultsListProps) {
  const { results, isLoading, refresh } = useQuizResults(quizId);
  const [filterType, setFilterType] = useState<"all" | "anonymous" | "student">("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "score_high" | "score_low">("latest");
  // id만 state로 갖고 매 렌더링마다 최신 results에서 찾아 파생시킨다 —
  // 재채점/수정 후 quiz_results가 갱신돼도(useQuizResults의 실시간 구독) 다이얼로그가
  // 스냅샷을 계속 들고 있어 화면이 갱신되지 않는 문제를 구조적으로 방지한다.
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const selectedResult = results.find((r) => r.id === selectedResultId) ?? null;

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

  const isMultiStage = sentenceMakingEnabled || recordingEnabled;

  const getCombinedPercent = (result: QuizResult) => {
    const smDone = result.sentence_making_score !== null;
    const recDone = result.recording_score !== null;
    const score =
      (result.fill_blank_score ?? result.score) +
      (smDone ? result.sentence_making_score! : 0) +
      (recDone ? result.recording_score! : 0);
    const total =
      (result.fill_blank_total ?? result.total_questions) +
      (smDone ? (result.sentence_making_total ?? 0) : 0) +
      (recDone ? (result.recording_total ?? 0) : 0);
    return total > 0 ? (score / total) * 100 : 0;
  };

  const renderScoreCell = (result: typeof filteredResults[0]) => {
    if (!isMultiStage) {
      return getScoreBadge(result.fill_blank_score ?? result.score, result.fill_blank_total ?? result.total_questions);
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">빈칸 채우기</span>
          {result.fill_blank_score !== null && result.fill_blank_total
            ? getScoreBadge(result.fill_blank_score, result.fill_blank_total)
            : <span className="text-muted-foreground">-</span>}
        </div>
        {sentenceMakingEnabled && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">문장 만들기</span>
            {result.sentence_making_score !== null && result.sentence_making_total
              ? getScoreBadge(result.sentence_making_score, result.sentence_making_total)
              : <Badge variant="secondary">대기 중</Badge>}
          </div>
        )}
        {recordingEnabled && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">말하기 연습</span>
            {result.recording_score !== null && result.recording_total
              ? getScoreBadge(result.recording_score, result.recording_total)
              : <Badge variant="secondary">대기 중</Badge>}
          </div>
        )}
      </div>
    );
  };

  const renderNameCell = (result: typeof filteredResults[0]) => (
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
  );

  const renderMobileScoreCell = (result: typeof filteredResults[0]) => {
    if (!isMultiStage) {
      return getScoreBadge(result.fill_blank_score ?? result.score, result.fill_blank_total ?? result.total_questions);
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">빈칸</span>
          {result.fill_blank_score !== null && result.fill_blank_total
            ? getScoreBadge(result.fill_blank_score, result.fill_blank_total)
            : <span className="text-muted-foreground">-</span>}
        </div>
        {sentenceMakingEnabled && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">문장</span>
            {result.sentence_making_score !== null && result.sentence_making_total
              ? getScoreBadge(result.sentence_making_score, result.sentence_making_total)
              : <Badge variant="secondary">대기 중</Badge>}
          </div>
        )}
        {recordingEnabled && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">말하기</span>
            {result.recording_score !== null && result.recording_total
              ? getScoreBadge(result.recording_score, result.recording_total)
              : <Badge variant="secondary">대기 중</Badge>}
          </div>
        )}
      </div>
    );
  };

  const renderMobileCard = (result: typeof filteredResults[0]) => (
    <div key={result.id} className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        {renderNameCell(result)}
        <Button variant="ghost" size="icon" onClick={() => setSelectedResultId(result.id)}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
      <div>{renderMobileScoreCell(result)}</div>
      <div className="text-xs text-muted-foreground">
        <SubmissionTimeCell
          result={result}
          sentenceMakingEnabled={sentenceMakingEnabled ?? false}
          recordingEnabled={recordingEnabled ?? false}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>총 {results.length}건의 제출</span>
          {results.length > 0 && (
            <span>
              (평균: {Math.round(results.reduce((acc, curr) => acc + getCombinedPercent(curr), 0) / results.length)}점)
            </span>
          )}
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="flex-1 sm:w-[120px]">
              <SelectValue placeholder="필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 보기</SelectItem>
              <SelectItem value="student">학생</SelectItem>
              <SelectItem value="anonymous">익명</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
            <SelectTrigger className="flex-1 sm:w-[120px]">
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

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {filteredResults.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">제출된 결과가 없습니다</p>
        ) : (
          filteredResults.map(renderMobileCard)
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>점수</TableHead>
              <TableHead>제출 시간</TableHead>
              <TableHead className="text-right whitespace-nowrap">상세보기</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  제출된 결과가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              filteredResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">
                    {renderNameCell(result)}
                  </TableCell>
                  <TableCell>
                    {renderScoreCell(result)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <SubmissionTimeCell
                      result={result}
                      sentenceMakingEnabled={sentenceMakingEnabled ?? false}
                      recordingEnabled={recordingEnabled ?? false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedResultId(result.id)}>
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
      <QuizResultDialog
        isOpen={!!selectedResult}
        onClose={() => setSelectedResultId(null)}
        result={selectedResult}
        studentName={selectedResult ? (selectedResult.is_anonymous ? selectedResult.anonymous_name || "익명" : selectedResult.student_profile?.name || "알 수 없음") : ""}
        isAnonymous={selectedResult?.is_anonymous}
        quizId={quizId}
        onDataChanged={refresh}
      />
    </div>
  );
}
