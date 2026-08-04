import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';

export default function Dashboard() {
  const { user, roleResolved, loading } = useAuth();

  const { can } = usePermissions();

  // 역할 조회가 끝나기 전에는 판단하지 않는다.
  // (조회 중인 role === null을 "역할 없음"으로 보고 /auth/callback으로 보내면
  //  콜백이 다시 /dashboard로 돌려보내 무한 리다이렉트 → 흰 화면이 된다.)
  if (loading || (user && !roleResolved)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Teachers and Admins see the TeacherDashboard
  if (can(PERMISSIONS.CREATE_QUIZ)) {
    return <TeacherDashboard />;
  }

  // Students see the StudentDashboard
  if (can(PERMISSIONS.JOIN_CLASS)) {
    return <StudentDashboard />;
  }

  // Role not set yet — send to callback so it can prompt for role selection
  return <Navigate to="/auth/callback" replace />;
}
