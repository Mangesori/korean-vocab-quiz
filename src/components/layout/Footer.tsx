import { BookOpen } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-serif font-semibold text-foreground">한국어 퀴즈</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} 한국어 어휘 퀴즈 학습 플랫폼. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
