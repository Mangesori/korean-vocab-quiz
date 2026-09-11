import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface PendingTeacherApplication {
  id: string;
  user_id: string;
  created_at: string;
}

export interface AdminQueue {
  pendingApplications: PendingTeacherApplication[];
  unreadFeedbackCount: number;
}

// 사이드바 배지(선생님 관리·피드백)와 /admin/teachers 페이지의 "검토 대기" 목록이
// 같은 값을 보도록 쿼리 키(['admin','queue'])를 공유한다. 승인/거절 후
// invalidateQueries(['admin','queue'])만 호출하면 사이드바와 페이지가 동시에 갱신된다.
//
// 실제 테이블명 주의: 문서(08_routing_and_sidebar.md)가 예시로 든 `admin_teacher_applications`
// 뷰는 이 프로젝트에 없다. 이미 존재하는 실제 테이블 `teacher_applications`를 그대로 쓴다.
// `feedback` 테이블의 읽음 여부는 `read` 컬럼이 아니라 `read_at timestamptz`이므로
// `.is('read_at', null)`로 안 읽은 건수를 센다.
export function useAdminQueue() {
  const { role } = useAuth();

  return useQuery({
    queryKey: ['admin', 'queue'],
    enabled: role === 'admin',
    staleTime: 60_000,
    queryFn: async (): Promise<AdminQueue> => {
      const [{ data: apps, error: appsError }, { count: unreadFeedbackCount, error: feedbackError }] =
        await Promise.all([
          supabase
            .from('teacher_applications')
            .select('id, user_id, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
          supabase
            .from('feedback')
            .select('id', { count: 'exact', head: true })
            .is('read_at', null),
        ]);

      if (appsError) throw appsError;
      if (feedbackError) throw feedbackError;

      return {
        pendingApplications: (apps ?? []) as PendingTeacherApplication[],
        unreadFeedbackCount: unreadFeedbackCount ?? 0,
      };
    },
  });
}
