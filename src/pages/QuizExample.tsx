import { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lightbulb, Volume2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskTranslation } from "@/utils/maskTranslation";

// 예제 문제 데이터 (스크린샷 기반)
const EXAMPLE_PROBLEMS = [
  {
    id: 1,
    word: "학생",
    sentence: "저는 (학생이라서) 돈이 많지 않아요.",
    answer: "학생이라서",
    hint: "-(이)라서",
    translation: "Because I'm [a student], I don't have much money.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-0_sentence.mp3",
    choices: ["학생", "마음에 들다", "예쁘다", "무료", "알리다"]
  },
  {
    id: 2,
    word: "마음에 들다",
    sentence: "그 옷이 (마음에 들면) 바로 살 거예요.",
    answer: "마음에 들면",
    hint: "-(으)면",
    translation: "If I [like] that outfit, I'll buy it right away.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-1_sentence.mp3",
    choices: []
  },
  {
    id: 3,
    word: "예쁘다",
    sentence: "저는 (예쁜) 가방을 하나 사고 싶어요.",
    answer: "예쁜",
    hint: "(으)ㄴ",
    translation: "I want to buy a [pretty] bag.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-2_1767707790032.mp3",
    choices: []
  },
  {
    id: 4,
    word: "무료",
    sentence: "오늘은 공휴일이어서 박물관에 (무료로) 들어갈 수 있어요.",
    answer: "무료로",
    hint: "(으)로",
    translation: "You can get into the museum [for free] today since it's a public holiday.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-3_1767704747952.mp3",
    choices: [] 
  },
  {
    id: 5,
    word: "알리다",
    sentence: "친구에게 대학교 합격 소식을 (알리기 전에) 부모님께 먼저 말했어요.",
    answer: "알리기 전에",
    hint: "-기 전에",
    translation: "I told my parents about my college acceptance before [telling] my friends.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-4_1767704767454.mp3",
    choices: []
  }
];

const EXAMPLE_WORDS = ["마음에 들다", "알리다", "학생", "무료", "예쁘다" ];



