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
import { Button } from "@/components/ui/button";
import { Loader2, Eye } from "lucide-react";
import { QuizResultDialog } from "@/components/quiz/QuizResultDialog";
import { STAGE_ORDER, STAGE_LABELS, isStageEnabled, BaseStage } from "@/types/quiz";

// 카드 안 "8월 17일" 짧은 날짜 — formatDateShort는 연도까지 붙어 카드 한 줄엔 길다.
function formatMonthDay(date: string | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return format(d, "M월 d일", { locale: ko });
}

// 헤더 메타 "마지막 제출 N일 전" 계산.
function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// 스테이지 → StudentQuizActivity의 점수/총점 필드명 (필드명이 그대로 같아서 매핑만 필요).
const STAGE_SCORE_FIELDS: Record<BaseStage, { score: keyof StudentQuizActivity; total: keyof StudentQuizActivity }> = {
  matchup: { score: "matchup_score", total: "matchup_total" },
  type_answer: { score: "type_answer_score", total: "type_answer_total" },
  fill_blank: { score: "fill_blank_score", total: "fill_blank_total" },
  word_magnet: { score: "word_magnet_score", total: "word_magnet_total" },
  sentence_making: { score: "sentence_making_score", total: "sentence_making_total" },
  recording: { score: "recording_score", total: "recording_total" },
};

// 유형 칩 색 — 15_classes_and_students.md 15-2 표 그대로. 70% 미만이면 "낮음"
// (QuizTypeScoreBadges의 3단계 배지에서 빨강으로 갈리는 경계와 같은 기준).
function TypeChip({ stage, activity }: { stage: BaseStage; activity: StudentQuizActivity }) {
  const fields = STAGE_SCORE_FIELDS[stage];
  const score = activity[fields.score] as number | null;
  const total = activity[fields.total] as number | null;
  const label = STAGE_LABELS[stage];

  if (score === null || score === undefined || !total) {
    return (
      <span
        className="inline-flex items-baseline gap-[7px] rounded-[8px] px-[11px] py-[7px]"
        style={{ background: "#F5F1EB" }}
      >
        <span className="text-[11.5px] font-semibold" style={{ color: "#8A837D" }}>
          {label}
        </span>
        <span className="text-[11.5px] font-semibold" style={{ color: "#A29B94" }}>
          미완료
        </span>
      </span>
    );
  }

  const pct = total > 0 ? (score / total) * 100 : 0;
  const low = pct < 70;

  return (
    <span
      className="inline-flex items-baseline gap-[7px] rounded-[8px] px-[11px] py-[7px]"
      style={{ background: low ? "#FBEFE9" : "#E8F1EB" }}
    >
      <span className="text-[11.5px] font-semibold" style={{ color: low ? "#8A6A5C" : "#5C7D6C" }}>
        {label}
      </span>
      <span className="text-[12.5px] font-bold" style={{ color: low ? "#B4552D" : "#1E6B47" }}>
        {score}/{total}
      </span>
    </span>
  );
}

