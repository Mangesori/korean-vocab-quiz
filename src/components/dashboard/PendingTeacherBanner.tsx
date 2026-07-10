import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * 선생님 신청이 검토 중(pending)인 사용자에게 보여주는 안내 배너.
 * 신청자는 승인 전까지 role='student'이므로 학생 대시보드를 보게 되며,
 * 이 배너로 신청 상태를 알린다.
 */
export function PendingTeacherBanner() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['myTeacherApplication', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_applications')
        .select('status')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as { status: string } | null;
    },
    enabled: !!user,
  });

  if (data?.status !== 'pending') return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-foreground">선생님 신청 검토 중</p>
        <p className="text-muted-foreground mt-0.5">
          운영자 승인을 기다리고 있습니다. 승인되면 선생님 기능을 사용할 수 있어요.
          그때까지는 학생으로 학습을 진행할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
