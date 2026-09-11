import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, Shield } from 'lucide-react';

// 원래 AdminDashboard.tsx의 getRoleBadge()였다. 사용자 표(UserTable)가
// 대시보드/사용자/선생님 3개 페이지에서 공유되므로 배지도 같이 뽑아냈다.
export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'admin':
      return (
        <Badge variant="destructive" className="gap-1">
          <Shield className="h-3 w-3" />관리자
        </Badge>
      );
    case 'teacher':
      return (
        <Badge variant="default" className="gap-1">
          <GraduationCap className="h-3 w-3" />선생님
        </Badge>
      );
    case 'student':
      return (
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />학생
        </Badge>
      );
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}
