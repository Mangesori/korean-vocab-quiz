import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubmissionTimes {
  fillBlank: string;
  sentenceMaking: string | null;
  recording: string | null;
}

export function useSubmissionTimes(
  resultId: string,
  sentenceMakingEnabled: boolean,
  recordingEnabled: boolean
) {
  const [times, setTimes] = useState<SubmissionTimes | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTimes = async (fillBlankTime: string) => {
    if (times) return;
    setIsLoading(true);

    // Supabase 쿼리 빌더의 .then()은 Promise가 아니라 PromiseLike를 돌려주므로
    // 배열 타입을 PromiseLike로 맞춘다 (Promise.all은 둘 다 받는다).
    const queries: PromiseLike<string | null>[] = [];

    if (sentenceMakingEnabled) {
      queries.push(
        supabase
          .from("sentence_making_answers")
          .select("created_at")
          .eq("result_id", resultId)
          .order("created_at", { ascending: false })
          .limit(1)
          .then(({ data }) => data?.[0]?.created_at ?? null)
      );
    } else {
      queries.push(Promise.resolve(null));
    }

    if (recordingEnabled) {
      queries.push(
        supabase
          .from("recording_answers")
          .select("created_at")
          .eq("result_id", resultId)
          .order("created_at", { ascending: false })
          .limit(1)
          .then(({ data }) => data?.[0]?.created_at ?? null)
      );
    } else {
      queries.push(Promise.resolve(null));
    }

    const [sentenceMaking, recording] = await Promise.all(queries);

    setTimes({ fillBlank: fillBlankTime, sentenceMaking, recording });
    setIsLoading(false);
  };

  return { times, isLoading, fetchTimes };
}
