import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// get_class_srs_summary RPC가 반환하는 한 행 — 학생 1명 x stage 1개의 단어 수 집계.
export interface ClassSrsSummaryRow {
  student_id: string;
  stage: number;
  word_count: number;
  due_now_count: number;
}

// get_class_srs_summary는 아직 src/integrations/supabase/types.ts에 등록돼 있지 않아
// supabase.rpc의 함수명 유니온에 없다. get_class_wrong_answers와 같은 우회를 쓴다.
// 반드시 supabase 객체에 붙여서 호출할 것 — rpc()는 내부에서 this.rest를 쓰기 때문에
// 메서드만 떼어내(const rpc = supabase.rpc) 호출하면 런타임에 깨진다.
type UntypedRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** 선생님이 자기 반 학생들의 SRS 단계 분포를 보는 훅. 담임이 아닌 반이면 빈 배열이 온다(RPC 내부 검증). */
export function useClassSrsSummary(classId: string) {
  return useQuery({
    queryKey: ['classSrsSummary', classId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
        'get_class_srs_summary',
        { _class_id: classId }
      );
      if (error) throw error;
      return (data ?? []) as ClassSrsSummaryRow[];
    },
    enabled: !!classId,
  });
}
