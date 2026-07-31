import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HelpSearchInput } from "./HelpSearchInput";

interface HelpNotFoundProps {
  query?: string;
}

/** 잘못된 articleId로 진입했을 때 렌더하는 도움말 내부 404. 전역 NotFound로 보내지 않는다
 *  — 레이아웃이 끊기고, t-plan/t-limit 삭제로 이 경로에 실제로 진입하게 됐기 때문. */
export function HelpNotFound({ query }: HelpNotFoundProps) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    navigate(trimmed ? `/help?q=${encodeURIComponent(trimmed)}` : "/help");
  };

  return (
    <div className="container max-w-3xl py-16 text-center md:py-20">
      <p className="text-sm font-bold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-black text-foreground break-keep">문서를 찾을 수 없어요</h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground break-keep">
        {query ? `'${query}' 문서는 존재하지 않아요. ` : ""}
        다른 검색어로 찾아보거나 도움말 홈으로 돌아가세요.
      </p>
      <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-md">
        <HelpSearchInput value={value} onChange={setValue} />
      </form>
      <Link to="/help" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
        도움말 홈으로 돌아가기
      </Link>
    </div>
  );
}
