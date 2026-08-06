
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Problem } from "./useQuizData";
import { generateTtsAudio, type TtsProvider } from "@/utils/ttsService";

export function useAudioGeneration(quizId: string | undefined) {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [regeneratingProblemId, setRegeneratingProblemId] = useState<string | null>(null);

  // Helper to generate and upload a single audio file
  const generateAndUploadAudio = async (
    text: string,
    problemId: string,
    answer: string,
    ttsProvider: TtsProvider = "azure",
  ): Promise<string | null> => {
    if (!quizId) return null;

    try {
      // 빈칸을 정답으로 대체하여 완전한 문장 만들기
      let cleanText = text.replace(/\(\s*\)|\(\)/g, answer);
      cleanText = cleanText.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");

      const audioBlob = await generateTtsAudio(cleanText, ttsProvider);

      if (!audioBlob) {
        console.error(`TTS generation failed`);
        return null;
      }

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

  const regenerateAllAudio = async (
    problems: Problem[],
    onAudioGenerated: (problemId: string, url: string) => void,
    ttsProvider: TtsProvider = "elevenlabs",
  ) => {
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
          problem.answer,
          ttsProvider,
        );

        if (audioUrl) {
          onAudioGenerated(problem.id, audioUrl);

          // quiz_problems 테이블 업데이트 (행이 없으면 삽입)
          await supabase
            .from("quiz_problems")
            .upsert({
              quiz_id: quizId,
              problem_id: problem.id,
              word: problem.word,
              sentence: problem.sentence,
              hint: problem.hint,
              translation: problem.translation,
              sentence_audio_url: audioUrl,
            }, { onConflict: 'quiz_id,problem_id' });

          // recording_problems도 동기화 (listen 모드 문제에 오디오 URL 반영)
          // 단, recording 문장이 fill_blank 완성 문장과 같은 경우(A1/A2)에만 동기화.
          // B1+ 짧은 문장 recording은 자체 오디오를 유지해야 하므로 덮어쓰지 않음.
          const filledSentence = problem.sentence
            .replace(/\(\s*\)|\(\)/g, problem.answer)
            .replace(/([.?!])\s*\.+\s*$/, "$1")
            .trim();
          await supabase
            .from("recording_problems")
            .update({ sentence_audio_url: audioUrl })
            .eq("quiz_id", quizId)
            .eq("problem_id", problem.id)
            .eq("sentence", filledSentence);
        }

        // rate limit 방지: 마지막 문제 제외하고 1초 대기
        if (i < problems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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

  const regenerateSingleAudio = async (
    problem: Problem,
    onAudioGenerated: (problemId: string, url: string) => void,
    ttsProvider: TtsProvider = "elevenlabs",
  ) => {
    if (!quizId) return;

    setRegeneratingProblemId(problem.id);

    try {
      const audioUrl = await generateAndUploadAudio(
        problem.sentence,
        problem.id,
        problem.answer,
        ttsProvider,
      );

      if (audioUrl) {
        // quiz_problems 테이블 업데이트 (행이 없으면 삽입)
        await supabase
          .from("quiz_problems")
          .upsert({
            quiz_id: quizId,
            problem_id: problem.id,
            word: problem.word,
            sentence: problem.sentence,
            hint: problem.hint,
            translation: problem.translation,
            sentence_audio_url: audioUrl,
          }, { onConflict: 'quiz_id,problem_id' });

        // recording_problems도 동기화 (listen 모드 문제에 오디오 URL 반영)
        // 단, recording 문장이 fill_blank 완성 문장과 같은 경우(A1/A2)에만 동기화.
        // B1+ 짧은 문장 recording은 자체 오디오를 유지해야 하므로 덮어쓰지 않음.
        const filledSentence = problem.sentence
          .replace(/\(\s*\)|\(\)/g, problem.answer)
          .replace(/([.?!])\s*\.+\s*$/, "$1")
          .trim();
        await supabase
          .from("recording_problems")
          .update({ sentence_audio_url: audioUrl })
          .eq("quiz_id", quizId)
          .eq("problem_id", problem.id)
          .eq("sentence", filledSentence);

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

