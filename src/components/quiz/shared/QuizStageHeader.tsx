import { ReactNode } from "react";

interface QuizStageHeaderProps {
  /** 중앙 안내문구. 유형별 한 문장 */
  instruction: ReactNode;
  /** 좌측 유형 배지 (없으면 자리만 유지) */
  badge?: ReactNode;
  /** 우측 액션 — 현재는 힌트 버튼만 (없으면 자리만 유지) */
  action?: ReactNode;
}

/**
 * 퀴즈 풀이 화면 공통 헤더 줄.
 *
 * 좌/우를 flex-1로 균등 분배해 배지·힌트 유무와 관계없이 안내문구가 항상 정확히 가운데 온다.
 * min-h를 고정하는 이유: 배지·힌트가 없는 유형(문장 순서 만들기)에서도 줄 높이가 같아야
 * 유형 전환 시 안내문구가 위아래로 튀지 않는다.
 *
 * 회색 박스(bg-slate-50) 바깥, 카드 콘텐츠 최상단에 둔다.
 */
export function QuizStageHeader({ instruction, badge, action }: QuizStageHeaderProps) {
  return (
    <div className="flex w-full items-center gap-2 min-h-[2.25rem] sm:min-h-[2.5rem]">
      <div className="flex flex-1 justify-start">{badge}</div>
      <p className="text-sm sm:text-base lg:text-lg font-bold text-foreground text-center break-keep">
        {instruction}
      </p>
      <div className="flex flex-1 justify-end">{action}</div>
    </div>
  );
}
