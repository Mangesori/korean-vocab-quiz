import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";


const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <img src="/Namu_logo_text_right.png" className="h-7 w-auto" alt="나무 Korean" />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-6 text-xl text-muted-foreground">페이지를 찾을 수 없어요</p>
          {user ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              대시보드로 가기
            </Link>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              홈으로 돌아가기
            </Link>
          )}
          <div className="mt-4">
            <FeedbackButton
              context="not_found"
              label="도움이 필요하신가요?"
              variant="link"
              size="sm"
              hideIcon
              className="text-sm text-muted-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
