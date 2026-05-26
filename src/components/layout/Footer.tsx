export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/Namu_logo_text_right.png" className="h-6 w-auto" alt="나무 Korean" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} 나무 Korean. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
