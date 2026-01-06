import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";

const DIFFICULTY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

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
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"words" | "settings">("words");
  const [wordsText, setWordsText] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<string>("A1");
  const [translationLanguage, setTranslationLanguage] = useState("en");
  const [wordsPerSet, setWordsPerSet] = useState(5);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [apiProvider, setApiProvider] = useState<"openai" | "gemini" | "gemini-pro">("openai");
  const [isGenerating, setIsGenerating] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || role !== "teacher") {
    return <Navigate to="/dashboard" replace />;
  }

  const words = wordsText
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const handleGenerate = async () => {
    if (words.length === 0) {
      toast.error("단어를 입력해주세요");
      return;
    }

    if (!title.trim()) {
      toast.error("퀴즈 제목을 입력해주세요");
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words,
          difficulty,
          translationLanguage,
          wordsPerSet,
          apiProvider,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Store quiz data in sessionStorage for the preview page
      // Keep problems in original order (same as words added) for preview
      // Shuffling will happen when saving the quiz for students
      sessionStorage.setItem(
        "quizDraft",
        JSON.stringify({
          title,
          words,
          difficulty,
          translationLanguage,
          wordsPerSet,
          timerEnabled,
          timerSeconds: timerEnabled ? timerSeconds : null,
          apiProvider,
          problems: data.problems,
        }),
      );

      navigate("/quiz/preview");
    } catch (error: any) {
      console.error("Quiz generation error:", error);
      // Show the specific error message if available
      const errorMessage = error.message || (error.error && error.error.message) || "퀴즈 생성에 실패했습니다";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">새 퀴즈 만들기</h1>
          <p className="text-muted-foreground mt-1">AI가 문맥에 맞는 문제를 생성합니다</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === "words" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm">1</span>
            <span className="text-sm font-medium">단어 입력</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === "settings" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm">2</span>
            <span className="text-sm font-medium">설정</span>
          </div>
        </div>

        {step === "words" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                단어 입력
              </CardTitle>
              <CardDescription>학습할 한국어 단어를 쉼표(,) 또는 줄바꿈으로 구분해서 입력하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="words">단어 목록</Label>
                <Textarea
                  id="words"
                  placeholder="학생, 선생님, 먹다, 마시다, 마음에 들다, 예쁘다"
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  className="min-h-[200px] font-medium"
                />
                <p className="text-sm text-muted-foreground">입력된 단어: {words.length}개</p>
              </div>

              <Button onClick={() => setStep("settings")} className="w-full" disabled={words.length === 0}>
                다음: 설정 <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle>퀴즈 설정</CardTitle>
              <CardDescription>난이도와 옵션을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">퀴즈 제목</Label>
                <Input
                  id="title"
                  placeholder="예: 1과 어휘 퀴즈"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>난이도 (TOPIK 기준)</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {DIFFICULTY_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        difficulty === level ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <LevelBadge level={level} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>번역 언어</Label>
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wordsPerSet">세트당 단어 수</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={wordsPerSet}
                      onChange={(e) => setWordsPerSet(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">개</span>
                  </div>
                </div>
                <Slider value={[wordsPerSet]} onValueChange={(v) => setWordsPerSet(v[0])} min={1} max={10} step={1} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="timer" className="cursor-pointer">
                    타이머 사용
                  </Label>
                  <p className="text-sm text-muted-foreground">제한 시간을 설정합니다</p>
                </div>
                <Switch id="timer" checked={timerEnabled} onCheckedChange={setTimerEnabled} />
              </div>

              {timerEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="timerSeconds">세트당 제한 시간</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        value={timerSeconds}
                        onChange={(e) => setTimerSeconds(Math.max(10, Math.min(300, Number(e.target.value) || 10)))}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">초</span>
                    </div>
                  </div>
                  <Slider
                    value={[timerSeconds]}
                    onValueChange={(v) => setTimerSeconds(v[0])}
                    min={10}
                    max={300}
                    step={10}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.floor(timerSeconds / 60)}분 {timerSeconds % 60}초
                  </p>
                </div>
              )}

              <div className="space-y-3 mt-6 pt-6 border-t border-border">
                <Label className="text-base font-semibold">AI 모델 선택</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setApiProvider("openai")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      apiProvider === "openai"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-border-foreground/20 hover:bg-muted/30"
                    }`}
                  >
                    <div className="font-bold text-foreground">OpenAI</div>
                    <div className="text-xs text-muted-foreground mt-1">GPT-5.2</div>
                    <div className="text-xs text-muted-foreground mt-0.5">강력함</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApiProvider("gemini")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      apiProvider === "gemini"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-border-foreground/20 hover:bg-muted/30"
                    }`}
                  >
                    <div className="font-bold text-foreground">Gemini</div>
                    <div className="text-xs text-muted-foreground mt-1">3 Flash</div>
                    <div className="text-xs text-muted-foreground mt-0.5">빠름·저렴</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApiProvider("gemini-pro")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      apiProvider === "gemini-pro"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-border-foreground/20 hover:bg-muted/30"
                    }`}
                  >
                    <div className="font-bold text-foreground">Gemini</div>
                    <div className="text-xs text-muted-foreground mt-1">3 Pro</div>
                    <div className="text-xs text-muted-foreground mt-0.5">고성능</div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("words")} className="flex-1">
                  이전
                </Button>
                <Button onClick={handleGenerate} className="flex-1" disabled={isGenerating || !title.trim()}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    "문제 생성하기"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
