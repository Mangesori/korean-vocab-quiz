/**
 * 오늘의 복습(SRS) 문제를 stage(0~5)에 따라 6개 퀴즈 유형 중 하나로 배정한다.
 *
 * rotateSentences()가 이미 단어별로 word/sentence/answer/hint/translation/meaning/stage를
 * 채워 놓은 배열을 받아서, 그 자리에서 "이 단어를 어떤 문제 유형으로 낼지"를 계산한다.
 * 스키마 변경이나 새 RPC가 필요 없는 이유다.
 *
 * stage → 기본 유형:
 *   0 matchup, 1 type_answer, 2 fill_blank, 3 word_magnet, 4 sentence_making, 5 recording
 *   (6=졸업은 애초에 복습 대상에서 빠지므로 이 함수에 들어오지 않는다)
 *
 * 데이터가 그 유형을 감당 못 하면 아래 순서대로 하향 조정한다:
 *   1) matchup/type_answer인데 meaning이 없으면 → fill_blank
 *   2) fill_blank인데 sentence에 answer가 실제로 없으면(문자열 포함 검사) → word_magnet
 *   3) sentence_making/recording에 필요한 데이터가 없으면 → word_magnet (word_magnet은 항상 최종 폴백)
 *   4) matchup으로 배정된 단어가 세션 전체에서 3개 미만이면 전부 type_answer로 하향
 *   5) allowPaidTypes가 false면 sentence_making/recording을 전부 word_magnet으로 강제 하향
 */

import { STAGE_ORDER, type BaseStage } from "@/types/quiz";

export interface ReviewFormatSourceItem {
  id: string;
  word: string;
  /** 완성형 문장(빈칸 없음). 문장이 없는 경우 빈 문자열일 수 있다. */
  sentence: string;
  answer: string;
  hint: string;
  translation: string | null;
  meaning: string | null;
  /** wrong_answer_progress.stage (0~5). 6=졸업은 이 함수에 들어오지 않는다고 가정. */
  stage: number;
}

/** 6개 퀴즈 유형 키 — src/types/quiz.ts의 BaseStage와 동일한 값 집합을 재사용한다. */
export type ReviewFormat = BaseStage;

/** matchup → type_answer → fill_blank → word_magnet → sentence_making → recording 고정 순서. */
export const REVIEW_FORMAT_ORDER: ReviewFormat[] = STAGE_ORDER;

export type ReviewFormatBuckets<T extends ReviewFormatSourceItem = ReviewFormatSourceItem> = {
  matchup: T[];
  type_answer: T[];
  fill_blank: T[];
  word_magnet: T[];
  sentence_making: T[];
  recording: T[];
};

export interface AssignOptions {
  /**
   * false면 AI 채점(sentence_making)·음성 평가(recording)처럼 실제 비용이 드는
   * 유형을 전부 word_magnet으로 강제 하향한다. 서버에서 API 키 유무를 확인해
   * 넘길 수 있도록 옵션으로 뺀 것이고, 실제 키 확인 로직은 이 함수의 책임이 아니다.
   */
  allowPaidTypes: boolean;
}

const STAGE_TO_FORMAT: Record<number, ReviewFormat> = {
  0: "matchup",
  1: "type_answer",
  2: "fill_blank",
  3: "word_magnet",
  4: "sentence_making",
  5: "recording",
};

function emptyBuckets<T extends ReviewFormatSourceItem>(): ReviewFormatBuckets<T> {
  return {
    matchup: [],
    type_answer: [],
    fill_blank: [],
    word_magnet: [],
    sentence_making: [],
    recording: [],
  };
}

const hasText = (s: string | null | undefined) => !!s && s.trim().length > 0;

