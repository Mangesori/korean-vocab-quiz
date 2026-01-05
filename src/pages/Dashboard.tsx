import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, role, loading } = useAuth();

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

  if (role === 'teacher') {
    return <TeacherDashboard />;
  }

  if (role === 'student') {
    return <StudentDashboard />;
  }

  // Role not set yet
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
