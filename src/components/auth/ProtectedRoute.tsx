import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
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
  const { can } = usePermissions();
  
  if (!can(permission)) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return <>{children}</>;
}
