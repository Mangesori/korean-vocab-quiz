import { ReactNode } from 'react';

export type Stat = { label: string; value: string; note?: string; noteClass?: string };

interface StatStripProps {
  stats: Stat[];
  children?: ReactNode;
}

// 지표 스트립(카드 4개 대체) — docs/handoff-admin-library/snippets/01_common.md 그대로.
// 2단계(5a/5b 디자인 적용)에서 대시보드/사용자 관리 페이지에 적용할 컴포넌트라,
// 이 1단계(탭 분리)에서는 아직 어디에서도 렌더하지 않는다.
export function StatStrip({ stats, children }: StatStripProps) {
  return (
    <div className="flex divide-x divide-border rounded-xl border border-border bg-card">
      {stats.map((s) => (
        <div key={s.label} className="flex-1 px-5 py-4">
          <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
          <div className="mt-1 text-[26px] font-extrabold tracking-tight tabular-nums">{s.value}</div>
          {s.note && <div className={`text-xs ${s.noteClass ?? 'text-muted-foreground'}`}>{s.note}</div>}
        </div>
      ))}
      {children /* 역할 구성 스택 바 등 마지막 칸 */}
    </div>
  );
}

// 역할 구성 스택 바 등에서 쓰는 범례 한 항목.
export const StatStripLegend = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <span className={`h-[7px] w-[7px] rounded-full ${className}`} />
    {children}
  </span>
);
