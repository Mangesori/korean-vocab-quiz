import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

export function AppLayout({ children, hideFooter = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
