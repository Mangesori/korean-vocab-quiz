import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Volume2, CheckCircle, ArrowLeft, Mic, ChevronRight, ChevronLeft, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskTranslation } from "@/utils/maskTranslation";

const EXAMPLE_PROBLEMS = [
  {
    id: 1,
    word: "학생",
    sentence: "저는 (학생이라서) 돈이 많지 않아요.",
    answer: "학생이라서",
    hint: "-(이)라서",
    translation: "Because I'm [a student], I don't have much money.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-0_sentence.mp3",
  },
  {
    id: 2,
    word: "마음에 들다",
    sentence: "그 옷이 (마음에 들면) 바로 살 거예요.",
    answer: "마음에 들면",
    hint: "-(으)면",
    translation: "If I [like] that outfit, I'll buy it right away.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-1_sentence.mp3",
  },
  {
    id: 3,
    word: "예쁘다",
    sentence: "저는 (예쁜) 가방을 하나 사고 싶어요.",
    answer: "예쁜",
    hint: "(으)ㄴ",
    translation: "I want to buy a [pretty] bag.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-2_1767707790032.mp3",
  },
  {
    id: 4,
    word: "무료",
    sentence: "오늘은 공휴일이어서 박물관에 (무료로) 들어갈 수 있어요.",
    answer: "무료로",
    hint: "(으)로",
    translation: "You can get into the museum [for free] today since it's a public holiday.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-3_1767704747952.mp3",
  },
  {
    id: 5,
    word: "알리다",
    sentence: "친구에게 대학교 합격 소식을 (알리기 전에) 부모님께 먼저 말했어요.",
    answer: "알리기 전에",
    hint: "-기 전에",
    translation: "I told my parents about my college acceptance before [telling] my friends.",
    sentence_audio_url: "https://lkuikpbquqcgbezepkxl.supabase.co/storage/v1/object/public/quiz-audio/f879fc3d-4d30-4559-ad1b-8e2ea71c29ef/problem-1767682692118-4_1767704767454.mp3",
  },
];

const EXAMPLE_WORDS = ["마음에 들다", "알리다", "학생", "무료", "예쁘다"];

const EXAMPLE_SENTENCE_PROBLEMS = [
  { id: 1, word: "학생", translation: "student", stem: "학생", example: "저는 한국어를 열심히 공부하는 학생이에요." },
  { id: 2, word: "예쁘다", translation: "to be pretty", stem: "예쁘", example: "오늘 새로 산 가방이 정말 예쁘네요." },
  { id: 3, word: "마음에 들다", translation: "to like / to be pleased with", stem: "마음에 들", example: "이 카페 분위기가 너무 마음에 들어요." },
];

const EXAMPLE_SPEAKING_PROBLEMS = [
  {
    id: 1,
    sentence: "저는 학생이라서 돈이 많지 않아요.",
    audioUrl: EXAMPLE_PROBLEMS[0].sentence_audio_url,
    translation: EXAMPLE_PROBLEMS[0].translation,
  },
  {
    id: 2,
    sentence: "그 옷이 마음에 들면 바로 살 거예요.",
    audioUrl: EXAMPLE_PROBLEMS[1].sentence_audio_url,
    translation: EXAMPLE_PROBLEMS[1].translation,
  },
];

type Stage = "blank" | "sentence" | "speaking";

const STAGES: { id: Stage; label: string; n: number }[] = [
  { id: "blank", label: "빈칸 채우기", n: 1 },
  { id: "sentence", label: "문장 만들기", n: 2 },
  { id: "speaking", label: "말하기 연습", n: 3 },
];

