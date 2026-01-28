import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Menu, X, BookOpen, LogOut, User, GraduationCap, Users, Shield, Settings } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Protect } from '@/components/auth/Protect';
import { PERMISSIONS } from '@/lib/rbac/roles';

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
            <span className="whitespace-nowrap inline-flex items-center gap-0.5">
              <span className="text-3xl font-brand font-black bg-gradient-to-b from-pink-400 to-primary bg-clip-text text-transparent">D</span>
              <span className="hidden sm:inline text-xl font-brand font-bold text-foreground mt-1">alkom Korean</span>
            </span>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  대시보드
                </Button>
              </Link>
              <Protect permission={PERMISSIONS.MANAGE_USERS}>
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Shield className="h-4 w-4 mr-1" />
                    관리자
                  </Button>
                </Link>
              </Protect>
              
              <Protect permission={PERMISSIONS.CREATE_QUIZ}>
                <Link to="/quiz/create">
                  <Button variant="ghost" size="sm">
                    퀴즈 만들기
                  </Button>
                </Link>
              </Protect>

              <Protect permission={PERMISSIONS.VIEW_CLASS}>
                <Link to="/classes">
                  <Button variant="ghost" size="sm">
                    {role === 'student' ? '클래스 참여' : '클래스 관리'}
                  </Button>
                </Link>
              </Protect>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationDropdown />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.email || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">{user.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {role === 'admin' ? (
                          <>
                            <Shield className="h-3 w-3" />
                            관리자
                          </>
                        ) : role === 'teacher' ? (
                          <>
                            <GraduationCap className="h-3 w-3" />
                            선생님
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3" />
                            학생
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      대시보드
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      프로필 설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button variant="ghost">로그인</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button>회원가입</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4">
          <div className="flex flex-col gap-2">
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                대시보드
              </Button>
            </Link>
            <Protect permission={PERMISSIONS.MANAGE_USERS}>
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-destructive">
                  <Shield className="h-4 w-4 mr-2" />
                  관리자
                </Button>
              </Link>
            </Protect>

            <Protect permission={PERMISSIONS.CREATE_QUIZ}>
              <Link to="/quiz/create" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  퀴즈 만들기
                </Button>
              </Link>
            </Protect>

            <Protect permission={PERMISSIONS.VIEW_CLASS}>
              <Link to="/classes" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  {role === 'student' ? '클래스 참여' : '클래스 관리'}
                </Button>
              </Link>
            </Protect>
          </div>
        </div>
      )}
    </nav>
  );
}
