import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';

export default function Dashboard() {
  const { user, role, loading } = useAuth();

  const { can } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Teachers and Admins see the TeacherDashboard
  if (can(PERMISSIONS.CREATE_QUIZ)) {
    return <TeacherDashboard />;
  }

  // Students see the StudentDashboard
  if (can(PERMISSIONS.JOIN_CLASS)) {
    return <StudentDashboard />;
  }

  // Role not set yet
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
