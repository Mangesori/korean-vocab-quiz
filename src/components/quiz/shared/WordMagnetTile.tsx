/**
 * 문장 순서 맞추기 타일(표시 전용).
 * 실제 퀴즈(WordMagnetStage)와 학생 미리보기(WordMagnetStudentView)가 동일한 모양을 쓰도록 공유.
 * 조사/어미는 회색, 일반 단어는 흰색.
 */
export function WordMagnetTile({
  content,
  isParticle,
  faded,
}: {
  content: string;
  isParticle: boolean;
  faded?: boolean;
}) {
  return (
    <div
      className={`select-none rounded-xl px-3 py-2 text-base sm:text-lg shadow-sm border whitespace-nowrap ${
        isParticle
          ? "bg-slate-100 text-slate-500 border-slate-200"
          : "bg-white text-foreground border-slate-200"
      } ${faded ? "opacity-50" : ""}`}
    >
      {content}
    </div>
  );
}
