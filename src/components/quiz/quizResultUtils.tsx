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

export function renderSentenceWithFeedback(
  sentence: string,
  wordFeedback?: { word: string; accuracyScore: number }[],
  isPassed?: boolean
) {
  if (!wordFeedback || wordFeedback.length === 0) {
    return <span className={isPassed ? "text-success font-bold" : ""}>{sentence}</span>;
  }
  const lowScoreWords = new Set(
    wordFeedback.filter((w) => w.accuracyScore < 60).map((w) => w.word.replace(/[.,!?。，！？]/g, ""))
  );
  if (lowScoreWords.size === 0) {
    return <span className="text-success font-bold">{sentence}</span>;
  }
  return (
    <span className="font-bold">
      {sentence.split(/(\s+)/).map((word, idx) => {
        const clean = word.replace(/[.,!?。，！？]/g, "");
        return lowScoreWords.has(clean)
          ? <span key={idx} className="text-destructive">{word}</span>
          : <span key={idx} className="text-success">{word}</span>;
      })}
    </span>
  );
}

export interface SpeakingFeedbackInput {
  isPassed: boolean;
  overallScore: number;
  fluencyScore: number;
  prosodyScore: number;
  completenessScore: number;
  wordLevelFeedback?: { word: string; accuracyScore: number }[];
}

export function generateSpeakingFeedback(attempt: SpeakingFeedbackInput): string {
  const lowWords = (attempt.wordLevelFeedback ?? [])
    .filter((w) => w.accuracyScore < 60)
    .map((w) => w.word.replace(/[.,!?。，！？]/g, ""));

  if (lowWords.length > 0) {
    const displayWords = lowWords.slice(0, 3).join("', '");
    const suffix = lowWords.length > 3 ? "' and others" : "'";
    return `Pay closer attention to the pronunciation of '${displayWords}${suffix}. Listen to the native speaker and try again!`;
  }

  if (attempt.isPassed) {
    if (attempt.overallScore >= 90) return "Excellent pronunciation! You sound very natural and clear.";
    let feedback = "Good job! ";
    if (attempt.fluencyScore < 80) {
      feedback += "Try to speak a bit more smoothly without pausing.";
    } else if (attempt.prosodyScore < 80) {
      feedback += "Pay a little more attention to the natural rhythm and intonation.";
    } else if (attempt.completenessScore < 80) {
      feedback += "Make sure to pronounce every word in the sentence clearly.";
    } else {
      feedback += "Keep practicing to make it even more natural.";
    }
    return feedback;
  }

  return "Please listen carefully to the native speaker and try again.";
}
