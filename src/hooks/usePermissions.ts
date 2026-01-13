import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/rbac/permissions';
import { Permission, Role } from '@/lib/rbac/roles';

export function usePermissions() {
  const { role } = useAuth();
  
  const can = useCallback((permission: Permission) => hasPermission(role as Role, permission), [role]);
  const canAny = useCallback((permissions: Permission[]) => hasAnyPermission(role as Role, permissions), [role]);
  const canAll = useCallback((permissions: Permission[]) => hasAllPermissions(role as Role, permissions), [role]);

  return {
    can,
    canAny,
    canAll,
    role: role as Role,
  };
}
