import type { LucideIcon } from "lucide-react";

export type HelpRole = "teacher" | "student";

/** 도움말 카테고리 키. 선생님/학생 역할별로 겹치지 않는 고정 목록이다. */
export type HelpCategoryKey =
  | "t_start"
  | "t_create"
  | "t_class"
  | "t_share"
  | "t_result"
  | "t_account"
  | "s_start"
  | "s_type"
  | "s_speak"
  | "s_result"
  | "s_review"
  | "s_account";

export interface HelpShot {
  /** 브라우저 크롬 바에 표시할 캡션 */
  caption: string;
}

export interface HelpStep {
  title: string;
  body: string;
  /** 캡처 스펙. 없으면 이미지 슬롯을 렌더하지 않는다.
   *  파일명은 shot-<articleId>-<stepNumber>.png 로 자동 도출한다
   *  (src/data/help/index.ts의 shotPath가 유일한 파일명 생성처다). */
  shot?: HelpShot;
}

export interface HelpArticle {
  id: string;
  role: HelpRole;
  categoryKey: string;
  title: string;
  summary: string;
  intro: string;
  /** 보통 3단계. 단계 수는 문서마다 다를 수 있고(예: t-firstquiz는 4단계),
   *  scripts/help-shots/verify.ts가 2~4 범위인지 검사한다. */
  steps: HelpStep[];
  tip: string;
  caution?: string;
  related: string[]; // 다른 article id들
}

export interface HelpFaq {
  q: string;
  a: string;
}

export interface HelpCategory {
  key: HelpCategoryKey;
  role: HelpRole;
  label: string;
  icon: LucideIcon;
  articleIds: string[];
}
