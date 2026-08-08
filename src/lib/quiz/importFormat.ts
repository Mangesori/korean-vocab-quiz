/**
 * 붙여넣기 가져오기 — TSV 파싱과 6종 문제 생성.
 *
 * 목적은 하나다: **AI를 한 번도 부르지 않고** 퀴즈를 만든다.
 * generate-quiz 엣지 함수가 하던 일(문장·뜻·번역 작성)을 선생님이 미리 채운
 * 표로 대신하므로, 이 파일에는 네트워크 호출이 전혀 없다.
 * (음성만은 선택 사항으로 남는데, 그건 저장 단계에서 따로 처리한다.)
 *
 * 열 순서는 scripts로 생성한 korean-sentences.tsv와 같다:
 *   단어 / 뜻 / 레벨 / 문장 / 정답 / 문법힌트 / 번역
 *
 * `문장`은 빈칸이 없는 **완성형**으로 받는다. 빈칸 채우기용 `( )` 문장은
 * 여기서 `정답`을 찾아 치환해 만든다. 완성형으로 받는 이유는 한 문장을
 * 6종 중 4종(빈칸·순서맞추기·말하기·문장만들기)이 서로 다른 형태로 쓰기
 * 때문이다. 빈칸이 뚫린 채로 받으면 나머지 3종이 문장을 복원해야 한다.
 */
import { parseSentenceToItems } from "@/lib/korean/wordMagnet";
import type {
  MatchupProblem,
  Problem,
  RecordingProblem,
  SentenceMakingProblem,
  TypeAnswerProblem,
  WordMagnetProblem,
} from "@/types/quiz";

export const IMPORT_COLUMNS = ["단어", "뜻", "레벨", "문장", "정답", "문법힌트", "번역"] as const;

/** 표 한 줄 = 어휘 하나의 예문 하나. 같은 단어가 여러 줄에 나올 수 있다. */
export interface ImportRow {
  word: string;
  meaning: string;
  level: string;
  sentence: string;
  answer: string;
  hint: string;
  translation: string;
}

export interface ImportIssue {
  /** 1-based. 헤더를 포함한 원본 줄 번호라 사용자가 표에서 바로 찾을 수 있다. */
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ImportRow[];
  issues: ImportIssue[];
  /** 파일에 헤더 줄이 있었는지. 없으면 첫 줄부터 데이터로 읽는다. */
  hadHeader: boolean;
}

const LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

/**
 * 탭 우선, 없으면 쉼표로 분리한다.
 *
 * 탭을 먼저 보는 이유: 문장·번역에 쉼표가 자연스럽게 들어간다
 * ("제가 아까 말했잖아요, 왜 또 물어보세요?"). 스프레드시트에서 복사하면
 * 탭으로 오므로 탭이 하나라도 있으면 무조건 탭 구분으로 취급한다.
 */
function splitCells(line: string): string[] {
  const sep = line.includes("\t") ? "\t" : ",";
  return line.split(sep).map((c) => c.trim());
}

/** 헤더 줄인지 판정 — 첫 두 칸이 우리 열 이름이면 헤더로 본다. */
function looksLikeHeader(cells: string[]): boolean {
  return cells[0] === IMPORT_COLUMNS[0] && cells[1] === IMPORT_COLUMNS[1];
}

export function parseImportText(text: string): ParseResult {
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let hadHeader = false;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return; // 빈 줄은 조용히 건너뛴다 (표 끝의 개행 등)

    const cells = splitCells(raw);

    if (i === 0 && looksLikeHeader(cells)) {
      hadHeader = true;
      return;
    }

    const lineNo = i + 1;

    if (cells.length < IMPORT_COLUMNS.length) {
      issues.push({
        line: lineNo,
        message: `칸이 ${cells.length}개예요. ${IMPORT_COLUMNS.length}개가 필요해요 (${IMPORT_COLUMNS.join(" / ")}).`,
      });
      return;
    }

    const [word, meaning, level, sentence, answer, hint, translation] = cells;

    if (!word || !sentence || !answer) {
      issues.push({ line: lineNo, message: "단어·문장·정답은 비울 수 없어요." });
      return;
    }

    const upperLevel = level.toUpperCase();
    if (!LEVELS.has(upperLevel)) {
      issues.push({ line: lineNo, message: `레벨 "${level}"을 알 수 없어요. A1~C2 중 하나여야 해요.` });
      return;
    }

    // 정답이 문장 안에 없으면 빈칸을 만들 수 없다. 여기서 막지 않으면
    // 빈칸 없는 문제가 조용히 생겨 학생 화면에서야 드러난다.
    if (!sentence.includes(answer)) {
      issues.push({
        line: lineNo,
        message: `정답 "${answer}"이 문장 안에 없어요. 문장에 있는 그대로 적어 주세요.`,
      });
      return;
    }

    rows.push({
      word,
      meaning,
      level: upperLevel,
      sentence,
      answer,
      hint,
      translation,
    });
  });

  return { rows, issues, hadHeader };
}

