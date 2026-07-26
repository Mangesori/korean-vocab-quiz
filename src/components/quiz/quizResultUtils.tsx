const PUNCTUATION = /[.,!?。，！？]/g;

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

/**
 * CLOVA 형태소 단위 점수를 화면용 어절 단위 점수로 옮긴다.
 *
 * CLOVA는 `신발`/`은`, `발`/`이`처럼 형태소로 쪼개 주는데 화면은 어절(`신발은`) 단위다.
 * 문자열 키 Map으로 조회하면 (a) 형태소/어절 불일치로 못 찾고 (b) 같은 단어가 두 번 나오면
 * 마지막 값만 남는다. 그래서 토큰을 음절 단위로 펴서 앞에서부터 순서대로 소비한다.
 * 어절 점수는 소비한 음절 점수의 평균 = 토큰의 음절 수 가중 평균이 된다.
 * 매칭에 실패한 어절은 null(길이는 항상 refWords와 같다).
 */
export function mapFeedbackToWords(
  refWords: string[],
  wordFeedback?: { word: string; accuracyScore: number }[]
): (number | null)[] {
  const scores: (number | null)[] = refWords.map(() => null);
  if (!wordFeedback || wordFeedback.length === 0) return scores;

  // 토큰을 음절 단위로 펴 둔다(토큰 하나가 여러 어절을 덮으면 그 점수를 나눠 갖게 된다).
  let flat = "";
  const charScores: number[] = [];
  for (const token of wordFeedback) {
    const cleaned = token.word.replace(PUNCTUATION, "").replace(/\s/g, "");
    for (const ch of cleaned) {
      flat += ch;
      charScores.push(token.accuracyScore);
    }
  }

  let cursor = 0;
  refWords.forEach((word, idx) => {
    const target = word.replace(PUNCTUATION, "").replace(/\s/g, "");
    if (target.length === 0) return;

    let start = -1;
    if (flat.startsWith(target, cursor)) {
      start = cursor; // 정렬이 맞는 정상 경로
    } else {
      const found = flat.indexOf(target, cursor); // 어긋났으면 앞으로 재동기화 시도
      if (found >= 0) start = found;
    }

    if (start < 0) {
      // 재동기화 실패: 이 어절만 포기하고 커서는 그대로 둔다.
      // (커서를 억지로 전진시키면 뒤 어절의 토큰까지 건너뛰어 줄줄이 null이 된다.
      //  커서를 두면 다음 어절이 indexOf로 알아서 앞쪽 토큰을 건너뛰며 복구한다.)
      return;
    }

    const slice = charScores.slice(start, start + target.length);
    scores[idx] = Math.round(slice.reduce((sum, s) => sum + s, 0) / slice.length);
    cursor = start + target.length;
  });

  return scores;
}

/**
 * 정답 문장을 어절별로 CLOVA 발음 점수 색으로 칠한다.
 *
 * 점수는 정답 문장에 강제정렬한 음향 채점이라 믿을 만하지만, CLOVA가 함께 주는
 * 받아쓰기(인식문)는 한국어 언어모델 편향 때문에 학습자 발음에서 자주 무너진다.
 * (실측: 실제로 "싸요"라고 말했는데 "쉬워요"로 적고, 그 자리 발음 점수는 84점)
 * 그래서 채점·색칠은 발음 점수 하나만 본다.
 */
export function renderSentenceWithFeedback(
  sentence: string,
  wordFeedback?: { word: string; accuracyScore: number }[],
  isPassed?: boolean
) {
  const refWords = sentence.trim().split(/\s+/).filter(Boolean);
  // CLOVA 형태소(`신발`/`은`)를 화면 어절(`신발은`) 순서에 맞춰 편 점수 배열.
  const wordScores = mapFeedbackToWords(refWords, wordFeedback);
  const hasAnyScore = wordScores.some((s) => s !== null);

  // 점수가 하나도 없으면: 합격이면 초록, 아니면 중립.
  if (!hasAnyScore) {
    return <span className={isPassed ? "text-success font-bold" : "font-bold text-slate-700"}>{sentence}</span>;
  }

  return (
    <span className="font-bold">
      {renderWords(sentence, (wordIdx) => {
        const score = wordScores[wordIdx];
        return score !== null && score !== undefined ? getAccuracyColorClass(score) : "text-slate-400";
      })}
    </span>
  );
}

/**
 * 문장을 공백까지 보존해 렌더링하면서, 공백이 아닌 토큰에만 어절 인덱스를 매겨 색을 받아온다.
 * split(/(\s+)/) 인덱스와 trim().split(/\s+/) 인덱스가 어긋나 색이 밀리는 것을 막는다.
 */
function renderWords(sentence: string, colorOf: (wordIdx: number) => string) {
  let wordIdx = -1;
  return sentence.split(/(\s+)/).map((token, idx) => {
    if (token.length === 0) return null;
    if (/^\s+$/.test(token)) return <span key={idx}>{token}</span>;
    wordIdx += 1;
    return <span key={idx} className={colorOf(wordIdx)}>{token}</span>;
  });
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
