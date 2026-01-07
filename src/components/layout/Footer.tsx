import { BookOpen } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-0.5">
            <span className="text-3xl font-brand font-black bg-gradient-to-b from-pink-400 to-primary bg-clip-text text-transparent">D</span>
            <span className="text-xl font-brand font-bold text-foreground mt-1">alkom Korean</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Dalkom Korean. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
