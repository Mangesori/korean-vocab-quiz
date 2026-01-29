import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  hideMobileNav?: boolean;
}

export function AppLayout({ children, hideFooter = false, hideMobileNav = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className={cn("flex-1", !hideMobileNav && "pb-16 md:pb-0")}>
        {children}
      </main>
      {!hideFooter && <Footer />}
      {!hideMobileNav && <MobileBottomNav />}
    </div>
  );
}
