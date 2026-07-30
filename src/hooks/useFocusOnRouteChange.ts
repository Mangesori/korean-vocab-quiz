import { useEffect, useRef } from "react";

/**
 * key(예: articleId)가 바뀔 때마다 반환된 ref가 가리키는 엘리먼트로 포커스를 옮긴다.
 * HelpArticle.tsx에서 문서 전환 시 스크린리더·키보드 사용자가 새 문서 제목부터
 * 인지하도록 h1에 붙여 쓴다. 범위는 HelpArticle.tsx 하나로 한정한다.
 */
export function useFocusOnRouteChange<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}
