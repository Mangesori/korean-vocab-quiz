import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Users, X } from "lucide-react";

const pillButtonStyle = {
  border: "1px solid #C8DED3",
  borderRadius: 9,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1E6B47",
} as const;
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuizAssignedStudentsProps {
  quizId: string;
  /** 학생 추가 — 기존 "퀴즈 보내기" 다이얼로그를 재사용한다(이 퀴즈에 학생/클래스를 배정하는 유일한 기존 경로). */
  onAddStudent: () => void;
}

/**
 * 2단 아코디언 중 "배정" 항목. 이 퀴즈에 개인 배정된 학생 목록. class_id 없이 배정되는
 * 어휘 보강 퀴즈 등은 "내 클래스" 화면에 안 뜨므로 여기서 보여주고 개별 취소도 할 수 있게 한다.
 * 학생 이름을 클릭하면 그 학생이 속한(내 클래스 중) 반으로 이동한다 — 여러 반에 속해
 * 있으면 그중 하나로 이동한다(교사가 만든 반 기준으로만 찾는다).
 */
/**
 * 배정 학생 목록 조회 — QuizAssignedStudents(펼친 카드)와 QuizHeader(접힌 메타 줄의
 * "배정 지희 1명" 요약)가 같은 쿼리 키를 공유해서 캐시를 재사용한다. 헤더는 접혀 있어도
 * 요약을 보여줘야 하므로 이 훅을 독립적으로 export한다.
 */
export function useQuizAssignedStudents(quizId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["quiz-assigned-students", quizId, user?.id],
    queryFn: async () => {
      // class_id가 있으면 학급 전체 배정(student_id는 비어 있음), student_id가 있으면
      // 개인 배정 — 이 퀴즈 안에 두 종류가 섞여 있을 수 있다.
      const { data: rows, error } = await supabase
        .from("quiz_assignments")
        .select("id, student_id, class_id, assigned_at")
        .eq("quiz_id", quizId)
        .order("assigned_at", { ascending: false });
      if (error) throw error;

      const studentIds = [...new Set((rows ?? []).map((r) => r.student_id).filter((v): v is string => !!v))];
      const directClassIds = [...new Set((rows ?? []).map((r) => r.class_id).filter((v): v is string => !!v))];

      const [{ data: profiles }, { data: myClasses }, { data: directClasses }] = await Promise.all([
        studentIds.length > 0
          ? supabase.from("profiles").select("user_id, name").in("user_id", studentIds)
          : Promise.resolve({ data: [] as { user_id: string; name: string }[] }),
        supabase.from("classes").select("id").eq("teacher_id", user!.id),
        directClassIds.length > 0
          ? supabase.from("classes").select("id, name").in("id", directClassIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const nameByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));
      const classNameById = new Map((directClasses ?? []).map((c) => [c.id, c.name]));

      const myClassIds = (myClasses ?? []).map((c) => c.id);
      let classIdByStudentId = new Map<string, string>();
      if (myClassIds.length > 0 && studentIds.length > 0) {
        const { data: memberRows } = await supabase
          .from("class_members")
          .select("student_id, class_id")
          .in("student_id", studentIds)
          .in("class_id", myClassIds);
        classIdByStudentId = new Map((memberRows ?? []).map((m) => [m.student_id, m.class_id]));
      }

      // 학급 전체 배정은 학생 이름 없이 클래스 이름만 보여준다 — 학생 이름까지 펼치면
      // 반 이름과 학생 이름이 같은 1:1 반(반 이름 = 그 학생 이름)에서 "지희 지희"처럼
      // 중복으로 보이는 문제가 있었다.
      return (rows ?? []).map((r) => {
        if (r.student_id) {
          return {
            id: r.id,
            assignmentId: r.id,
            displayName: nameByUserId.get(r.student_id) ?? "이름 없음",
            typeLabel: null as string | null,
            classId: classIdByStudentId.get(r.student_id) ?? null,
            isClassWide: false,
          };
        }
        return {
          id: r.id,
          assignmentId: r.id,
          displayName: classNameById.get(r.class_id!) ?? "알 수 없는 클래스",
          typeLabel: null as string | null,
          classId: r.class_id,
          isClassWide: true,
        };
      });
    },
    enabled: !!quizId && !!user?.id,
  });
}

