import { useAuth } from './useAuth';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/rbac/permissions';
import { Permission, Role } from '@/lib/rbac/roles';

export function usePermissions() {
  const { role } = useAuth();
  
  return {
    can: (permission: Permission) => hasPermission(role as Role, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(role as Role, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(role as Role, permissions),
    role: role as Role,
  };
}
