import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

interface AppLayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  hideMobileNav?: boolean;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      {user && <AppSidebar />}
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 px-4 border-b border-border bg-background shrink-0">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-2">
            {user && <NotificationDropdown />}
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
