import { useEffect } from "react";

interface DocumentMeta {
  title: string;
  description?: string;
}

// index.html의 정적 기본값과 정확히 일치시켜야 언마운트 시 원래 상태로 되돌아간다.
const DEFAULT_TITLE = "나무 Korean";
const DEFAULT_DESCRIPTION = "선생님과 학생을 위한 한국어 어휘 학습 플랫폼 — 나무 Korean";
const DEFAULT_OG_TITLE = "나무 Korean";
const DEFAULT_OG_DESCRIPTION = "나무 Korean으로 한국어 어휘를 체계적으로 학습하세요.";

function setMetaTag(selector: string, attr: string, content: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, content);
}

/**
 * 라우트 진입 시 document.title과 OG/description 메타 태그를 갱신하고,
 * 언마운트 시 index.html의 기본값으로 되돌린다. react-helmet 등 라이브러리 없이
 * 이 저장소에 선례가 없는 페이지별 메타 관리를 가볍게 흉내낸다.
 * 범위는 도움말 2개 페이지(HelpCenter, HelpArticle)로 한정한다.
 */
export function useDocumentMeta({ title, description }: DocumentMeta) {
  useEffect(() => {
    const fullTitle = `${title} - ${DEFAULT_TITLE}`;
    document.title = fullTitle;
    setMetaTag('meta[property="og:title"]', "content", fullTitle);
    if (description) {
      setMetaTag('meta[name="description"]', "content", description);
      setMetaTag('meta[property="og:description"]', "content", description);
    }
    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('meta[property="og:title"]', "content", DEFAULT_OG_TITLE);
      setMetaTag('meta[name="description"]', "content", DEFAULT_DESCRIPTION);
      setMetaTag('meta[property="og:description"]', "content", DEFAULT_OG_DESCRIPTION);
    };
  }, [title, description]);
}
