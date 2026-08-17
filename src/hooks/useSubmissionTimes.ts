import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubmissionTimes {
  fillBlank: string;
  matchup: string | null;
  typeAnswer: string | null;
  wordMagnet: string | null;
  sentenceMaking: string | null;
  recording: string | null;
  /** 활성화된 스테이지 중 가장 늦게 제출된 시각. "제출 시간"의 표시 기준으로 쓴다. */
  latest: string;
}

export interface SubmissionTimeFlags {
  matchupEnabled: boolean;
  typeAnswerEnabled: boolean;
  sentenceMakingEnabled: boolean;
  recordingEnabled: boolean;
  wordMagnetEnabled: boolean;
}

export function useSubmissionTimes(
  resultId: string,
  fillBlankTime: string,
  flags: SubmissionTimeFlags
) {
  const { matchupEnabled, typeAnswerEnabled, sentenceMakingEnabled, recordingEnabled, wordMagnetEnabled } = flags;
  const [times, setTimes] = useState<SubmissionTimes | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchTimes = async () => {
      setIsLoading(true);

      // Supabase 쿼리 빌더의 .then()은 Promise가 아니라 PromiseLike를 돌려주므로
      // 배열 타입을 PromiseLike로 맞춘다 (Promise.all은 둘 다 받는다).
      const queryFor = (table: string, enabled: boolean): PromiseLike<string | null> =>
        enabled
          ? supabase
              .from(table as "matchup_answers")
              .select("created_at")
              .eq("result_id", resultId)
              .order("created_at", { ascending: false })
              .limit(1)
              .then(({ data }) => data?.[0]?.created_at ?? null)
          : Promise.resolve(null);

      const [matchup, typeAnswer, wordMagnet, sentenceMaking, recording] = await Promise.all([
        queryFor("matchup_answers", matchupEnabled),
        queryFor("type_answer_answers", typeAnswerEnabled),
        queryFor("word_magnet_answers", wordMagnetEnabled),
        queryFor("sentence_making_answers", sentenceMakingEnabled),
        queryFor("recording_answers", recordingEnabled),
      ]);

      if (cancelled) return;

      const latest = [fillBlankTime, matchup, typeAnswer, wordMagnet, sentenceMaking, recording]
        .filter((t): t is string => !!t)
        .reduce((max, t) => (new Date(t).getTime() > new Date(max).getTime() ? t : max), fillBlankTime);

      setTimes({ fillBlank: fillBlankTime, matchup, typeAnswer, wordMagnet, sentenceMaking, recording, latest });
      setIsLoading(false);
    };

    fetchTimes();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId]);

  return { times, isLoading };
}
