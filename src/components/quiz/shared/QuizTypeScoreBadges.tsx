import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";

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
  /** 빈칸은 명시적으로 false일 때만 숨긴다(기본 표시). */
  fillBlankEnabled?: boolean;
  matchupEnabled?: boolean;
  typeAnswerEnabled?: boolean;
  wordMagnetEnabled?: boolean;
  sentenceMakingEnabled?: boolean;
  recordingEnabled?: boolean;
  /** 3 = 선생님 데스크톱, 2 = 모바일·학생 대시보드, 1 = 세로 나열. */
  columns?: 1 | 2 | 3;
}

// 점수 배지 색: ≥90 초록 · ≥70 노랑 · 그 외 빨강. (기존 QuizResultsList getScoreBadge와 동일)
function scoreBadge(score: number, total: number) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct >= 90) return <Badge className="bg-green-500 hover:bg-green-600">{score}/{total}</Badge>;
  if (pct >= 70) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{score}/{total}</Badge>;
  return <Badge className="bg-red-500 hover:bg-red-600">{score}/{total}</Badge>;
}

type Item = {
  key: string;
  label: string;
  score?: number | null;
  total?: number | null;
  /** 채점 대기 유형(문장 만들기·말하기)은 미제출 배지, 그 외는 "-". */
  pending?: boolean;
};

/**
 * enabled(포함)된 유형만 `[라벨 · 점수 배지]`로 렌더한다.
 * 세로 3열×2줄 고정 레이아웃: 각 열은 [라벨 트랙 | 배지 트랙] 쌍이고,
 * 라벨은 좌측정렬하여 왼쪽 끝이 정갈하게 세로 정렬된다.
 * columns prop은 호환을 위해 남겨 두지만, 렌더에서 무시한다(세로 3열 고정).
 */
export function QuizTypeScoreBadges({
  result,
  fillBlankEnabled,
  matchupEnabled,
  typeAnswerEnabled,
  wordMagnetEnabled,
  sentenceMakingEnabled,
  recordingEnabled,
  columns: _columns = 3, // 세로 3열 고정, columns 미사용
}: QuizTypeScoreBadgesProps) {
  const items: Item[] = [];
  if (fillBlankEnabled !== false)
    items.push({ key: "fb", label: "빈칸 채우기", score: result.fill_blank_score, total: result.fill_blank_total });
  if (matchupEnabled)
    items.push({ key: "mu", label: "짝 맞추기", score: result.matchup_score, total: result.matchup_total });
  if (typeAnswerEnabled)
    items.push({ key: "ta", label: "단어 받아쓰기", score: result.type_answer_score, total: result.type_answer_total });
  if (wordMagnetEnabled)
    items.push({ key: "wm", label: "문장 순서 맞추기", score: result.word_magnet_score, total: result.word_magnet_total });
  if (sentenceMakingEnabled)
    items.push({ key: "sm", label: "문장 만들기", score: result.sentence_making_score, total: result.sentence_making_total, pending: true });
  if (recordingEnabled)
    items.push({ key: "rec", label: "말하기 연습", score: result.recording_score, total: result.recording_total, pending: true });

  // 3열 고정: 각 열은 [라벨(max-content) 배지(max-content)] 쌍 → 총 6트랙
  // 열 사이 간격은 라벨의 pl-4로 확보, 트랙 간은 gap-x-1.5
  const cols = 3;
  const gridTemplateColumns = Array.from({ length: cols }, () => "max-content max-content").join(" ");

  return (
    <div className="grid gap-x-1.5 gap-y-1 items-center w-fit text-xs" style={{ gridTemplateColumns }}>
      {items.map((it, i) => (
        <Fragment key={it.key}>
          <span
            className={`text-muted-foreground whitespace-nowrap ${i % cols !== 0 ? "pl-4" : ""}`}
          >
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