export function assignReviewFormats<T extends ReviewFormatSourceItem>(
  items: T[],
  options: AssignOptions
): ReviewFormatBuckets<T> {
  // 1단계: stage 기준 초기 배정 + 데이터 부족에 따른 개별 하향
  const initial = new Map<string, ReviewFormat>();

  for (const item of items) {
    let format = STAGE_TO_FORMAT[item.stage] ?? "matchup";

    // 규칙 1: matchup/type_answer인데 meaning이 없으면 fill_blank로.
    if ((format === "matchup" || format === "type_answer") && !hasText(item.meaning)) {
      format = "fill_blank";
    }

    // 규칙 2: fill_blank인데 문장에 정답이 실제로 없으면 word_magnet으로.
    if (format === "fill_blank" && !(hasText(item.sentence) && hasText(item.answer) && item.sentence.includes(item.answer))) {
      format = "word_magnet";
    }

    // 규칙 3: sentence_making/recording에 필요한 데이터가 없으면 word_magnet으로.
    if (format === "sentence_making" && !(hasText(item.word) && hasText(item.meaning))) {
      format = "word_magnet";
    }
    if (format === "recording" && !hasText(item.sentence)) {
      format = "word_magnet";
    }

    initial.set(item.id, format);
  }

  // 규칙 4: matchup으로 배정된 단어가 세션 전체에서 3개 미만이면 전부 type_answer로 하향.
  const matchupCount = [...initial.values()].filter((f) => f === "matchup").length;
  if (matchupCount > 0 && matchupCount < 3) {
    for (const [id, format] of initial) {
      if (format === "matchup") initial.set(id, "type_answer");
    }
  }

  // 규칙 5: 유료 유형 비허용이면 sentence_making/recording을 전부 word_magnet으로.
  if (!options.allowPaidTypes) {
    for (const [id, format] of initial) {
      if (format === "sentence_making" || format === "recording") {
        initial.set(id, "word_magnet");
      }
    }
  }

  const buckets = emptyBuckets<T>();
  for (const item of items) {
    const format = initial.get(item.id) ?? "word_magnet";
    buckets[format].push(item);
  }

  return buckets;
}

/**
 * assignReviewFormats의 규칙 1~3(하향 조정용 데이터 유효성 검사)을 포맷 단위로 뽑아낸 것.
 * "이 아이템을 이 포맷으로 내도 되는가"만 판정하고, stage 기반 초기 배정이나 규칙 4/5(matchup
 * 개수 하향, 유료 유형 강제 하향)는 다루지 않는다 — 그건 호출부(reassignAvoidingFormats)의 책임.
 */
export function isFormatViable(item: ReviewFormatSourceItem, format: ReviewFormat): boolean {
  switch (format) {
    case "matchup":
    case "type_answer":
      return hasText(item.meaning);
    case "fill_blank":
      return hasText(item.sentence) && hasText(item.answer) && item.sentence.includes(item.answer);
    case "sentence_making":
      return hasText(item.word) && hasText(item.meaning);
    case "recording":
      return hasText(item.sentence);
    case "word_magnet":
      return hasText(item.sentence);
    default:
      return false;
  }
}

/**
 * "다른 유형으로 이어서 풀기"용 재배정. 방금 그 아이템이 풀었던 포맷(avoidFormatOf)을 피해서,
 * REVIEW_FORMAT_ORDER를 그 포맷 다음 순서부터 순환하며 데이터가 감당되는 첫 포맷을 고른다.
 * 전부 안 맞으면 word_magnet(항상 최종 폴백). 배정 후 assignReviewFormats의 규칙 4(matchup이
 * 1~2개면 전부 type_answer로 하향)를 동일하게 다시 적용한다.
 */
export function reassignAvoidingFormats<T extends ReviewFormatSourceItem>(
  items: T[],
  avoidFormatOf: Record<string, ReviewFormat>,
  options: AssignOptions
): ReviewFormatBuckets<T> {
  const n = REVIEW_FORMAT_ORDER.length;
  const initial = new Map<string, ReviewFormat>();

  for (const item of items) {
    const avoid = avoidFormatOf[item.id] ?? "matchup";
    const avoidIdx = REVIEW_FORMAT_ORDER.indexOf(avoid);
    let chosen: ReviewFormat = "word_magnet";

    for (let step = 1; step <= n; step++) {
      const candidate = REVIEW_FORMAT_ORDER[(avoidIdx + step) % n];
      if (candidate === avoid) continue;
      if (!options.allowPaidTypes && (candidate === "sentence_making" || candidate === "recording")) {
        continue;
      }
      if (isFormatViable(item, candidate)) {
        chosen = candidate;
        break;
      }
    }

    initial.set(item.id, chosen);
  }

  // 규칙 4: matchup으로 배정된 단어가 세션 전체에서 3개 미만이면 전부 type_answer로 하향.
  const matchupCount = [...initial.values()].filter((f) => f === "matchup").length;
  if (matchupCount > 0 && matchupCount < 3) {
    for (const [id, format] of initial) {
      if (format === "matchup") initial.set(id, "type_answer");
    }
  }

  const buckets = emptyBuckets<T>();
  for (const item of items) {
    const format = initial.get(item.id) ?? "word_magnet";
    buckets[format].push(item);
  }

  return buckets;
}

/** ReviewFormatBuckets를 { itemId: format } 맵으로 펼친다. */
export function bucketsToFormatMap<T extends ReviewFormatSourceItem>(
  buckets: ReviewFormatBuckets<T>
): Record<string, ReviewFormat> {
  const map: Record<string, ReviewFormat> = {};
  REVIEW_FORMAT_ORDER.forEach((fmt) => {
    buckets[fmt].forEach((it) => {
      map[it.id] = fmt;
    });
  });
  return map;
}
