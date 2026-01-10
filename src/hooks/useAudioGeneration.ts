
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Problem } from "./useQuizData";

export function useAudioGeneration(quizId: string | undefined) {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [regeneratingProblemId, setRegeneratingProblemId] = useState<string | null>(null);

  // Helper to generate and upload a single audio file
  const generateAndUploadAudio = async (text: string, problemId: string, answer: string): Promise<string | null> => {
    if (!quizId) return null;

    try {
      // 빈칸을 정답으로 대체하여 완전한 문장 만들기
      let cleanText = text.replace(/\(\s*\)|\(\)/g, answer);
      cleanText = cleanText.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      if (!response.ok) {
        console.error(`TTS generation failed: ${response.status}`);
        return null;
      }

      const audioBlob = await response.blob();
      const timestamp = Date.now();
      const fileName = `${quizId}/${problemId}_${timestamp}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from('quiz-audio')
        .upload(fileName, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Audio upload failed:`, uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('quiz-audio')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`TTS error:`, error);
      return null;
    }
  };

  const regenerateAllAudio = async (problems: Problem[], onAudioGenerated: (problemId: string, url: string) => void) => {
    if (!quizId) return;

    setIsGeneratingAudio(true);
    setAudioProgress({ current: 0, total: problems.length });

    try {
      // 순차적으로 TTS 생성 (429 에러 방지)
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        setAudioProgress({ current: i + 1, total: problems.length });
        
        const audioUrl = await generateAndUploadAudio(
          problem.sentence,
          problem.id,
          problem.answer
        );

        if (audioUrl) {
          onAudioGenerated(problem.id, audioUrl);
          
          // quiz_problems 테이블 업데이트
          await supabase
            .from("quiz_problems")
            .update({ sentence_audio_url: audioUrl })
            .eq("quiz_id", quizId)
            .eq("problem_id", problem.id);
        }
      }

      toast.success("음성 생성이 완료되었습니다!");
    } catch (error) {
      console.error("Audio generation error:", error);
      toast.error("음성 생성에 실패했습니다");
    } finally {
      setIsGeneratingAudio(false);
      setAudioProgress({ current: 0, total: 0 });
    }
  };

  const regenerateSingleAudio = async (problem: Problem, onAudioGenerated: (problemId: string, url: string) => void) => {
    if (!quizId) return;

    setRegeneratingProblemId(problem.id);

    try {
      const audioUrl = await generateAndUploadAudio(
        problem.sentence,
        problem.id,
        problem.answer
      );

      if (audioUrl) {
        await supabase
          .from("quiz_problems")
          .update({ sentence_audio_url: audioUrl })
          .eq("quiz_id", quizId)
          .eq("problem_id", problem.id);
        
        onAudioGenerated(problem.id, audioUrl);
        toast.success(`"${problem.word}" 문제의 음성이 재생성되었습니다`);
      }
    } catch (error) {
      console.error("Single audio generation error:", error);
      toast.error("음성 재생성에 실패했습니다");
    } finally {
      setRegeneratingProblemId(null);
    }
  };

  const playAudio = (url: string | undefined) => {
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  return {
    isGeneratingAudio,
    audioProgress,
    regeneratingProblemId,
    regenerateAllAudio,
    regenerateSingleAudio,
    playAudio
  };
}
