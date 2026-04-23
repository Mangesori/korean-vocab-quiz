import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <Link to="/" className="text-lg font-bold">
          Dalkom Korean
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">페이지를 찾을 수 없어요</p>
          <Link to="/" className="text-primary underline hover:text-primary/90">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
