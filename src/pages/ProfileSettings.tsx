import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Navbar } from '@/components/layout/Navbar';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              대시보드로 돌아가기
            </Button>
          </Link>
        </div>

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
      </main>
    </div>
  );
}
