import { useState } from "react";
import { useQuizResults, QuizResult } from "@/hooks/useQuizResults";
import { formatDateFull } from "@/lib/formatDate";
import { useSubmissionTimes } from "@/hooks/useSubmissionTimes";
import { getCombinedPercent } from "@/lib/quizScore";
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
import { QuizTypeScoreBadges } from "@/components/quiz/shared/QuizTypeScoreBadges";
import { Link } from "react-router-dom";
import { useQuizAssignments } from "@/hooks/useQuizAssignments";

interface SubmissionTimeCellProps {
  result: QuizResult;
  matchupEnabled: boolean;
  typeAnswerEnabled: boolean;
  wordMagnetEnabled: boolean;
  sentenceMakingEnabled: boolean;
  recordingEnabled: boolean;
}

function SubmissionTimeCell({
  result,
  matchupEnabled,
  typeAnswerEnabled,
  wordMagnetEnabled,
  sentenceMakingEnabled,
  recordingEnabled,
}: SubmissionTimeCellProps) {
  const isMultiStage = matchupEnabled || typeAnswerEnabled || wordMagnetEnabled || sentenceMakingEnabled || recordingEnabled;
  const { times, isLoading } = useSubmissionTimes(result.id, result.completed_at, {
    matchupEnabled,
    typeAnswerEnabled,
    wordMagnetEnabled,
    sentenceMakingEnabled,
    recordingEnabled,
  });

  const formattedDate = formatDateFull(result.completed_at);

  if (!isMultiStage) {
    return <span>{formattedDate}</span>;
  }

  // 제출 시간 = 마지막으로 완료된 스테이지 시각. 첫 스테이지 시각(completed_at)만
  // 쓰면 여러 날에 걸쳐 끝낸 퀴즈가 "하루 만에 끝냈다"처럼 보인다.
  const displayDate = times ? formatDateFull(times.latest) : formattedDate;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-sm underline decoration-dotted underline-offset-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          {isLoading ? formattedDate : displayDate}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : times ? (
          <div className="space-y-2 text-sm">
            {matchupEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">짝 맞추기</span>
                <span className="font-medium tabular-nums whitespace-nowrap">
                  {times.matchup ? formatDateFull(times.matchup) : "미제출"}
                </span>
              </div>
            )}
            {typeAnswerEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">단어 받아쓰기</span>
                <span className="font-medium tabular-nums whitespace-nowrap">
                  {times.typeAnswer ? formatDateFull(times.typeAnswer) : "미제출"}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground whitespace-nowrap">빈칸 채우기</span>
              <span className="font-medium tabular-nums whitespace-nowrap">
                {formatDateFull(times.fillBlank)}
              </span>
            </div>
            {wordMagnetEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">문장 순서 맞추기</span>
                <span className="font-medium tabular-nums whitespace-nowrap">
                  {times.wordMagnet ? formatDateFull(times.wordMagnet) : "미제출"}
                </span>
              </div>
            )}
            {sentenceMakingEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">문장 만들기</span>
                <span className="font-medium tabular-nums whitespace-nowrap">
                  {times.sentenceMaking
                    ? formatDateFull(times.sentenceMaking)
                    : "미제출"}
                </span>
              </div>
            )}
            {recordingEnabled && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">말하기 연습</span>
                <span className="font-medium tabular-nums whitespace-nowrap">
                  {times.recording
                    ? formatDateFull(times.recording)
                    : "미제출"}
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
  fillBlankEnabled?: boolean;
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  matchupEnabled?: boolean;
  typeAnswerEnabled?: boolean;
  wordMagnetEnabled?: boolean;
}

export function QuizResultsList({ quizId, fillBlankEnabled, sentenceMakingEnabled, recordingEnabled, matchupEnabled, typeAnswerEnabled, wordMagnetEnabled }: QuizResultsListProps) {
  const { results, isLoading, refresh } = useQuizResults(quizId);
  const { assignedClasses, isLoading: assignmentsLoading } = useQuizAssignments(quizId);
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
        return getCombinedPercent(b) - getCombinedPercent(a);
      }
      if (sortOrder === "score_low") {
        return getCombinedPercent(a) - getCombinedPercent(b);
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

  const isMultiStage = sentenceMakingEnabled || recordingEnabled || matchupEnabled || typeAnswerEnabled || wordMagnetEnabled;

  const renderScoreCell = (result: typeof filteredResults[0]) => {
    if (!isMultiStage) {
      return getScoreBadge(result.fill_blank_score ?? result.score, result.fill_blank_total ?? result.total_questions);
    }
    return (
      <QuizTypeScoreBadges
        result={result}
        fillBlankEnabled={fillBlankEnabled}
        matchupEnabled={matchupEnabled}
        typeAnswerEnabled={typeAnswerEnabled}
        wordMagnetEnabled={wordMagnetEnabled}
        sentenceMakingEnabled={sentenceMakingEnabled}
        recordingEnabled={recordingEnabled}
        columns={3}
      />
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
      <QuizTypeScoreBadges
        result={result}
        fillBlankEnabled={fillBlankEnabled}
        matchupEnabled={matchupEnabled}
        typeAnswerEnabled={typeAnswerEnabled}
        wordMagnetEnabled={wordMagnetEnabled}
        sentenceMakingEnabled={sentenceMakingEnabled}
        recordingEnabled={recordingEnabled}
        columns={2}
      />
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
          matchupEnabled={matchupEnabled ?? false}
          typeAnswerEnabled={typeAnswerEnabled ?? false}
          wordMagnetEnabled={wordMagnetEnabled ?? false}
          sentenceMakingEnabled={sentenceMakingEnabled ?? false}
          recordingEnabled={recordingEnabled ?? false}
        />
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-8 space-y-2">
      <p className="text-muted-foreground text-sm">아직 제출한 학생이 없어요</p>
      {assignmentsLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
      ) : assignedClasses.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">이 퀴즈는 다음 클래스에 배정되어 있어요</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {assignedClasses.map((c) => (
              <Link
                key={c.id}
                to={`/class/${c.id}`}
                className="text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors rounded-full px-3 py-1"
              >
                {c.name} · {c.memberCount}명
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">아직 어떤 클래스에도 배정하지 않았어요. 공유 링크를 보내거나 클래스에 배정해 보세요</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>총 {results.length}건의 제출</span>
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
          renderEmptyState()
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
                      matchupEnabled={matchupEnabled ?? false}
                      typeAnswerEnabled={typeAnswerEnabled ?? false}
                      wordMagnetEnabled={wordMagnetEnabled ?? false}
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
