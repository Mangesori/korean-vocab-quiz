import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, BookOpen, PenLine, PenSquare, Mic, Type, Sparkles, Link2, Keyboard, Magnet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import type { Problem, SentenceMakingProblem, RecordingProblem, MatchupProblem, TypeAnswerProblem } from "@/types/quiz";

const DIFFICULTY_LEVELS = [
  { level: "A1", bg: "bg-[#DCFCE7]", text: "text-[#15803D]", border: "border-[#15803D]" },
  { level: "A2", bg: "bg-[#CFFAFE]", text: "text-[#0E7490]", border: "border-[#0E7490]" },
  { level: "B1", bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", border: "border-[#1D4ED8]" },
  { level: "B2", bg: "bg-[#EDE9FE]", text: "text-[#6D28D9]", border: "border-[#6D28D9]" },
  { level: "C1", bg: "bg-[#FCE7F3]", text: "text-[#9D174D]", border: "border-[#9D174D]" },
  { level: "C2", bg: "bg-[#FEF9C3]", text: "text-[#854D0E]", border: "border-[#854D0E]" },
] as const;

const TRANSLATION_LANGUAGES = [
  { value: "en", label: "영어 (English)" },
  { value: "zh_CN", label: "중국어 간체 (简体中文)" },
  { value: "zh_TW", label: "중국어 번체 (繁體中文)" },
  { value: "ja", label: "일본어 (日本語)" },
  { value: "vi", label: "베트남어 (Tiếng Việt)" },
  { value: "th", label: "태국어 (ภาษาไทย)" },
  { value: "id", label: "인도네시아어 (Bahasa Indonesia)" },
  { value: "es", label: "스페인어 (Español)" },
  { value: "fr", label: "프랑스어 (Français)" },
  { value: "de", label: "독일어 (Deutsch)" },
  { value: "ru", label: "러시아어 (Русский)" },
];

export default function QuizCreate() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [wordsText, setWordsText] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<string>("A1");
  const [translationLanguage, setTranslationLanguage] = useState("en");
  const [wordsPerSet, setWordsPerSet] = useState(5);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fillBlankEnabled, setFillBlankEnabled] = useState(true);
  const [sentenceMakingEnabled, setSentenceMakingEnabled] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [matchupEnabled, setMatchupEnabled] = useState(false);
  const [typeAnswerEnabled, setTypeAnswerEnabled] = useState(false);
  const [wordMagnetEnabled, setWordMagnetEnabled] = useState(false);

  const words = wordsText
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  // Cmd/Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!isGenerating && words.length > 0 && title.trim()) {
          handleGenerate();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isGenerating, words.length, title]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.CREATE_QUIZ)) {
    return <Navigate to="/dashboard" replace />;
  }

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  const handleGenerate = async () => {
    if (words.length === 0) {
      toast.error("단어를 입력해주세요");
      return;
    }
    if (!title.trim()) {
      toast.error("퀴즈 제목을 입력해주세요");
      return;
    }
    if (!fillBlankEnabled && !matchupEnabled && !typeAnswerEnabled && !wordMagnetEnabled && !sentenceMakingEnabled && !recordingEnabled) {
      toast.error("최소 한 가지 퀴즈 유형을 선택해주세요");
      return;
    }

    setIsGenerating(true);

    try {
      const BATCH_SIZE = 15;
      const allProblems: Problem[] = [];
      const allSentenceMakingProblems: SentenceMakingProblem[] = [];
      const allRecordingProblems: RecordingProblem[] = [];
      const allMatchupProblems: MatchupProblem[] = [];
      const allTypeAnswerProblems: TypeAnswerProblem[] = [];

      const wordChunks: string[][] = [];
      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        wordChunks.push(words.slice(i, i + BATCH_SIZE));
      }

      for (let i = 0; i < wordChunks.length; i++) {
        const chunk = wordChunks[i];
        const currentProgress = i * BATCH_SIZE + chunk.length;

        toast.loading(`문제 생성 중... (${currentProgress}/${words.length})`, { id: "quiz-generation" });

        try {
          const { data, error } = await supabase.functions.invoke("generate-quiz", {
            body: {
              words: chunk,
              difficulty,
              translationLanguage,
              wordsPerSet,
              sentenceMakingEnabled,
              recordingEnabled,
              matchupEnabled,
              typeAnswerEnabled,
              recordingMode: "read",
            },
          });

          if (error) throw error;
          if (data.error) throw new Error(data.error);

          allProblems.push(...data.problems);
          if (data.sentenceMakingProblems) allSentenceMakingProblems.push(...data.sentenceMakingProblems);
          if (data.recordingProblems) allRecordingProblems.push(...data.recordingProblems);
          if (data.matchupProblems) allMatchupProblems.push(...data.matchupProblems);
          if (data.typeAnswerProblems) allTypeAnswerProblems.push(...data.typeAnswerProblems);
        } catch (batchError: any) {
          console.error(`Batch ${i + 1} generation error:`, batchError);
          if (allProblems.length > 0) {
            toast.dismiss("quiz-generation");
            toast.warning(`일부 문제만 생성되었습니다 (${allProblems.length}/${words.length}개).`, { duration: 5000 });
            break;
          } else {
            throw batchError;
          }
        }
      }

      toast.dismiss("quiz-generation");
      toast.success(`${allProblems.length}개 문제 생성 완료!`);

      sessionStorage.setItem(
        "quizDraft",
        JSON.stringify({
          title,
          words: words.slice(0, allProblems.length),
          difficulty,
          translationLanguage,
          wordsPerSet,
          timerEnabled,
          timerSeconds: timerEnabled ? timerSeconds : null,
          problems: allProblems,
          fillBlankEnabled,
          sentenceMakingEnabled,
          recordingEnabled,
          matchupEnabled,
          typeAnswerEnabled,
          wordMagnetEnabled,
          sentenceMakingProblems: allSentenceMakingProblems,
          recordingProblems: allRecordingProblems,
          matchupProblems: allMatchupProblems,
          typeAnswerProblems: allTypeAnswerProblems,
          wordMagnetProblems: [],
        }),
      );

      navigate("/quiz/preview");
    } catch (error: any) {
      console.error("Quiz generation error:", error);
      toast.dismiss("quiz-generation");
      const errorMessage = error.message || (error.error && error.error.message) || "퀴즈 생성에 실패했습니다";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <PenSquare className="h-8 w-8 text-primary" />
            퀴즈 만들기
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">AI가 문맥에 맞는 문제를 생성합니다</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 md:p-8 space-y-8">
          {/* ── 섹션 1: 단어 입력 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="font-semibold text-foreground">단어 입력</h2>
            </div>
            <Textarea
              placeholder="학생, 선생님, 먹다, 마시다, 마음에 들다, 예쁘다"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              className="min-h-[160px] font-medium resize-none"
            />
            <div className="flex items-center justify-between mt-2 px-0.5">
              <span className="text-sm text-muted-foreground">입력된 단어: <span className="font-semibold text-foreground">{words.length}</span>개</span>
              <span className="text-xs font-mono text-muted-foreground">쉼표(,) 또는 줄바꿈으로 구분</span>
            </div>
          </section>

          {/* ── 섹션 2: CEFR 레벨 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="font-semibold text-foreground">난이도</h2>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {DIFFICULTY_LEVELS.map(({ level, bg, text, border }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`py-2.5 rounded-full border-2 font-bold text-sm transition-all ${bg} ${text} ${border} ${difficulty === level
                      ? "opacity-100 ring-2 ring-offset-2 ring-current shadow-sm"
                      : "opacity-50 border-transparent"
                    }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </section>

          {/* ── 섹션 3: 퀴즈 유형 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h2 className="font-semibold text-foreground">퀴즈 유형</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMatchupEnabled(!matchupEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${matchupEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Link2 className={`w-4 h-4 ${matchupEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">짝 맞추기</span>
                </div>
                <div className={`text-xs ${matchupEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {matchupEnabled ? "선택됨" : "단어 ↔ 뜻"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTypeAnswerEnabled(!typeAnswerEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${typeAnswerEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Keyboard className={`w-4 h-4 ${typeAnswerEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">뜻 보고 단어 쓰기</span>
                </div>
                <div className={`text-xs ${typeAnswerEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {typeAnswerEnabled ? "선택됨" : "뜻 → 한국어"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFillBlankEnabled(!fillBlankEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${fillBlankEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Type className={`w-4 h-4 ${fillBlankEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">빈칸 채우기</span>
                </div>
                <div className={`text-xs ${fillBlankEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {fillBlankEnabled ? "선택됨" : "문장 빈칸"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWordMagnetEnabled(!wordMagnetEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${wordMagnetEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Magnet className={`w-4 h-4 ${wordMagnetEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">문장 순서 맞추기</span>
                </div>
                <div className={`text-xs ${wordMagnetEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {wordMagnetEnabled ? "선택됨" : "문장 조립"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSentenceMakingEnabled(!sentenceMakingEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${sentenceMakingEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <PenLine className={`w-4 h-4 ${sentenceMakingEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">문장 만들기</span>
                </div>
                <div className={`text-xs ${sentenceMakingEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {sentenceMakingEnabled ? "선택됨" : "AI 채점"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRecordingEnabled(!recordingEnabled)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${recordingEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mic className={`w-4 h-4 ${recordingEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">말하기 연습</span>
                </div>
                <div className={`text-xs ${recordingEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {recordingEnabled ? "선택됨" : "발음 평가"}
                </div>
              </button>
            </div>
          </section>

          {/* ── 섹션 4: 추가 설정 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <h2 className="font-semibold text-foreground">추가 설정</h2>
            </div>

            <div className="space-y-5">
              {/* 퀴즈 제목 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">퀴즈 제목</label>
                <Input
                  placeholder="예: 1과 어휘 퀴즈"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* 세트당 단어 수 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">세트당 단어 수</label>
                  <span className="text-sm font-semibold text-foreground">{wordsPerSet}개</span>
                </div>
                <Slider value={[wordsPerSet]} onValueChange={(v) => setWordsPerSet(v[0])} min={1} max={10} step={1} />
              </div>

              {/* 번역 언어 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">번역 언어</label>
                <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSLATION_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 타이머 */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">세트당 제한 시간</div>
                    <div className="text-xs text-muted-foreground mt-0.5">세트마다 타이머가 초기화됩니다</div>
                  </div>
                  <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                </div>
                {timerEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">제한 시간</span>
                      <span className="text-sm font-semibold text-foreground">
                        {Math.floor(timerSeconds / 60) > 0 && `${Math.floor(timerSeconds / 60)}분 `}
                        {timerSeconds % 60}초
                      </span>
                    </div>
                    <Slider value={[timerSeconds]} onValueChange={(v) => setTimerSeconds(v[0])} min={10} max={300} step={10} />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <div className="pt-2 pb-8">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || words.length === 0 || !title.trim()}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI로 퀴즈 생성
                  <kbd className="ml-1 font-mono text-xs opacity-70 bg-primary-foreground/20 rounded px-1.5 py-0.5">
                    {isMac ? "⌘↵" : "Ctrl+↵"}
                  </kbd>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
