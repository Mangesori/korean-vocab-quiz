import { toJamo } from "@/utils/hangul";

export function renderSentenceWithDiff(
  studentSentence: string,
  modelAnswer: string | null | undefined,
  noCorrection: boolean
) {
  if (noCorrection || !modelAnswer) {
    return <span className="text-success">{studentSentence}</span>;
  }
  const studentWords = studentSentence.trim().split(/\s+/);
  const modelWords = modelAnswer.trim().split(/\s+/);
  return (
    <>
      {studentWords.map((word, idx) => {
        const isCorrect = modelWords.includes(word);
        return isCorrect
          ? <span key={idx} className="mr-1.5 text-slate-700">{word}</span>
          : <span key={idx} className="text-destructive font-bold mr-1.5 border-b-2 border-destructive/30 pb-0.5">{word}</span>;
      })}
    </>
  );
}

export function renderModelAnswerWithDiff(modelAnswer: string, studentSentence: string) {
  const modelWords = modelAnswer.trim().split(/\s+/);
  const studentWords = studentSentence.trim().split(/\s+/);
  return (
    <>
      {modelWords.map((word, idx) => {
        const isOriginal = studentWords.includes(word);
        return isOriginal
          ? <span key={idx} className="mr-1.5 text-slate-700">{word}</span>
          : <span key={idx} className="text-primary font-bold mr-1.5 border-b-2 border-primary/30 pb-0.5">{word}</span>;
      })}
    </>
  );
}

function getAccuracyColorClass(score: number): string {
  if (score < 50) return "text-destructive";
  if (score < 75) return "text-warning";
  return "text-success";
}

export function renderSentenceWithFeedback(
  sentence: string,
  wordFeedback?: { word: string; accuracyScore: number }[],
  isPassed?: boolean
) {
  if (!wordFeedback || wordFeedback.length === 0) {
    return <span className={isPassed ? "text-success font-bold" : "font-bold text-slate-700"}>{sentence}</span>;
  }
  const wordScores = new Map(
    wordFeedback.map((w) => [w.word.replace(/[.,!?。，！？]/g, ""), w.accuracyScore])
  );
  const hasAttentionWords = wordFeedback.some((w) => w.accuracyScore < 75);
  // 전체를 초록으로 칠하는 지름길은 합격일 때만 적용. 불합격이면 per-word로 렌더한다.
  if (!hasAttentionWords && isPassed) {
    return <span className="text-success font-bold">{sentence}</span>;
  }
  return (
    <span className="font-bold">
      {sentence.split(/(\s+)/).map((word, idx) => {
        const clean = word.replace(/[.,!?。，！？]/g, "");
        const score = wordScores.get(clean);
        // 매칭 실패 단어는 중립 회색으로(모르면 초록이 아니라 회색).
        const colorClass = score === undefined ? "text-slate-400" : getAccuracyColorClass(score);
        return <span key={idx} className={colorClass}>{word}</span>;
      })}
    </span>
  );
}

// CLOVA가 실제 인식한 문장을 표시하며, 기준 문장과 자모 단위로 비교해 다른 단어를 강조한다.
export function renderRecognizedText(recognized: string, reference: string) {
  const clean = (w: string) => w.replace(/[.,!?。，！？]/g, "");
  const recognizedWords = recognized.trim().split(/\s+/);
  const refJamo = reference.trim().split(/\s+/).map((w) => toJamo(clean(w)));
  return (
    <>
      {recognizedWords.map((word, idx) => {
        const wj = toJamo(clean(word));
        const isMatch = refJamo[idx] === wj || refJamo.includes(wj);
        return isMatch
          ? <span key={idx} className="mr-1.5 text-slate-500">{word}</span>
          : <span key={idx} className="text-destructive font-semibold mr-1.5 border-b-2 border-destructive/30">{word}</span>;
      })}
    </>
  );
}

export interface SpeakingFeedbackInput {
  isPassed: boolean;
  overallScore: number;
  wordLevelFeedback?: { word: string; accuracyScore: number }[];
}

export function generateSpeakingFeedback(attempt: SpeakingFeedbackInput): string {
  const lowWords = (attempt.wordLevelFeedback ?? [])
    .filter((w) => w.accuracyScore < 50)
    .map((w) => w.word.replace(/[.,!?。，！？]/g, ""));

  if (lowWords.length > 0) {
    const displayWords = lowWords.slice(0, 3).join("', '");
    const suffix = lowWords.length > 3 ? "' and others" : "'";
    return `Pay closer attention to the pronunciation of '${displayWords}${suffix}. Listen to the native speaker and try again!`;
  }

  if (attempt.isPassed) {
    if (attempt.overallScore >= 90) return "Excellent pronunciation! You sound very natural and clear.";
    const attentionWords = (attempt.wordLevelFeedback ?? []).filter((w) => w.accuracyScore < 75);
    if (attentionWords.length > 0) {
      return "Good job! A few words could be a bit clearer — keep practicing.";
    }
    return "Good job! Keep practicing to make it even more natural.";
  }

  return "Please listen carefully to the native speaker and try again.";
}
