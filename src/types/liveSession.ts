import type { BaseStage } from "./quiz";

/** 라이브 세션에 쓸 수 있는 유형. 말하기 연습은 제외 —
 *  다 같이 동시에 녹음하면 소리가 섞이고, AI 채점도 즉시 나오지 않는다. */
export const LIVE_STAGES: BaseStage[] = [
  "fill_blank",
  "matchup",
  "type_answer",
  "word_magnet",
  "sentence_making",
];

export const isLiveStage = (s: BaseStage) => LIVE_STAGES.includes(s);

export type LiveSessionStatus = "waiting" | "active" | "ended";

export type LiveSessionSettings = {
  /** 선생님이 학생 풀이 과정을 볼 수 있는지. 끄면 진행률만 전송된다. */
  watchScreens: boolean;
  /** 제출한 문장을 반 전체에 공유하는지. */
  shareBoard: boolean;
  /** 이름 대신 번호로 표시. */
  anonymize: boolean;
  /** 학생마다 문제 순서를 섞을지. */
  shuffle: boolean;
  /** 로그인 없이 이름만으로 참여 가능한지. */
  allowGuests: boolean;
};

export const DEFAULT_LIVE_SETTINGS: LiveSessionSettings = {
  watchScreens: true,
  shareBoard: false,
  anonymize: false,
  shuffle: false,
  allowGuests: true,
};

export type LiveSession = {
  id: string;
  quiz_id: string;
  teacher_id: string;
  class_id: string | null;
  join_code: string;
  status: LiveSessionStatus;
  stages: BaseStage[];
  settings: LiveSessionSettings;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type LiveParticipant = {
  id: string;
  session_id: string;
  student_id: string | null;
  display_name: string;
  is_guest: boolean;
  joined_at: string;
  left_at: string | null;
};

/**
 * 풀이 중 진행 상황. DB에 저장하지 않고 Realtime broadcast로만 흐른다.
 * (타이핑할 때마다 발생하므로 테이블에 쌓으면 감당이 안 된다.)
 */
export type LiveProgress = {
  participantId: string;
  name: string;
  stage: BaseStage;
  /** 현재 문제 번호 (0-based) */
  index: number;
  /** 이 단계의 전체 문제 수 — 진행 점을 몇 개 그릴지 결정한다. */
  total: number;
  /** 지금 입력 중인 내용. watchScreens가 꺼져 있으면 빈 문자열로 보낸다. */
  typing: string;
  /**
   * 지금까지 입력한 답(문제 순서대로). 텍스트 입력형에서만 채워진다.
   * 정답 여부는 채점 전까지 알 수 없으므로 correct는 풀이 중엔 전부 null이다
   * (학생 화면에 정답을 내려주지 않기 때문).
   */
  committed: string[];
  correct: (boolean | null)[];
  done: boolean;
  /** 보낸 시각 (ms). 순서가 뒤집힌 패킷을 버리는 데 쓴다. */
  at: number;
};

/** broadcast 이벤트 이름 */
export const LIVE_EVENT = {
  /** 학생 → 전체: 진행 상황 */
  progress: "progress",
  /** 선생님 → 전체: 세션 제어 (시작/다음 단계/종료) */
  control: "control",
  /** 선생님 → 전체: 내 화면 보여주기 */
  cast: "cast",
} as const;

export type LiveControl =
  | { type: "start" }
  | { type: "stage"; stage: BaseStage }
  | { type: "end" };

/** 세션 하나당 채널 이름 */
export const liveChannel = (sessionId: string) => `live:${sessionId}`;
