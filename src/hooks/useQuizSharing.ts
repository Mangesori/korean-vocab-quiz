
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Quiz, Class } from "./useQuizData";

export function useQuizSharing(quiz: Quiz | null, user: any, classes: Class[]) {
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  
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

  const handleSendQuiz = async (selectedClassId: string, onSuccess: () => void) => {
    if (!selectedClassId || !quiz) return;

    setIsSending(true);

    try {
      // Get class members
      const { data: members, error: membersError } = await supabase
        .from("class_members")
        .select("student_id")
        .eq("class_id", selectedClassId);

      if (membersError) throw membersError;

      // Create assignment
      const { error: assignError } = await supabase.from("quiz_assignments").insert({
        quiz_id: quiz.id,
        class_id: selectedClassId,
      });

      if (assignError) throw assignError;

      // Get class name
      const selectedClass = classes.find((c) => c.id === selectedClassId);

      // Create notifications for all students
      if (members && members.length > 0) {
        const notifications = members.map((m) => ({
          user_id: m.student_id,
          type: "quiz_assigned" as const,
          title: "새 퀴즈가 도착했습니다!",
          message: `${quiz.title} 퀴즈가 할당되었습니다.`,
          quiz_id: quiz.id,
          from_user_id: user?.id,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast.success(`${selectedClass?.name} 클래스에 퀴즈를 보냈습니다!`);
      setSendDialogOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Send error:", error);
      toast.error("퀴즈 전송에 실패했습니다");
    } finally {
      setIsSending(false);
    }
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
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  };
}
