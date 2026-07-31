import type { HelpArticleId } from "./articles";
import type { HelpRole } from "./types";

// 홈 화면 "자주 찾는 문서" — 역할별 정확히 3개.
// 요금제·사용량 문서(t-plan, 삭제됨)는 제외한다. 도움말이 아니라 요금제 페이지의 몫이다.
export const POPULAR: Record<HelpRole, HelpArticleId[]> = {
  teacher: ["t-firstquiz", "t-share", "t-invite"],
  student: ["s-join", "s-speak", "s-mic"],
};
