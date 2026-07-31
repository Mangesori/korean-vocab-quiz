import { Fragment, type ReactNode } from "react";

// 정규식 특수문자를 이스케이프한다. 이걸 빼먹으면 "?"·"(" 같은 검색어가 정규식으로
// 해석돼 하이라이트가 깨지거나 예외가 난다.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** text 안에서 query와 일치하는 부분을 <mark>로 감싸 렌더한다.
 *  query가 비어 있으면 원문 그대로 반환한다(대소문자 무시 매칭). */
export function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const normalizedText = text.normalize("NFC");
  const pattern = new RegExp(`(${escapeRegExp(q.normalize("NFC"))})`, "ig");
  const parts = normalizedText.split(pattern);
  if (parts.length <= 1) return text;

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // --warning 토큰 사용. #F1ECE4는 빈칸 채우기 "보기" 박스 전용이라 재사용하지 않는다.
          <mark key={index} className="bg-warning/25 text-foreground rounded-[2px] px-px">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