export default function QuizExample() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("blank");

  // ── 빈칸 stage state ──
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showTranslations, setShowTranslations] = useState<Record<number, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── 문장 stage state ──
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [sentenceAnswers, setSentenceAnswers] = useState<Record<number, string>>({});
  const [sentenceChecked, setSentenceChecked] = useState<Record<number, boolean>>({});

  // ── 말하기 stage state ──
  const [speakingIndex, setSpeakingIndex] = useState(0);
  const [playingSpeak, setPlayingSpeak] = useState(false);
  const speakAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Audio helpers ──
  const speakText = (text: string, id: number) => {
    if (!("speechSynthesis" in window)) {
      toast.error("브라우저가 음성 재생을 지원하지 않습니다.");
      setPlayingAudio(null);
      return;
    }
    window.speechSynthesis.cancel();
    setPlayingAudio(id);
    const utterance = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/, "something").replace(/\s+/g, " "));
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    utterance.onend = () => setPlayingAudio(null);
    utterance.onerror = () => setPlayingAudio(null);
    window.speechSynthesis.speak(utterance);
  };

  const playAudio = (audioUrl: string | undefined, id: number, fallbackText: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingAudio === id) { setPlayingAudio(null); return; }
    setPlayingAudio(id);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingAudio(null); audioRef.current = null; };
      audio.onerror = () => { audioRef.current = null; speakText(fallbackText, id); };
      audio.play().catch(() => speakText(fallbackText, id));
    } else {
      speakText(fallbackText, id);
    }
  };

  const playSpeakAudio = () => {
    const problem = EXAMPLE_SPEAKING_PROBLEMS[speakingIndex];
    if (speakAudioRef.current) { speakAudioRef.current.pause(); speakAudioRef.current = null; }
    if (playingSpeak) { setPlayingSpeak(false); return; }
    setPlayingSpeak(true);
    const fallback = () => {
      const utt = new SpeechSynthesisUtterance(problem.sentence);
      utt.lang = "ko-KR"; utt.rate = 0.9;
      utt.onend = () => setPlayingSpeak(false);
      window.speechSynthesis.speak(utt);
    };
    if (problem.audioUrl) {
      const audio = new Audio(problem.audioUrl);
      speakAudioRef.current = audio;
      audio.onended = () => setPlayingSpeak(false);
      audio.onerror = () => { speakAudioRef.current = null; fallback(); };
      audio.play().catch(fallback);
    } else { fallback(); }
  };

  // ── 빈칸 submit ──
  const handleBlankSubmit = () => {
    const results = EXAMPLE_PROBLEMS.map((p) => {
      const userInput = (userAnswers[p.id] || "").trim().replace(/\s+/g, "");
      const answer = p.answer.replace(/\s+/g, "");
      return {
        problemId: p.id.toString(),
        userAnswer: userAnswers[p.id],
        correctAnswer: p.answer,
        isCorrect: userInput === answer,
        sentence: p.sentence,
        translation: p.translation,
        audioUrl: p.sentence_audio_url,
      };
    });
    localStorage.setItem(
      "anonymous_quiz_result",
      JSON.stringify({
        quizTitle: "한국어 기초 단어 퀴즈 (맛보기)",
        score: results.filter((r) => r.isCorrect).length,
        total: EXAMPLE_PROBLEMS.length,
        answers: results,
      })
    );
    setStage("sentence");
  };

  const allBlankAnswered = EXAMPLE_PROBLEMS.every((p) => (userAnswers[p.id] || "").trim().length > 0);
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  // ── 문장 helpers ──
  const curSentProblem = EXAMPLE_SENTENCE_PROBLEMS[sentenceIndex];
  const curSentAnswer = sentenceAnswers[curSentProblem?.id] || "";
  const isSentChecked = sentenceChecked[curSentProblem?.id];
  const wordUsed = isSentChecked && curSentAnswer.includes(curSentProblem?.stem);
  const isLastSentence = sentenceIndex === EXAMPLE_SENTENCE_PROBLEMS.length - 1;

  // ── 말하기 helpers ──
  const curSpeakProblem = EXAMPLE_SPEAKING_PROBLEMS[speakingIndex];
  const isLastSpeak = speakingIndex === EXAMPLE_SPEAKING_PROBLEMS.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">퀴즈 맛보기</h1>
        </div>
        {/* 스테퍼 */}
        <div className="container mx-auto px-4 pb-3 flex items-center justify-center gap-2">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0",
                    stage === s.id
                      ? "bg-primary text-primary-foreground"
                      : i < stageIndex
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < stageIndex ? "✓" : s.n}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:inline",
                    stage === s.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={cn("w-6 h-px shrink-0", i < stageIndex ? "bg-primary/40" : "bg-border")} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* ════ 빈칸 채우기 ════ */}
        {stage === "blank" && (
          <>
            <div className="mb-4 text-center">
              <span className="inline-block px-4 py-2 bg-muted rounded-md text-lg font-semibold">세트 1</span>
            </div>
            <Card className="shadow-lg">
              <CardContent className="py-6">
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
                <div className="space-y-0 divide-y">
                  {EXAMPLE_PROBLEMS.map((problem, idx) => {
                    const cleaned = problem.sentence.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");
                    const parts = cleaned.split(/\(\s*.*?\s*\)|\(\)/);
                    return (
                      <div key={problem.id} className="py-4">
                        {/* 데스크톱 */}
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
                                        onChange={(e) => setUserAnswers((prev) => ({ ...prev, [problem.id]: e.target.value }))}
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
                                variant="outline" size="sm"
                                onClick={() => playAudio(problem.sentence_audio_url, problem.id, problem.sentence)}
                                className={cn(playingAudio === problem.id && "border-primary text-primary")}
                              >
                                <Volume2 className={cn("w-4 h-4 mr-1", playingAudio === problem.id && "animate-pulse")} />듣기
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setShowTranslations((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                                className={cn(showTranslations[problem.id] && "border-warning text-warning")}
                              >
                                <Lightbulb className="w-4 h-4 mr-1" />힌트
                              </Button>
                            </div>
                          </div>
                          {showTranslations[problem.id] && (
                            <div className="mt-2 ml-9 px-4 py-2 bg-info/10 rounded-lg text-sm border border-info/30 text-muted-foreground">
                              {maskTranslation(problem.translation)}
                            </div>
                          )}
                        </div>
                        {/* 모바일 */}
                        <div className="flex flex-col gap-3 sm:hidden">
                          <div className="flex items-start gap-2">
                            <span className="text-primary font-bold">{idx + 1}.</span>
                            <p className="flex-1 text-lg leading-relaxed">
                              {parts[0]}
                              <span className="text-muted-foreground mx-1">( _____ )</span>
                              {problem.hint && <span className="text-primary text-base font-medium">{problem.hint}</span>}
                              {parts[1]}
                            </p>
                          </div>
                          <div className="pl-6 space-y-2">
                            <Input
                              value={userAnswers[problem.id] || ""}
                              onChange={(e) => setUserAnswers((prev) => ({ ...prev, [problem.id]: e.target.value }))}
                              className="h-10 text-center text-base"
                              placeholder="정답을 입력하세요"
                            />
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1"
                                onClick={() => playAudio(problem.sentence_audio_url, problem.id, problem.sentence)}>
                                <Volume2 className="w-4 h-4 mr-2" />듣기
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1"
                                onClick={() => setShowTranslations((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}>
                                <Lightbulb className="w-4 h-4 mr-2" />힌트
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
            <div className="mt-8 flex justify-end">
              <Button
                size="lg"
                className="w-full sm:w-auto min-w-[200px] h-12 text-lg font-bold shadow-md"
                onClick={handleBlankSubmit}
                disabled={!allBlankAnswered}
              >
                <CheckCircle className="w-5 h-5 mr-2" />채점하기
              </Button>
            </div>
          </>
        )}

        {/* ════ 문장 만들기 ════ */}
        {stage === "sentence" && curSentProblem && (
          <div className="space-y-6">
            <p className="text-center text-sm text-muted-foreground font-mono">
              {sentenceIndex + 1} / {EXAMPLE_SENTENCE_PROBLEMS.length}
            </p>
            <Card className="shadow-lg">
              <CardContent className="py-8 space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">이 단어로 문장을 만들어보세요</p>
                  <div className="inline-block px-8 py-4 bg-accent rounded-2xl">
                    <span className="text-2xl font-bold text-foreground">{curSentProblem.word}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{curSentProblem.translation}</p>
                </div>

                <Textarea
                  value={curSentAnswer}
                  onChange={(e) =>
                    setSentenceAnswers((prev) => ({ ...prev, [curSentProblem.id]: e.target.value }))
                  }
                  placeholder="여기에 한국어 문장을 입력하세요..."
                  className="min-h-[100px] text-base resize-none"
                  disabled={isSentChecked}
                />

                {isSentChecked && (
                  <div className="space-y-3">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                        wordUsed
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-orange-50 text-orange-700 border border-orange-200"
                      )}
                    >
                      {wordUsed ? <CheckCircle className="w-4 h-4 shrink-0" /> : <span>⚠️</span>}
                      {wordUsed ? "단어를 잘 사용했어요!" : "단어를 찾지 못했어요. 괜찮아요!"}
                    </div>
                    <div className="px-4 py-3 bg-muted rounded-xl">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">모범 예문</p>
                      <p className="text-base text-foreground font-medium">{curSentProblem.example}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setSentenceIndex((p) => p - 1)} disabled={sentenceIndex === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" />이전
              </Button>
              {!isSentChecked ? (
                <Button onClick={() => setSentenceChecked((prev) => ({ ...prev, [curSentProblem.id]: true }))} disabled={!curSentAnswer.trim()}>
                  확인
                </Button>
              ) : (
                <Button onClick={() => { if (isLastSentence) { setStage("speaking"); } else { setSentenceIndex((p) => p + 1); } }}>
                  {isLastSentence ? "말하기 연습으로" : "다음 문제"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ════ 말하기 연습 ════ */}
        {stage === "speaking" && curSpeakProblem && (
          <div className="space-y-6">
            <p className="text-center text-sm text-muted-foreground font-mono">
              {speakingIndex + 1} / {EXAMPLE_SPEAKING_PROBLEMS.length}
            </p>
            <Card className="shadow-lg">
              <CardContent className="py-8 space-y-6">
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">이 문장을 듣고 따라 말해보세요</p>
                  <div className="bg-muted rounded-2xl px-6 py-5">
                    <p className="text-xl font-bold text-foreground leading-relaxed">{curSpeakProblem.sentence}</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={playSpeakAudio}
                    className={cn(playingSpeak && "border-primary text-primary")}
                  >
                    <Volume2 className={cn("w-5 h-5 mr-2", playingSpeak && "animate-pulse")} />
                    {playingSpeak ? "재생 중..." : "듣기"}
                  </Button>
                </div>

                {/* AI 채점 잠금 CTA */}
                <div className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 bg-muted/30">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Mic className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 justify-center">
                      <Lock className="w-3.5 h-3.5" />AI 발음 채점
                    </p>
                    <p className="text-xs text-muted-foreground">
                      회원가입하면 AI가 발음을 분석하고 점수를 알려드려요
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link to="/auth?mode=signup">무료로 시작하기</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setSpeakingIndex((p) => p - 1)} disabled={speakingIndex === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" />이전
              </Button>
              {!isLastSpeak ? (
                <Button onClick={() => setSpeakingIndex((p) => p + 1)}>
                  다음 문제<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => navigate("/quiz/example/result")}>
                  <CheckCircle className="w-4 h-4 mr-2" />결과 보기
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
