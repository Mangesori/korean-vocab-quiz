import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { AppLayout } from '@/components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

export default function ProfileSettings() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading, updateProfile, isUpdating } = useProfile();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppLayout>
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">프로필 설정</h1>
          <p className="text-muted-foreground mt-1">
            프로필 정보와 학습 설정을 관리합니다.
          </p>
        </div>

        <ProfileForm
          profile={profile}
          onSubmit={updateProfile}
          isSubmitting={isUpdating}
        />
      </div>
    </AppLayout>
  );
}
