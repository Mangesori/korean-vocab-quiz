import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RefreshCw, Star } from 'lucide-react';
import { formatDateFull } from '@/lib/formatDate';

const CONTEXT_LABEL: Record<string, string> = {
  quiz_result: '퀴즈 결과',
  share_result: '공유 퀴즈 결과',
  footer: '푸터',
  pricing_enterprise: '요금(기관 문의)',
  help_center: '도움말 센터',
  help_search_empty: '도움말 검색(결과 없음)',
  help_article: '도움말 문서',
  not_found: '404 페이지',
};

// 원래 AdminDashboard.tsx의 ?tab=feedback 그대로. 읽음 처리 UI는 이번 단계(순수 이동)
// 범위 밖이라 추가하지 않았다 — `feedback.read_at` 컬럼은 사이드바 배지 집계(useAdminQueue)에서만 쓴다.
export default function AdminFeedback() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();

  const { data: feedbackList = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, message, email, rating, context, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as {
        id: string; message: string; email: string | null; rating: number | null; context: string | null; created_at: string;
      }[]) || [];
    },
    enabled: !!user && can(PERMISSIONS.MANAGE_USERS),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.MANAGE_USERS)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AdminPageShell title="피드백">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>의견 목록</CardTitle>
              <CardDescription>사용자가 퀴즈 결과·푸터·요금 페이지에서 남긴 의견 ({feedbackList.length}건)</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : feedbackList.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">아직 받은 피드백이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {feedbackList.map((f) => (
                <div key={f.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {f.rating != null && (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: f.rating }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
                          ))}
                        </span>
                      )}
                      {f.context && (
                        <Badge variant="secondary" className="text-xs">{CONTEXT_LABEL[f.context] ?? f.context}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateFull(f.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{f.message}</p>
                  {f.email && (
                    <p className="text-xs text-muted-foreground">↳ {f.email}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
