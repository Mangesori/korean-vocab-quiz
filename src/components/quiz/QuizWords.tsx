import { List, Pencil, Plus } from "lucide-react";

const pillButtonStyle = {
  border: "1px solid #C8DED3",
  borderRadius: 9,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1E6B47",
} as const;

const neutralPillButtonStyle = {
  border: "1px solid #E3DCD3",
  borderRadius: 9,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#4A443F",
} as const;

interface QuizWordsProps {
  words: string[];
  /** 단어 편집 — 기존 "수정하기" 편집 모드로 진입시킨다(빈칸 채우기 탭). */
  onEditWords?: () => void;
  /** 단어 추가 — 기존 "문제 추가" 핸들러 재사용(빈칸 문제 하나를 새로 만들고 편집 모드로 들어간다). */
  onAddWord?: () => void;
}

// 2단 카드 중 "단어" 항목. 트리거는 QuizHeader의 메타 줄로 옮겨갔고, 이 컴포넌트는
// QuizDetail이 펼침 상태일 때만 렌더링하는 내용(헤더 줄 + 칩 목록)을 그린다.
// 단어는 QuizWords가 받는 words: string[]가 이름만 나열된 평평한 목록이라 세트로
// 묶을 수 없다 — 평평한 칩으로만 나열한다.
export function QuizWords({ words, onEditWords, onAddWord }: QuizWordsProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EBE5DE", borderRadius: 14, padding: "16px 18px" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <List className="w-[15px] h-[15px]" style={{ color: "#1E6B47" }} />
          <span className="text-[13.5px] font-bold">단어 목록</span>
          <span className="text-xs" style={{ color: "#8A837D" }}>{words.length}개</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEditWords && (
            <button type="button" className="inline-flex items-center gap-1.5" style={neutralPillButtonStyle} onClick={onEditWords}>
              <Pencil className="w-3.5 h-3.5" /> 단어 편집
            </button>
          )}
          {onAddWord && (
            <button type="button" className="inline-flex items-center gap-1.5" style={pillButtonStyle} onClick={onAddWord}>
              <Plus className="w-3.5 h-3.5" /> 단어 추가
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {words.map((word, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-[8px] border font-semibold"
            style={{
              background: "#F4F9F6",
              borderColor: "#DCE9E2",
              color: "#2C6B4C",
              fontSize: "12.5px",
              padding: "7px 11px",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
