import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, FileX, BookMarked, User, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  roles?: ('student' | 'teacher' | 'admin')[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', icon: Home, label: '홈' },
  { path: '/wrong-answers', icon: FileX, label: '오답노트', roles: ['student'] },
  { path: '/vocabulary', icon: BookMarked, label: '단어장', roles: ['student'] },
  { path: '/quizzes', icon: BookOpen, label: '퀴즈', roles: ['teacher', 'admin'] },
  { path: '/classes', icon: Users, label: '클래스', roles: ['teacher', 'admin'] },
  { path: '/profile/settings', icon: User, label: '프로필' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { user, role } = useAuth();

  if (!user) return null;

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role as 'student' | 'teacher' | 'admin');
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