export default function QuizExample() {
  const navigate = useNavigate();
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showTranslations, setShowTranslations] = useState<Record<number, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAnswerChange = (id: number, value: string) => {
    setUserAnswers(prev => ({ ...prev, [id]: value }));
  };

  const toggleTranslation = (id: number) => {
    setShowTranslations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const speakText = (text: string, id: number) => {
      if (!('speechSynthesis' in window)) {
        toast.error("브라우저가 음성 재생을 지원하지 않습니다.");
        setPlayingAudio(null);
        return;
      }

      window.speechSynthesis.cancel();
      setPlayingAudio(id);

      const cleanText = text.replace(/\(.*?\)/, "something").replace(/\s+/g, " ");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;

      utterance.onend = () => {
        setPlayingAudio(null);
      };
      utterance.onerror = () => {
        setPlayingAudio(null);
      };
      window.speechSynthesis.speak(utterance);
    };

  const playAudio = (audioUrl: string | undefined, id: number, fallbackText: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (playingAudio === id) {
      setPlayingAudio(null);
      return;
    }

    setPlayingAudio(id);

    // Try to play real audio file first
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingAudio(null);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        console.error("Audio playback error, falling back to TTS");
        audioRef.current = null;
        // Fallback to TTS
        speakText(fallbackText, id);
      };
      
      audio.play().catch(() => {
        // Fallback to TTS on play error
        speakText(fallbackText, id);
      });
    } else {
      // No URL provided, use TTS
      speakText(fallbackText, id);
    }
  };

  const handleSubmit = () => {
    const results = EXAMPLE_PROBLEMS.map(p => {
        const userInput = (userAnswers[p.id] || "").trim().replace(/\s+/g, "");
        const answer = p.answer.replace(/\s+/g, "");
        return {
            problemId: p.id.toString(),
            userAnswer: userAnswers[p.id],
            correctAnswer: p.answer,
            isCorrect: userInput === answer,
            sentence: p.sentence,
            translation: p.translation,
            audioUrl: p.sentence_audio_url
        };
    });

    const correctCount = results.filter(r => r.isCorrect).length;
    
    const resultData = {
      quizTitle: "한국어 기초 단어 퀴즈 (맛보기)",
      score: correctCount,
      total: EXAMPLE_PROBLEMS.length,
      answers: results
    };
    
    localStorage.setItem('anonymous_quiz_result', JSON.stringify(resultData));
    navigate('/quiz/example/result');
  };
  
  const allAnswered = EXAMPLE_PROBLEMS.every(p => (userAnswers[p.id] || "").trim().length > 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
         {/* Simple Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/">
                        <Button variant="ghost" size="icon" className="mr-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="font-bold text-lg">한국어 기초 단어 퀴즈 (맛보기)</h1>
                </div>
            </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-5xl">
             <div className="mb-4 text-center">
                <span className="inline-block px-4 py-2 bg-muted rounded-md text-lg font-semibold">
                    세트 1
                </span>
            </div>

            <Card className="shadow-lg">
                <CardContent className="py-6">
                    {/* Word Bank */}
                    <div className="mb-8">
                        <p className="text-sm text-muted-foreground mb-3 text-center">보기</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {EXAMPLE_WORDS.map((word, idx) => (
                                <span key={idx} className="px-4 py-1.5 rounded-full text-sm bg-background border font-medium">
                                    {word}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Problems List */}
                    <div className="space-y-0 divide-y">
                        {EXAMPLE_PROBLEMS.map((problem, idx) => {
                             // Clean up sentence for split
                             let sentenceCleanup = problem.sentence.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");
                             const parts = sentenceCleanup.split(/\(\s*.*?\s*\)|\(\)/);
                             
                             return (
                                 <div key={problem.id} className="py-4">
                                     {/* Desktop Layout */}
                                     <div className="hidden sm:block">
                                         <div className="flex items-center gap-3">
                                             <span className="text-primary font-bold min-w-[24px]">{idx + 1}.</span>
                                             <div className="flex-1 flex items-center flex-wrap gap-1">
                                                 {parts.map((part, partIdx, arr) => (
                                                     <span key={partIdx} className="inline-flex items-center">
                                                         <span className="text-lg whitespace-nowrap leading-relaxed">{part}</span>
                                                         {partIdx < arr.length - 1 && (
                                                             <>
                                                                <Input 
                                                                    value={userAnswers[problem.id] || ""}
                                                                    onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                                                    className="min-w-[120px] w-auto h-9 mx-1 text-center text-base inline-block border-primary/30 focus-visible:ring-primary"
                                                                    placeholder="정답 입력"
                                                                    autoComplete="off"
                                                                />
                                                                {problem.hint && <span className="text-primary text-base font-medium">{problem.hint}</span>}
                                                             </>
                                                         )}
                                                     </span>
                                                 ))}
                                             </div>
                                             <div className="flex gap-2 shrink-0">
                                                 <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => playAudio(problem.sentence_audio_url, problem.id, problem.sentence)}
                                                    className={cn(playingAudio === problem.id && "border-primary text-primary")}
                                                 >
                                                     <Volume2 className={cn("w-4 h-4 mr-1", playingAudio === problem.id && "animate-pulse")} />
                                                     듣기
                                                 </Button>
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => toggleTranslation(problem.id)}
                                                    className={cn(showTranslations[problem.id] && "border-warning text-warning")}
                                                  >
                                                     <Lightbulb className="w-4 h-4 mr-1" />
                                                     힌트
                                                 </Button>
                                             </div>
                                         </div>
                                         {showTranslations[problem.id] && (
                                             <div className="mt-2 ml-9 px-4 py-2 bg-info/10 rounded-lg text-sm border border-info/30 text-muted-foreground">
                                                 {maskTranslation(problem.translation)}
                                             </div>
                                         )}
                                     </div>

                                     {/* Mobile Layout */}
                                     <div className="flex flex-col gap-3 sm:hidden">
                                          <div className="flex items-start gap-2">
                                              <span className="text-primary font-bold">{idx + 1}.</span>
                                              <div className="flex-1">
                                                  <p className="text-lg leading-relaxed">
                                                      {parts[0]}
                                                      <span className="text-muted-foreground mx-1">( _____ )</span>
                                                      {problem.hint && <span className="text-primary text-base font-medium">{problem.hint}</span>}
                                                      {parts[1]}
                                                  </p>
                                              </div>
                                          </div>
                                          
                                          <div className="pl-6 space-y-2">
                                              <Input 
                                                  value={userAnswers[problem.id] || ""}
                                                  onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                                                  className="h-10 text-center text-base"
                                                  placeholder="정답을 입력하세요"
                                              />
                                              <div className="flex justify-end gap-2">
                                                  <Button 
                                                      variant="outline" 
                                                      size="sm" 
                                                      className="flex-1"
                                                      onClick={() => playAudio(problem.sentence_audio_url, problem.id, problem.sentence)}
                                                  >
                                                      <Volume2 className="w-4 h-4 mr-2" /> 듣기
                                                  </Button>
                                                  <Button 
                                                      variant="outline" 
                                                      size="sm" 
                                                      className="flex-1"
                                                      onClick={() => toggleTranslation(problem.id)}
                                                  >
                                                      <Lightbulb className="w-4 h-4 mr-2" /> 힌트
                                                  </Button>
                                              </div>
                                              {showTranslations[problem.id] && (
                                                 <div className="px-3 py-2 bg-info/10 rounded-lg text-sm border border-info/30 text-muted-foreground">
                                                    {maskTranslation(problem.translation)}
                                                 </div>
                                              )}
                                          </div>
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Bottom Actions */}
            <div className="mt-8 flex justify-end">
                <Button 
                    size="lg" 
                    className="w-full sm:w-auto min-w-[200px] h-12 text-lg font-bold shadow-md hover:shadow-xl transition-all"
                    onClick={handleSubmit}
                    disabled={!allAnswered}
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    채점하기
                </Button>
            </div>

        </div>
      </div>
    </AppLayout>
  );
}
