import {
  Rocket,
  PenSquare,
  Users,
  Link2,
  BarChart3,
  Settings,
  UserPlus,
  ListChecks,
  Mic,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import type { HelpCategory, HelpRole } from "./types";

// 역할별 카테고리 그룹. articleIds는 홈 화면 카테고리 카드에 표시할 순서다.
// 모든 article은 정확히 하나의 카테고리에 속해야 한다(검증: scripts/help-shots/verify.ts).
export const CATEGORY_GROUPS: Record<HelpRole, HelpCategory[]> = {
  teacher: [
    { key: "t_start", role: "teacher", label: "시작하기", icon: Rocket, articleIds: ["t-signup", "t-firstquiz"] },
    {
      key: "t_create",
      role: "teacher",
      label: "퀴즈 만들기",
      icon: PenSquare,
      articleIds: ["t-words", "t-prompt", "t-types", "t-edit"],
    },
    {
      key: "t_class",
      role: "teacher",
      label: "클래스 관리",
      icon: Users,
      articleIds: ["t-createclass", "t-invite", "t-classstatus"],
    },
    { key: "t_share", role: "teacher", label: "공유 · 배포", icon: Link2, articleIds: ["t-share"] },
    {
      key: "t_result",
      role: "teacher",
      label: "결과 · 분석",
      icon: BarChart3,
      articleIds: ["t-results", "t-wronganswer"],
    },
    { key: "t_account", role: "teacher", label: "계정 설정", icon: Settings, articleIds: ["t-profile"] },
  ],
  student: [
    { key: "s_start", role: "student", label: "가입 · 참여", icon: UserPlus, articleIds: ["s-signup", "s-join"] },
    { key: "s_type", role: "student", label: "퀴즈 풀기", icon: ListChecks, articleIds: ["s-types", "s-fill"] },
    { key: "s_speak", role: "student", label: "발음 · 녹음", icon: Mic, articleIds: ["s-speak", "s-mic"] },
    { key: "s_result", role: "student", label: "결과 확인", icon: CheckCircle2, articleIds: ["s-result"] },
    {
      key: "s_review",
      role: "student",
      label: "오답 복습",
      icon: RotateCcw,
      articleIds: ["s-notebook", "s-practice"],
    },
    { key: "s_account", role: "student", label: "계정 설정", icon: Settings, articleIds: ["s-profile"] },
  ],
};