// 아직 안 푼 퀴즈 카드의 칩 — 점수 없이 유형 이름만.
function PendingTypeChip({ stage }: { stage: BaseStage }) {
  return (
    <span
      className="inline-flex items-baseline rounded-[8px] px-[11px] py-[7px] text-[11.5px] font-semibold"
      style={{ background: "#F5F1EB", color: "#8A837D" }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function QuizCard({
  activity,
  onViewDetail,
}: {
  activity: StudentQuizActivity;
  onViewDetail: () => void;
}) {
  const enabledStages = STAGE_ORDER.filter((stage) =>
    isStageEnabled(stage, activity as unknown as Record<string, unknown>)
  );

  if (activity.status !== "completed") {
    return (
      <div
        className="rounded-[14px] px-[18px] py-4"
        style={{ border: "1px solid #EBE5DE", background: "#FDFCFA" }}
      >
        <div className="flex items-start justify-between gap-[14px]">
          <div className="min-w-0">
            <div
              className="truncate text-sm font-bold"
              style={{ color: "#4A443F", letterSpacing: "-0.2px" }}
            >
              {activity.quiz_title}
            </div>
            <div className="mt-[3px] text-[11.5px]" style={{ color: "#8A837D" }}>
              {formatMonthDay(activity.assigned_at)} 배정 ·{" "}
              <span className="font-semibold" style={{ color: "#B4552D" }}>
                아직 안 풀었습니다
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-auto shrink-0 whitespace-nowrap rounded-[8px] px-[11px] py-[6px] text-[11.5px] font-semibold hover:bg-transparent"
            style={{ border: "1px solid #E3DCD3", color: "#4A443F" }}
            disabled
            // TODO: 재알림 발송 기능이 아직 없음 — 이 다이얼로그 스코프 밖. 기능 생기면 onClick 연결.
          >
            재알림
          </Button>
        </div>

        {enabledStages.length > 0 && (
          <>
            <div className="mt-[14px] pt-[13px]" style={{ borderTop: "1px solid #F2EDE7" }}>
              <div className="flex flex-wrap gap-[7px]">
                {enabledStages.map((stage) => (
                  <PendingTypeChip key={stage} stage={stage} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] px-[18px] py-4" style={{ border: "1px solid #EBE5DE" }}>
      <div className="flex items-start justify-between gap-[14px]">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ letterSpacing: "-0.2px" }}>
            {activity.quiz_title}
          </div>
          <div className="mt-[3px] text-[11.5px]" style={{ color: "#8A837D" }}>
            {formatMonthDay(activity.assigned_at)} 배정
            {activity.completed_at ? ` · ${formatMonthDay(activity.completed_at)} 제출` : ""}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-auto shrink-0 whitespace-nowrap rounded-[8px] px-[11px] py-[6px] text-[11.5px] font-bold hover:bg-transparent"
          style={{ border: "1px solid #C8DED3", color: "#1E6B47" }}
          onClick={onViewDetail}
        >
          <Eye className="mr-[6px] h-[13px] w-[13px]" />
          상세
        </Button>
      </div>

      {enabledStages.length > 0 && (
        <div className="mt-[14px] pt-[13px]" style={{ borderTop: "1px solid #F2EDE7" }}>
          <div className="flex flex-wrap gap-[7px]">
            {enabledStages.map((stage) => (
              <TypeChip key={stage} stage={stage} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const { activities, isLoading, refetch } = useStudentHistory(studentId, classId);
  // id만 state로 갖고 매 렌더링마다 최신 activities에서 찾아 파생시킨다 —
  // QuizResultsList.tsx와 동일한 패턴. useStudentHistory는 실시간 구독이 없으므로
  // 점수 변경 후에는 QuizResultDialog의 onDataChanged 콜백으로 명시적으로 refetch한다.
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const selectedResult = activities.find((a) => a.id === selectedResultId) ?? null;

  const completedActivities = activities.filter((a) => a.status === "completed");
  // activities는 이미 pending 먼저, completed는 completed_at 내림차순으로 정렬되어 있으므로
  // 맨 앞의 completed 항목이 가장 최근 제출이다.
  const lastCompleted = completedActivities[0];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto px-[26px] py-6">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold" style={{ letterSpacing: "-0.3px" }}>
              {studentName} 활동 기록
            </DialogTitle>
            <DialogDescription
              className="mt-[5px] text-[12.5px]"
              style={{ color: "#8A837D" }}
            >
              배정 {activities.length}개 · 완료 {completedActivities.length}개
              {lastCompleted?.completed_at
                ? ` · 마지막 제출 ${daysAgo(lastCompleted.completed_at)}일 전`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">배정된 퀴즈가 없습니다.</div>
          ) : (
            <div className="mt-[18px] flex flex-col gap-[10px]">
              {activities.map((activity) => (
                <QuizCard
                  key={activity.id}
                  activity={activity}
                  onViewDetail={() => setSelectedResultId(activity.id)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuizResultDialog
        isOpen={!!selectedResult}
        onClose={() => setSelectedResultId(null)}
        result={selectedResult}
        studentName={studentName}
        quizId={selectedResult?.quiz_id || ""}
        onDataChanged={refetch}
        markViewedOnOpen
      />
    </>
  );
}
