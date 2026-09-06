import { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

interface AdminPageShellProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

// 관리자 5개 페이지(대시보드·사용자·선생님·리포트·피드백) 공통 레이아웃.
// 제목 + (옵션) 우측 요약/액션 + 본문. 이번 단계는 순수 이동이라 마크업은
// 기존 AdminDashboard.tsx 헤더 그대로이고, `right`는 2단계 디자인 적용 때
// 쓰기 위해 미리 열어둔 자리다(지금은 아무 페이지도 넘기지 않는다).
export function AdminPageShell({ title, right, children }: AdminPageShellProps) {
  return (
    <AppLayout>
      <div className="px-[18px] sm:px-[30px] py-[26px] sm:py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground pl-2">{title}</h1>
          {right}
        </div>
        {children}
      </div>
    </AppLayout>
  );
}
