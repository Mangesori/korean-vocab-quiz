export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSIONS = {
  // 퀴즈 권한
  CREATE_QUIZ: 'create_quiz',
  EDIT_QUIZ: 'edit_quiz',
  DELETE_QUIZ: 'delete_quiz',
  VIEW_QUIZ: 'view_quiz',
  SHARE_QUIZ: 'share_quiz',
  
  // 클래스 권한
  CREATE_CLASS: 'create_class',
  EDIT_CLASS: 'edit_class',
  DELETE_CLASS: 'delete_class',
  VIEW_CLASS: 'view_class',
  JOIN_CLASS: 'join_class',
  
  // 관리자 권한
  MANAGE_USERS: 'manage_users',
  VIEW_ANALYTICS: 'view_analytics',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// 스키마에 "최고 관리자" 역할이 따로 없어서(role은 admin/teacher/student뿐) 이메일로 구분한다.
// 운영진이 여러 명이 되면 role 컬럼에 super_admin을 추가하는 쪽으로 옮길 것.
export const SUPER_ADMIN_EMAIL = 'vaporware01@gmail.com';
