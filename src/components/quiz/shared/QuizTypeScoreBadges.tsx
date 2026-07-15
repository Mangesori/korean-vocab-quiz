import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { BaseStage, STAGE_LABELS, STAGE_ORDER, isStageEnabled } from "@/types/quiz";

/** 결과 한 건의 유형별 score/total. 선생님 결과 목록·학생 대시보드가 공유한다. */
export interface QuizTypeScores {
  fill_blank_score?: number | null;
  fill_blank_total?: number | null;
  matchup_score?: number | null;
  matchup_total?: number | null;
  type_answer_score?: number | null;
  type_answer_total?: number | null;
  word_magnet_score?: number | null;
  word_magnet_total?: number | null;
  sentence_making_score?: number | null;
  sentence_making_total?: number | null;
  recording_score?: number | null;
  recording_total?: number | null;
}

interface QuizTypeScoreBadgesProps {
  result: QuizTypeScores;
  /** 빈칸은 명시적으로 false일 때만 숨긴다(기본 표시). isStageEnabled의 fill_blank 규칙과 동일. */
  fillBlankEnabled?: boolean;
  matchupEnabled?: boolean;
  typeAnswerEnabled?: boolean;
  wordMagnetEnabled?: boolean;
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  /** 3 = 선생님 데스크톱, 2 = 모바일·학생 대시보드, 1 = 세로 나열. */
  columns?: 1 | 2 | 3;
}

// 점수 배지 색: ≥90 초록 · ≥70 노랑 · 그 외 빨강.
// QuizResult.tsx의 유형별 점수 색과 같은 기준을 쓴다(화면 간 색 불일치 방지).
function scoreBadge(score: number, total: number) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct >= 90)
    return <Badge className="bg-success hover:bg-success/90 text-success-foreground">{score}/{total}</Badge>;
  if (pct >= 70)
    return <Badge className="bg-warning hover:bg-warning/90 text-warning-foreground">{score}/{total}</Badge>;
  return <Badge className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{score}/{total}</Badge>;
}

// 스테이지 → quiz_results의 점수/총점 컬럼명.
const STAGE_SCORE_FIELDS: Record<BaseStage, { score: keyof QuizTypeScores; total: keyof QuizTypeScores }> = {
  matchup: { score: "matchup_score", total: "matchup_total" },
  type_answer: { score: "type_answer_score", total: "type_answer_total" },
  fill_blank: { score: "fill_blank_score", total: "fill_blank_total" },
  word_magnet: { score: "word_magnet_score", total: "word_magnet_total" },
  sentence_making: { score: "sentence_making_score", total: "sentence_making_total" },
  recording: { score: "recording_score", total: "recording_total" },
};

// 채점 대기가 존재하는 유형(AI 채점) — 점수가 없으면 "-" 대신 "미제출" 배지.
const PENDING_STAGES: BaseStage[] = ["sentence_making", "recording"];

/**
 * enabled(포함)된 유형만 `[라벨 · 점수 배지]`로 렌더한다. 순서는 STAGE_ORDER(정규 순서).
 * 각 열은 [라벨 트랙 | 배지 트랙] 쌍이고, 라벨은 좌측정렬하여 왼쪽 끝이 세로 정렬된다.
 * 열 수는 columns prop을 따른다(3 = 데스크톱, 2 = 모바일·학생 대시보드, 1 = 세로 나열).
 */
export function QuizTypeScoreBadges({
  result,
  fillBlankEnabled,
  matchupEnabled,
  typeAnswerEnabled,
  wordMagnetEnabled,
  sentenceMakingEnabled,
  recordingEnabled,
  columns = 3,
}: QuizTypeScoreBadgesProps) {
  // isStageEnabled가 기대하는 DB 컬럼명 형태로 맞춰서 판정을 단일 소스로 위임한다.
  // (fill_blank만 "명시적 false가 아니면 활성", 나머지는 "true여야 활성")
  const enabledRecord: Record<string, unknown> = {
    fill_blank_enabled: fillBlankEnabled,
    matchup_enabled: matchupEnabled,
    type_answer_enabled: typeAnswerEnabled,
    word_magnet_enabled: wordMagnetEnabled,
    sentence_making_enabled: sentenceMakingEnabled,
    recording_enabled: recordingEnabled,
  };

  const items = STAGE_ORDER.filter((stage) => isStageEnabled(stage, enabledRecord)).map((stage) => {
    const fields = STAGE_SCORE_FIELDS[stage];
    return {
      stage,
      label: STAGE_LABELS[stage],
      score: result[fields.score],
      total: result[fields.total],
      pending: PENDING_STAGES.includes(stage),
    };
  });

  // 각 열은 [라벨(max-content) 배지(max-content)] 쌍 → 총 columns×2 트랙
  // 열 사이 간격은 라벨의 pl-4로 확보, 트랙 간은 gap-x-1.5
  const cols = columns;
  const gridTemplateColumns = Array.from({ length: cols }, () => "max-content max-content").join(" ");

  return (
    <div className="grid gap-x-1.5 gap-y-1 items-center w-fit text-xs" style={{ gridTemplateColumns }}>
      {items.map((it, i) => (
        <Fragment key={it.stage}>
          <span className={`text-muted-foreground whitespace-nowrap ${i % cols !== 0 ? "pl-4" : ""}`}>
            {it.label}
          </span>
          {it.score !== null && it.score !== undefined && it.total
            ? scoreBadge(it.score, it.total)
            : it.pending
            ? <Badge variant="secondary">미제출</Badge>
            : <span className="text-muted-foreground">-</span>}
        </Fragment>
      ))}
    </div>
  );
}
