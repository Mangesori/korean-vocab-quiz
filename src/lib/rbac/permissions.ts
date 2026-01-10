import { ROLES, PERMISSIONS, Role, Permission } from './roles';

const rolePermissions: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: [
    // 관리자는 모든 권한 보유
    ...Object.values(PERMISSIONS),
  ],
  [ROLES.TEACHER]: [
    PERMISSIONS.CREATE_QUIZ,
    PERMISSIONS.EDIT_QUIZ,
    PERMISSIONS.DELETE_QUIZ,
    PERMISSIONS.VIEW_QUIZ,
    PERMISSIONS.SHARE_QUIZ,
    PERMISSIONS.CREATE_CLASS,
    PERMISSIONS.EDIT_CLASS,
    PERMISSIONS.DELETE_CLASS,
    PERMISSIONS.VIEW_CLASS,
  ],
  [ROLES.STUDENT]: [
    PERMISSIONS.VIEW_QUIZ,
    PERMISSIONS.VIEW_CLASS,
    PERMISSIONS.JOIN_CLASS,
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}
