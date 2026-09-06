// 관리자 5개 페이지(대시보드·사용자·선생님·리포트·피드백)가 공유하는 사용자 행 타입.
// supabase.rpc('get_user_profiles_with_email') 결과를 각 페이지가 이 모양으로 매핑해 쓴다.
export interface AdminUser {
  user_id: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
  email: string | null;
  profile: {
    name: string;
  } | null;
}
