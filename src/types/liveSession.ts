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
  /**
   * 문항별 현재 입력값(문제 순서대로). 아직 다 안 친 글자도 그대로 들어간다 —
   * 선생님이 "지금 치고 있는 중"을 문항 제자리에서 보기 위해서다.
   * watchScreens가 꺼져 있으면 빈 배열로 보낸다.
   */
  answers: string[];
  /** 지금 만지고 있는 문항 번호. 커서를 어디에 그릴지 결정한다. -1이면 없음. */
  activeIndex: number;
  /**
   * 정답 여부. 풀이 중엔 전부 null이다 — 학생 화면에 정답을 내려주지 않으므로
   * 클라이언트가 채점할 수 없다.
   */
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
