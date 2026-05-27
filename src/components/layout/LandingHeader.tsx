import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GraduationCap, LogOut, Settings, Shield, User, Users } from "lucide-react";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

export function LandingHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4">
        <Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
          <img src="/Namu_logo_text_right.png" className="h-8 w-auto" alt="나무 Korean" />
        </Link>

        <div className="flex-1 hidden md:flex justify-center">
          <nav className="flex items-center gap-6 text-[15px] font-medium text-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">기능</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">요금</a>
            <a href="#help" className="hover:text-foreground transition-colors">도움말</a>
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-2 -mr-4">
          {user ? (
            <>
              <NotificationDropdown />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.email || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">{user.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {role === "admin" ? (
                          <><Shield className="h-3 w-3" />관리자</>
                        ) : role === "teacher" ? (
                          <><GraduationCap className="h-3 w-3" />선생님</>
                        ) : (
                          <><Users className="h-3 w-3" />학생</>
                        )}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />대시보드
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />프로필 설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">로그인</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm">무료로 시작</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
