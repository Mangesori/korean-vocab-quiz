import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/lib/rbac/roles';

interface ProtectProps {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Protect({ permission, fallback = null, children }: ProtectProps) {
  const { can } = usePermissions();
  
  if (!can(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