/**
 * 펼친 상태에서만 QuizDetail이 렌더링하는 카드 — 트리거는 이제 QuizHeader의 메타 줄에
 * 있으므로 여기엔 목록/버튼만 그린다(자체 트리거 없음).
 */
export function QuizAssignedStudents({ quizId, onAddStudent }: QuizAssignedStudentsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<{ id: string; studentName: string; isClassWide: boolean } | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const { data: students = [], isLoading } = useQuizAssignedStudents(quizId);

  const handleUnassignConfirm = async () => {
    if (!assignmentToUnassign) return;
    setIsUnassigning(true);
    try {
      const { error } = await supabase.from("quiz_assignments").delete().eq("id", assignmentToUnassign.id);
      if (error) throw error;
      toast.success("배정이 취소되었습니다");
      queryClient.setQueryData(
        ["quiz-assigned-students", quizId, user?.id],
        (prev: typeof students | undefined) => prev?.filter((s) => s.assignmentId !== assignmentToUnassign.id) ?? []
      );
      setAssignmentToUnassign(null);
    } catch (error) {
      console.error("Unassign error:", error);
      toast.error("배정 취소에 실패했습니다");
    } finally {
      setIsUnassigning(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #EBE5DE", borderRadius: 14, padding: "16px 18px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-[15px] h-[15px]" style={{ color: "#1E6B47" }} />
            <span className="text-[13.5px] font-bold">배정된 학생</span>
            <span className="text-xs" style={{ color: "#8A837D" }}>{students.length}명</span>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5" style={pillButtonStyle} onClick={onAddStudent}>
            <Plus className="w-3.5 h-3.5" /> 학생 추가
          </button>
        </div>

        {students.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {students.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-2"
                style={{
                  background: "#F4F9F6",
                  border: "1px solid #DCE9E2",
                  borderRadius: 9,
                  padding: "8px 8px 8px 8px",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{ width: 20, height: 20, background: "#E8F1EB", color: "#1E6B47", fontSize: 10, fontWeight: 700 }}
                >
                  {s.isClassWide ? <Users className="h-3 w-3" /> : (s.displayName[0]?.toUpperCase() ?? "?")}
                </span>
                <button
                  type="button"
                  className={s.classId ? "hover:underline" : "cursor-default"}
                  title={s.classId ? "이 클래스로 이동" : undefined}
                  onClick={() => s.classId && navigate(`/class/${s.classId}`)}
                  style={{ color: "#1A1714", fontStyle: s.isClassWide ? "italic" : "normal" }}
                >
                  {s.displayName}
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setAssignmentToUnassign({
                      id: s.assignmentId,
                      studentName: s.displayName,
                      isClassWide: s.isClassWide,
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !isLoading && (
            <p className="text-sm text-muted-foreground mt-3">아직 배정된 학생이 없습니다.</p>
          )
        )}

      <AlertDialog open={!!assignmentToUnassign} onOpenChange={(open) => !open && setAssignmentToUnassign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배정 취소</AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentToUnassign?.isClassWide ? (
                <>
                  "{assignmentToUnassign?.studentName}" 반 전체에 보낸 이 퀴즈 배정을 취소하시겠습니까?
                  <br />
                  이 반 학생 전원에게서 배정이 취소되고, 다른 배정과 퀴즈 자체는 그대로 남아요.
                </>
              ) : (
                <>
                  "{assignmentToUnassign?.studentName}"에게 보낸 이 퀴즈 배정을 취소하시겠습니까?
                  <br />
                  이 배정만 취소되고, 다른 배정과 퀴즈 자체는 그대로 남아요.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigning}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassignConfirm}
              disabled={isUnassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigning ? "처리 중..." : "배정 취소"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
