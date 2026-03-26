import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Mic,
  Square,
  Volume2,
  PlayCircle,
  CheckCircle,
  RefreshCw,
  Lightbulb,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface SpeakingProblem {
  id: string;
  sentence: string;
  mode: "read" | "listen";
  sentenceAudioUrl?: string;
  translation?: string;
}

interface SpeakingAttempt {
  attemptNumber: number;
  recordingUrl: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number;
  overallScore: number;
  wordLevelFeedback: { word: string; accuracyScore: number; errorType?: string }[];
  isPassed: boolean;
}

interface SpeakingStageProps {
  quizId: string;
  problems: SpeakingProblem[];
  onProgressUpdate?: (current: number, total: number, label: string) => void;
  onComplete: (results: Record<string, SpeakingAttempt[]>) => void;
}

// WebM을 WAV로 변환하는 함수
async function convertToWav(webmBlob: Blob): Promise<Blob> {
  const audioContext = new AudioContext();
  const arrayBuffer = await webmBlob.arrayBuffer();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 16kHz 모노로 리샘플링 (Azure 권장)
    const targetSampleRate = 16000;
    const numChannels = 1;

    const offlineContext = new OfflineAudioContext(
      numChannels,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // WAV 인코딩
    const wavBuffer = encodeWav(renderedBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Audio data
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function SpeakingStage({ quizId, problems, onProgressUpdate, onComplete }: SpeakingStageProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, SpeakingAttempt[]>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [wantsRetry, setWantsRetry] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentProblem = problems[currentIndex];
  const currentAttempts = attempts[currentProblem?.id] || [];
  const lastAttempt = currentAttempts[currentAttempts.length - 1];
  const isCompleted = (lastAttempt?.isPassed || currentAttempts.length >= 3) && !wantsRetry;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (onProgressUpdate && problems.length > 0) {
      onProgressUpdate(currentIndex + 1, problems.length, `${currentIndex + 1}/${problems.length}`);
    }
  }, [currentIndex, problems.length, onProgressUpdate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        await processRecording(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // 녹음 시간 타이머
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error("마이크 접근에 실패했습니다. 브라우저 설정을 확인해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // 1. WAV로 변환
      const wavBlob = await convertToWav(audioBlob);

      // 2. Supabase Storage에 업로드
      const studentId = user?.id || "anon";
      const fileName = `${quizId}/${currentProblem.id}/${studentId}_${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from("quiz-recordings")
        .upload(fileName, wavBlob, {
          contentType: "audio/wav",
        });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw new Error(`녹음 파일 업로드에 실패했습니다: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("quiz-recordings")
        .getPublicUrl(fileName);

      const recordingUrl = urlData.publicUrl;

      // 3. Base64 변환
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(wavBlob);
      });

      // 4. Azure Speech 평가 호출
      const { data, error } = await supabase.functions.invoke("azure-speech-assessment", {
        body: {
          audioBase64,
          referenceText: currentProblem.sentence,
          quizId,
          problemId: currentProblem.id,
          attemptNumber: currentAttempts.length + 1,
          recordingUrl,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const newAttempt: SpeakingAttempt = {
        attemptNumber: currentAttempts.length + 1,
        recordingUrl,
        pronunciationScore: data.pronunciationScore,
        accuracyScore: data.accuracyScore,
        fluencyScore: data.fluencyScore,
        completenessScore: data.completenessScore,
        prosodyScore: data.prosodyScore,
        overallScore: data.overallScore,
        wordLevelFeedback: data.wordLevelFeedback,
        isPassed: data.isPassed,
      };

      setAttempts((prev) => ({
        ...prev,
        [currentProblem.id]: [...(prev[currentProblem.id] || []), newAttempt],
      }));
      setWantsRetry(false);


    } catch (error: any) {
      console.error("Recording processing error:", error);
      toast.error(error.message || "녹음 처리에 실패했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = async (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onplay = () => setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
      setIsPlayingAudio(false);
      toast.error("음성 재생에 실패했습니다.");
    };

    audio.play();
  };

  const handleNext = () => {
    setWantsRetry(false);
    if (currentIndex < problems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete(attempts);
    }
  };

  const handleRetry = () => {
    setWantsRetry(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderSentenceWithFeedback = (sentence: string, wordFeedback: { word: string; accuracyScore: number; errorType?: string }[]) => {
    if (!wordFeedback || wordFeedback.length === 0) {
      return <span>{sentence}</span>;
    }

    const lowScoreWords = new Set(
      wordFeedback
        .filter((w) => w.accuracyScore < 60)
        .map((w) => w.word)
    );

    if (lowScoreWords.size === 0) {
      return <span>{sentence}</span>;
    }

    const words = sentence.split(/(\s+)/);
    return (
      <span>
        {words.map((word, idx) => {
          const cleanWord = word.replace(/[.,!?。，！？]/g, "");
          if (lowScoreWords.has(cleanWord)) {
            return (
              <span key={idx} className="text-destructive font-bold">
                {word}
              </span>
            );
          }
          return <span key={idx}>{word}</span>;
        })}
      </span>
    );
  };

  if (!currentProblem) {
    return null;
  }

  return (
    <Card className="w-full max-w-5xl mx-auto border shadow-sm rounded-2xl overflow-hidden bg-white mb-4 sm:mb-8 mt-2 lg:mt-6">

      <CardContent className="p-4 sm:p-8 pt-4 sm:pt-0 space-y-4 sm:space-y-6">
        {/* 문장 표시 */}
          <div className="p-5 sm:p-10 bg-slate-50 border-none rounded-2xl flex flex-col min-h-[220px] sm:min-h-[250px] mt-2 sm:mt-6">
            <div className="flex w-full items-center justify-between mb-6 sm:mb-8">
              <div className="text-xs sm:text-sm font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-3 py-1.5 rounded-full inline-flex items-center">
                {currentProblem.mode === "listen" ? "듣고 말하기" : "보고 말하기"}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowHint(!showHint)}
                className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
              >
                <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${showHint ? "text-warning" : ""}`} />
                힌트
              </Button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              {currentProblem.mode === "read" ? (
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-foreground leading-relaxed text-center drop-shadow-sm">{currentProblem.sentence}</h3>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6">
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium mb-2">음성을 듣고 따라 녹음하세요</p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      currentProblem.sentenceAudioUrl &&
                      playAudio(currentProblem.sentenceAudioUrl)
                    }
                    disabled={isPlayingAudio || !currentProblem.sentenceAudioUrl}
                    className="flex items-center justify-center rounded-xl px-6 h-11 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm"
                  >
                    {isPlayingAudio ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4 mr-2" />
                    )}
                    <span className="font-semibold">{isPlayingAudio ? "재생 중..." : "듣기"}</span>
                  </Button>
                </div>
              )}

              <p className={`text-sm sm:text-base text-muted-foreground mt-4 sm:mt-6 text-center transition-opacity duration-200 ${showHint && currentProblem.translation ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {currentProblem.translation || ""}
              </p>
            </div>
          </div>

          {/* 녹음 버튼 */}
          {(!isCompleted || wantsRetry) && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className="rounded-full w-20 h-20"
                >
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 text-destructive">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="font-mono">{formatTime(recordingTime)}</span>
                </div>
              )}
              {isProcessing && (
                <p className="text-sm text-muted-foreground">평가 중...</p>
              )}

            </div>
          )}

          {/* 마지막 시도 결과만 표시 */}
          {lastAttempt && !wantsRetry && (
            <div
              className={`p-4 rounded-lg border ${
                lastAttempt.isPassed
                  ? "bg-success/10 border-success/30"
                  : "bg-warning/10 border-warning/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playAudio(lastAttempt.recordingUrl)}
                    className="h-8"
                  >
                    <PlayCircle className="w-4 h-4 mr-1" />
                    재생
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {lastAttempt.isPassed ? (
                    <CheckCircle className="w-6 h-6 text-success" />
                  ) : (
                    <RefreshCw className="w-6 h-6 text-warning" />
                  )}
                </div>
              </div>

              {/* 문장에서 60점 미만 단어만 빨간색으로 표시 */}
              <p className="text-lg text-center py-2">
                {renderSentenceWithFeedback(currentProblem.sentence, lastAttempt.wordLevelFeedback)}
              </p>
            </div>
          )}
          {/* 다음/다시 시도 버튼 */}
          {lastAttempt && !wantsRetry && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={currentAttempts.length >= 3}
                className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                다시 시도하기
              </Button>

              <Button
                onClick={handleNext}
                className="h-12 px-6 rounded-xl bg-[#6366F1] text-white font-semibold hover:bg-[#4F46E5] shadow-md transition-colors"
              >
                {currentIndex < problems.length - 1 ? (
                  <>
                    다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    결과보기
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
