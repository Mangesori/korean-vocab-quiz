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
  isPassed?: boolean,
  recognizedText?: string
) {
  const clean = (w: string) => w.replace(/[.,!?。，！？]/g, "");
  const wordScores = new Map(
    (wordFeedback ?? []).map((w) => [clean(w.word), w.accuracyScore])
  );
  // 점수 없는 단어를 판정할 때 쓰는 인식문 자모 토큰(있을 때만).
  const recJamo = recognizedText
    ? recognizedText.trim().split(/\s+/).map((w) => toJamo(clean(w)))
    : null;

  // 점수도 인식문도 없으면: 합격이면 초록, 아니면 중립.
  if (wordScores.size === 0 && !recJamo) {
    return <span className={isPassed ? "text-success font-bold" : "font-bold text-slate-700"}>{sentence}</span>;
  }

  return (
    <span className="font-bold">
      {sentence.split(/(\s+)/).map((word, idx) => {
        if (/^\s+$/.test(word)) return <span key={idx}>{word}</span>;
        const score = wordScores.get(clean(word));
        let colorClass: string;
        if (score !== undefined) {
          // CLOVA 점수가 있으면 점수 색.
          colorClass = getAccuracyColorClass(score);
        } else if (recJamo) {
          // 점수 없음 → 인식문과 자모 비교: 제대로 들렸으면 초록, 다르게 들렸으면 빨강.
          colorClass = recJamo.includes(toJamo(clean(word))) ? "text-success" : "text-destructive";
        } else {
          // 점수도 인식문도 없을 때만 중립 회색.
          colorClass = "text-slate-400";
        }
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
