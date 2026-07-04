import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Permission } from '@/lib/rbac/roles';

interface ProtectedRouteProps {
  permission: Permission;
  redirectTo?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({
  permission,
  redirectTo = '/dashboard',
  children
}: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { can } = usePermissions();

  // 세션·역할 복원 중에는 리다이렉트하지 않고 로딩만 표시한다.
  // (새 탭/새로고침 시 정보가 도착하기 전에 /auth로 튕기는 문제 방지)
  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 복원이 끝났는데 로그인 안 한 사용자는 로그인 화면으로.
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 로그인은 했지만 권한이 없으면 지정된 화면으로.
  if (!can(permission)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
