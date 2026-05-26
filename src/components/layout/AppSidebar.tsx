import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Home,
  BookOpen,
  PenSquare,
  Users,
  Shield,
  FileX,
  BookMarked,
  Settings,
  LogOut,
  GraduationCap,
  FileText,
} from "lucide-react";

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  exactSearch?: string;
}

const SB_ITEM_CLASS =
  "gap-3 text-[13px] font-medium text-muted-foreground py-[9px] px-3 hover:bg-black/[0.04] hover:text-foreground data-[active=true]:bg-[#E8F5EE] data-[active=true]:text-primary data-[active=true]:font-semibold";

const SB_SECTION_CLASS =
  "font-ui text-[11px] font-bold text-[#9E9894] uppercase tracking-[0.06em] mb-1.5 pl-3";

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const isActive =
    item.exactSearch !== undefined
      ? location.pathname === item.path && location.search === item.exactSearch
      : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={SB_ITEM_CLASS}
        onClick={() => setOpenMobile(false)}
      >
        <Link to={item.path}>
          <Icon className="w-[15px] h-[15px] shrink-0" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getRoleLabel = () => {
    if (role === "admin") return "관리자";
    if (role === "teacher") return "선생님";
    return "학생";
  };

  const getRoleIcon = () => {
    if (role === "admin") return <Shield className="h-3 w-3" />;
    if (role === "teacher") return <GraduationCap className="h-3 w-3" />;
    return <Users className="h-3 w-3" />;
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const teacherItems: NavItem[] = [
    { path: "/dashboard", icon: Home, label: "대시보드" },
    { path: "/quizzes", icon: BookOpen, label: "내 퀴즈" },
    { path: "/quiz/create", icon: PenSquare, label: "퀴즈 만들기" },
    { path: "/classes", icon: Users, label: "내 클래스" },
  ];

  const adminItems: NavItem[] = [
    { path: "/admin", icon: Shield,        label: "관리자 대시보드", exactSearch: "" },
    { path: "/admin", icon: GraduationCap, label: "선생님 관리",     exactSearch: "?tab=teachers" },
    { path: "/admin", icon: FileText,      label: "시스템 리포트",   exactSearch: "?tab=report" },
  ];

  const adminTeacherItems: NavItem[] = [
    { path: "/dashboard", icon: Home, label: "선생님 대시보드" },
    { path: "/quizzes", icon: BookOpen, label: "내 퀴즈" },
    { path: "/quiz/create", icon: PenSquare, label: "퀴즈 만들기" },
    { path: "/classes", icon: Users, label: "내 클래스" },
  ];

  const studentMainItems: NavItem[] = [
    { path: "/dashboard", icon: Home, label: "대시보드" },
  ];
  const studentClassItems: NavItem[] = [
    { path: "/classes", icon: Users, label: "내 클래스" },
  ];
  const studentStudyItems: NavItem[] = [
    { path: "/wrong-answers", icon: FileX, label: "오답노트" },
    { path: "/vocabulary", icon: BookMarked, label: "단어장" },
  ];

  const isTeacherOrAdmin = role === "teacher" || role === "admin";

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="px-4 py-4">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <img src="/Namu_logo_text_right.png" className="h-7 w-auto" alt="나무 Korean" />
        </Link>
      </SidebarHeader>

      {isTeacherOrAdmin ? (
        <SidebarContent className="px-2 pt-0">
          {role === "admin" ? (
            <>
              <div className={`${SB_SECTION_CLASS} mt-5`}>관리자</div>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <NavLink key={item.label} item={item} />
                ))}
              </SidebarMenu>
              <div className={`${SB_SECTION_CLASS} mt-5`}>선생님</div>
              <SidebarMenu>
                {adminTeacherItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
              </SidebarMenu>
            </>
          ) : (
            <>
              <div className={`${SB_SECTION_CLASS} mt-5`}>선생님 메뉴</div>
              <SidebarMenu>
                {teacherItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
              </SidebarMenu>
            </>
          )}
        </SidebarContent>
      ) : (
        <SidebarContent className="px-2 pt-0">
          <SidebarMenu>
            {studentMainItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </SidebarMenu>
          <div className={`${SB_SECTION_CLASS} mt-5`}>내 클래스</div>
          <SidebarMenu>
            {studentClassItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </SidebarMenu>
          <div className={`${SB_SECTION_CLASS} mt-4`}>학습</div>
          <SidebarMenu>
            {studentStudyItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </SidebarMenu>
        </SidebarContent>
      )}

      <SidebarFooter className="px-3 py-3 border-t border-border">
        {user && (
          <div className="space-y-1">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {getInitials(user.email || "?")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {getRoleIcon()}
                  {getRoleLabel()}
                </p>
              </div>
            </div>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className={SB_ITEM_CLASS}>
                  <Link to="/profile/settings">
                    <Settings className="w-[15px] h-[15px] shrink-0" />
                    <span>프로필 설정</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={`${SB_ITEM_CLASS} text-destructive hover:text-destructive hover:bg-destructive/10`}
                  onClick={handleSignOut}
                >
                  <LogOut className="w-[15px] h-[15px] shrink-0" />
                  <span>로그아웃</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