/**
 * 완성 문장 → 빈칸 문장. 정답이 여러 번 나오면 **첫 번째만** 뚫는다.
 * (예: "친구가 저를 도와주면 저도 도와줘요" — 둘 다 뚫으면 문제가 성립하지 않는다.)
 */
export function toBlankSentence(sentence: string, answer: string): string {
  const at = sentence.indexOf(answer);
  if (at < 0) return sentence;
  return sentence.slice(0, at) + "( )" + sentence.slice(at + answer.length);
}

export interface BuildOptions {
  /** 이 레벨의 줄만 쓴다. null이면 전부. */
  level: string | null;
  /** 한 단어에서 최대 몇 문장을 쓸지. 레벨을 고르면 보통 2문장(B1은 1) 있다. */
  perWordLimit: number;
}

export interface BuiltProblems {
  problems: Problem[];
  matchup: MatchupProblem[];
  typeAnswer: TypeAnswerProblem[];
  wordMagnet: WordMagnetProblem[];
  sentenceMaking: SentenceMakingProblem[];
  recording: RecordingProblem[];
  /** 실제로 문제가 만들어진 표제어 목록 (quizzes.words에 그대로 들어간다). */
  words: string[];
}

/**
 * 표 → 6종 문제. 전부 순수 함수라 네트워크 호출이 없다.
 *
 * 짝 맞추기와 단어 받아쓰기는 **문장이 아니라 단어** 단위라, 같은 단어가
 * 여러 줄이어도 하나만 만든다. 나머지 4종은 문장 단위로 하나씩 만든다.
 */
export function buildProblems(rows: ImportRow[], opts: BuildOptions): BuiltProblems {
  const picked = opts.level ? rows.filter((r) => r.level === opts.level) : rows;

  // 단어별로 묶어 상한을 적용한다. Map은 삽입 순서를 지키므로 표 순서가 유지된다.
  const byWord = new Map<string, ImportRow[]>();
  for (const r of picked) {
    const list = byWord.get(r.word) ?? [];
    if (list.length < opts.perWordLimit) list.push(r);
    byWord.set(r.word, list);
  }

  const problems: Problem[] = [];
  const matchup: MatchupProblem[] = [];
  const typeAnswer: TypeAnswerProblem[] = [];
  const wordMagnet: WordMagnetProblem[] = [];
  const sentenceMaking: SentenceMakingProblem[] = [];
  const recording: RecordingProblem[] = [];
  const words: string[] = [];

  // 같은 퀴즈 안에서만 고유하면 되므로 인덱스 기반으로 충분하다.
  // Date.now()를 섞어 같은 브라우저에서 연속 생성해도 겹치지 않게 한다.
  const stamp = Date.now();
  let n = 0;

  for (const [word, list] of byWord) {
    if (list.length === 0) continue;
    words.push(word);

    const head = list[0];
    // 뜻이 비어 있으면 짝 맞추기/받아쓰기가 빈 카드가 된다 — 그 단어만 건너뛴다.
    if (head.meaning) {
      matchup.push({ problem_id: `p-${stamp}-${n}`, korean_text: word, meaning_text: head.meaning });
      typeAnswer.push({ problem_id: `p-${stamp}-${n}`, prompt: head.meaning, answer: word });
    }

    for (const r of list) {
      const id = `p-${stamp}-${n++}`;

      problems.push({
        id,
        word: r.word,
        answer: r.answer,
        sentence: toBlankSentence(r.sentence, r.answer),
        hint: r.hint,
        translation: r.translation,
        meaning: r.meaning,
      });

      wordMagnet.push({
        problem_id: id,
        base_text: r.sentence,
        translation: r.translation,
        items: parseSentenceToItems(r.sentence).map(({ content, isParticle }) => ({ content, isParticle })),
      });

      sentenceMaking.push({
        problem_id: id,
        word: r.word,
        word_meaning: r.meaning,
        model_answer: r.sentence,
      });

      recording.push({
        problem_id: id,
        sentence: r.sentence,
        mode: "read",
        translation: r.translation,
      });
    }
  }

  return { problems, matchup, typeAnswer, wordMagnet, sentenceMaking, recording, words };
}
