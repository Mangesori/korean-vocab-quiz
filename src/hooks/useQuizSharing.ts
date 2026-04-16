
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Quiz, Class } from "./useQuizData";

export function useQuizSharing(quiz: Quiz | null, user: any, classes: Class[]) {
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // 재할당 확인 다이얼로그 상태
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [pendingReassignClassId, setPendingReassignClassId] = useState<string>("");
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  // Link sharing states
  const [shareUrl, setShareUrl] = useState<string>("");
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Reset share URL when dialog closes
  useEffect(() => {
    if (!sendDialogOpen) {
      setShareUrl("");
    }
  }, [sendDialogOpen]);

  // 실제 할당 실행 (중복 체크 통과 후 공통 로직)
  const doAssign = async (selectedClassId: string, onSuccess: () => void) => {
    const { data: members, error: membersError } = await supabase
      .from("class_members")
      .select("student_id")
      .eq("class_id", selectedClassId);

    if (membersError) throw membersError;

    const { error: assignError } = await supabase.from("quiz_assignments").insert({
      quiz_id: quiz!.id,
      class_id: selectedClassId,
    });

    if (assignError) throw assignError;

    const selectedClass = classes.find((c) => c.id === selectedClassId);

    if (members && members.length > 0) {
      const notifications = members.map((m) => ({
        user_id: m.student_id,
        type: "quiz_assigned" as const,
        title: "새 퀴즈가 도착했습니다!",
        message: `${quiz!.title} 퀴즈가 할당되었습니다.`,
        quiz_id: quiz!.id,
        from_user_id: user?.id,
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Notification creation error:", notifError);
        toast.error("알림 전송에 실패했습니다", {
          description: "퀴즈는 할당되었지만 학생들에게 알림이 전송되지 않았습니다."
        });
      } else {
        console.log(`Successfully created ${notifications.length} notifications for quiz assignment`);
      }
    }

    toast.success(`${selectedClass?.name} 클래스에 퀴즈를 보냈습니다!`);
    setSendDialogOpen(false);
    onSuccess();
  };

  const handleSendQuiz = async (selectedClassId: string, onSuccess: () => void) => {
    if (!selectedClassId || !quiz) return;

    setIsSending(true);

    try {
      // 이미 이 클래스에 할당된 적 있는지 확인
      const { data: existingAssignment } = await supabase
        .from("quiz_assignments")
        .select("id, assigned_at")
        .eq("quiz_id", quiz.id)
        .eq("class_id", selectedClassId)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAssignment) {
        // 클래스 멤버 조회 (완료 여부 확인용)
        const { data: members } = await supabase
          .from("class_members")
          .select("student_id")
          .eq("class_id", selectedClassId);

        const memberIds = (members || []).map((m) => m.student_id);

        // 가장 최근 할당 이후에 완료한 학생이 있는지 확인
        const { data: completedAfter } = memberIds.length > 0
          ? await supabase
              .from("quiz_results")
              .select("student_id")
              .eq("quiz_id", quiz.id)
              .gt("completed_at", existingAssignment.assigned_at)
              .in("student_id", memberIds)
          : { data: [] };

        if (!completedAfter?.length) {
          // 케이스 A: 아직 아무도 풀지 않은 퀴즈를 재할당 → 막기
          toast.error("이미 이 클래스에 할당된 퀴즈입니다.");
          return;
        }

        // 케이스 B: 이미 완료한 학생이 있음 → 재할당 확인 다이얼로그
        setPendingReassignClassId(selectedClassId);
        pendingCallbackRef.current = onSuccess;
        setReassignDialogOpen(true);
        return;
      }

      await doAssign(selectedClassId, onSuccess);
    } catch (error) {
      console.error("Send error:", error);
      toast.error("퀴즈 전송에 실패했습니다");
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!pendingReassignClassId || !quiz) return;

    setReassignDialogOpen(false);
    setIsSending(true);

    try {
      await doAssign(pendingReassignClassId, pendingCallbackRef.current || (() => {}));
    } catch (error) {
      console.error("Reassign error:", error);
      toast.error("퀴즈 재할당에 실패했습니다");
    } finally {
      setIsSending(false);
      setPendingReassignClassId("");
      pendingCallbackRef.current = null;
    }
  };

  const handleCancelReassign = () => {
    setReassignDialogOpen(false);
    setPendingReassignClassId("");
    pendingCallbackRef.current = null;
  };

  const generateShareLink = async () => {
    if (!quiz) return;

    setIsGeneratingLink(true);

    try {
      const shareToken = nanoid(12);
      
      const { error } = await supabase.from("quiz_shares").insert({
        quiz_id: quiz.id,
        share_token: shareToken,
        created_by: user?.id,
        allow_anonymous: allowAnonymous,
        max_attempts: 3,
      });

      if (error) throw error;

      const url = `${window.location.origin}/quiz/share/${shareToken}`;
      setShareUrl(url);
      toast.success("공유 링크가 생성되었습니다!");
    } catch (error) {
      console.error("Share link error:", error);
      toast.error("링크 생성에 실패했습니다");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("링크가 복사되었습니다");
  };

  return {
    isSending,
    sendDialogOpen,
    setSendDialogOpen,
    reassignDialogOpen,
    handleConfirmReassign,
    handleCancelReassign,
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  };
}
