import { Link } from 'react-router-dom';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/Namu_logo_text_right.png" className="h-10 w-auto" alt="나무 Korean" />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/help" className="hover:text-foreground transition-colors">도움말</Link>
            <Link to="/help?role=teacher" className="hover:text-foreground transition-colors">선생님 가이드</Link>
            <Link to="/help?role=student" className="hover:text-foreground transition-colors">학생 가이드</Link>
          </nav>
          <div className="flex items-center gap-3">
            <FeedbackButton context="footer" />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} 나무 Korean. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
