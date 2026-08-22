import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen, PenLine, PenSquare, Mic, Type, Sparkles, Link2, Keyboard, Magnet, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { isShortSentenceLevel } from "@/lib/quiz";
import { readEdgeFunctionError, isQuotaExceeded } from "@/lib/supabaseErrors";
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

/** 입력 방식. words = 단어 목록을 파싱해 15개씩 배치 생성, prompt = 쓴 글을 통째로 전달. */
type InputMode = "words" | "prompt";

/** 프롬프트 한 번에 보낼 수 있는 최대 글자 수. 넘으면 입력 자체를 막는다. */
const PROMPT_MAX_LENGTH = 8000;

/** 프롬프트 모드의 문제 수 선택지. 배치 분할이 없어 40문제가 현실적인 상한이다. */
const PROBLEM_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40];

const WORDS_PLACEHOLDER = `예시)
학생, 선생님, 먹다, 마시다, 마음에 들다, 예쁘다

또는 한 줄에 하나씩
학생
선생님`;

const PROMPT_PLACEHOLDER = `예시)
어제 서울 지하철 2호선에서 작은 화재가 났다. 승객들은 안내 방송에 따라 침착하게 대피했고, 다친 사람은 없었다. 소방서는 전선 문제로 불이 난 것으로 보고 있다.

단어: 화재, 승객, 대피하다, 침착하다, 전선

이번 수업에서 '-느라고'를 배웠으니 3문제는 그 문법으로 만들어 주세요.`;

export default function QuizCreate() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const [inputMode, setInputMode] = useState<InputMode>("words");
  // 대시보드 히어로(신규 가입 상태)에서 붙여넣은 단어를 이어받는다.
  const [wordsText, setWordsText] = useState(() => (location.state as { initialWords?: string } | null)?.initialWords ?? "");
  const [promptText, setPromptText] = useState("");
  /** null = 자동(엣지 함수가 프롬프트 속 단어 개수에 맞춰 정함) */
  const [problemCount, setProblemCount] = useState<number | null>(null);
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

  // handleGenerate가 useCallback이라 words의 참조가 매 렌더 바뀌면 안 된다.
  const words = useMemo(
    () =>
      wordsText
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0),
    [wordsText],
  );

  // 모드마다 "입력이 채워졌는가"의 기준이 다르다. 단어 모드는 파싱된 단어 개수,
  // 프롬프트 모드는 선생님이 쓴 글의 유무.
  const hasInput = inputMode === "words" ? words.length > 0 : promptText.trim().length > 0;
  const canGenerate = !isGenerating && hasInput && title.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (inputMode === "words" && words.length === 0) {
      toast.error("단어를 입력해주세요");
      return;
    }
    if (inputMode === "prompt" && !promptText.trim()) {
      toast.error("프롬프트를 입력해주세요");
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
      const allProblems: Problem[] = [];
      const allSentenceMakingProblems: SentenceMakingProblem[] = [];
      const allRecordingProblems: RecordingProblem[] = [];
      const allMatchupProblems: MatchupProblem[] = [];
      const allTypeAnswerProblems: TypeAnswerProblem[] = [];

      if (inputMode === "prompt") {
        // 코드가 단어 개수를 모르기 때문에 배치 분할을 할 수 없다. 한 번에 호출한다.
        toast.loading("문제 생성 중...", { id: "quiz-generation" });

        const { data, error } = await supabase.functions.invoke("generate-quiz", {
          body: {
            mode: "prompt",
            promptText,
            problemCount,
            difficulty,
            translationLanguage,
            wordsPerSet,
            sentenceMakingEnabled,
            recordingEnabled,
            matchupEnabled,
            typeAnswerEnabled,
            wordMagnetEnabled,
            recordingMode: "read",
            purpose: "create",
          },
        });

        // 엣지 함수가 non-2xx를 주면 error.message는 영문 일반 문구라 본문의 한국어를 꺼내 써야 한다.
        if (error) {
          const parsed = await readEdgeFunctionError(error, "퀴즈 생성에 실패했어요");
          // 배치가 없으니 "일부만 생성"이라는 상태 자체가 없다. 한도 초과(429)는 서버가 준
          // 한국어 안내에 조치 방법이 들어 있어 읽을 시간을 두고 보여준다.
          if (isQuotaExceeded(parsed)) {
            toast.dismiss("quiz-generation");
            toast.error(parsed.message, { duration: 6000 });
            return;
          }
          throw new Error(parsed.message);
        }
        if (data.error) throw new Error(data.error);

        allProblems.push(...data.problems);
        if (data.sentenceMakingProblems) allSentenceMakingProblems.push(...data.sentenceMakingProblems);
        if (data.recordingProblems) allRecordingProblems.push(...data.recordingProblems);
        if (data.matchupProblems) allMatchupProblems.push(...data.matchupProblems);
        if (data.typeAnswerProblems) allTypeAnswerProblems.push(...data.typeAnswerProblems);

        toast.dismiss("quiz-generation");
        toast.success(`${allProblems.length}개 문제가 만들어졌어요`);
        // 프롬프트 모드는 몇 개가 나올지 미리 알 수 없다. 지정한 수와 어긋나면 알려준다.
        if (problemCount !== null && allProblems.length !== problemCount) {
          toast.info(`요청하신 ${problemCount}개와 달라요. 미리보기에서 확인해 주세요.`, { duration: 6000 });
        }
      } else {
        const BATCH_SIZE = 15;

        const wordChunks: string[][] = [];
        for (let i = 0; i < words.length; i += BATCH_SIZE) {
          wordChunks.push(words.slice(i, i + BATCH_SIZE));
        }

        // 한도 초과로 배치가 실패한 경우를 표시한다. 아래 catch에서 "일부만 생성" 경고로
        // 삼키지 않고 그대로 위로 던지기 위한 플래그.
        let quotaExceeded = false;

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
                wordMagnetEnabled,
                recordingMode: "read",
                purpose: "create",
              },
            });

            // 엣지 함수가 non-2xx를 주면 error.message는 영문 일반 문구라 본문의 한국어를 꺼내 써야 한다.
            if (error) {
              const parsed = await readEdgeFunctionError(error, "퀴즈 생성에 실패했어요");
              if (isQuotaExceeded(parsed)) quotaExceeded = true;
              throw new Error(parsed.message);
            }
            if (data.error) throw new Error(data.error);

            allProblems.push(...data.problems);
            if (data.sentenceMakingProblems) allSentenceMakingProblems.push(...data.sentenceMakingProblems);
            if (data.recordingProblems) allRecordingProblems.push(...data.recordingProblems);
            if (data.matchupProblems) allMatchupProblems.push(...data.matchupProblems);
            if (data.typeAnswerProblems) allTypeAnswerProblems.push(...data.typeAnswerProblems);
          } catch (batchError: any) {
            console.error(`Batch ${i + 1} generation error:`, batchError);
            // 한도 초과는 "일부 문제만 생성되었습니다" 경고로 삼키면 안 된다. 앞 배치가 성공한 뒤
            // 한도에 걸리면 선생님은 왜 멈췄는지 모른 채 저장 단계에서 트리거에 또 막힌다.
            if (quotaExceeded || allProblems.length === 0) {
              throw batchError;
            }
            toast.dismiss("quiz-generation");
            toast.warning(`일부 문제만 생성되었습니다 (${allProblems.length}/${words.length}개).`, { duration: 5000 });
            break;
          }
        }

        toast.dismiss("quiz-generation");
        toast.success(`${allProblems.length}개 문제 생성 완료!`);
      }

      // 말하기 연습 문제는 fillBlankEnabled 여부와 무관하게 빈칸 채우기 원본 문장에서
      // 즉시 파생 (엣지 함수는 항상 빈 배열을 반환하므로 여기서 직접 생성)
      // B1+ 난이도면 빈칸 채우기 파생 대신 short_sentence(있으면)를 그대로 사용.
      // short_sentence는 이미 완성형이라 괄호 치환이 필요 없다. 없으면 기존 치환으로 폴백.
      const recordingProblemsFinal: RecordingProblem[] = recordingEnabled
        ? allProblems.map((p) => {
            const useShort = isShortSentenceLevel(difficulty) && !!p.short_sentence?.trim();
            return {
              problem_id: p.id,
              sentence: useShort
                ? p.short_sentence!.trim()
                : p.sentence.replace(/\(\s*\)|\(\)/g, p.answer),
              mode: "read" as const,
              translation: (useShort
                ? (p.short_translation ?? p.translation ?? "")
                : (p.translation || "")
              ).replace(/[[\]]/g, ""),
            };
          })
        : allRecordingProblems;

      // 프롬프트 모드는 입력 단어 배열이 없다. 생성된 문제에서 단어를 되뽑아 draft를 채운다.
      const draftWords =
        inputMode === "prompt"
          ? allProblems.map((p) => p.word).filter(Boolean)
          : words.slice(0, allProblems.length);

      // 새 초안을 만들 때는 이전 미리보기 단계 기억을 버린다.
      sessionStorage.removeItem("quizPreviewStage");
      sessionStorage.setItem(
        "quizDraft",
        JSON.stringify({
          title,
          words: draftWords,
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
          recordingProblems: recordingProblemsFinal,
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
  }, [
    inputMode,
    words,
    promptText,
    problemCount,
    title,
    difficulty,
    translationLanguage,
    wordsPerSet,
    timerEnabled,
    timerSeconds,
    fillBlankEnabled,
    sentenceMakingEnabled,
    recordingEnabled,
    matchupEnabled,
    typeAnswerEnabled,
    wordMagnetEnabled,
    navigate,
  ]);

  // Cmd/Ctrl+Enter 단축키.
  // handleGenerate 자체를 의존성에 넣어야 한다. 예전엔 [isGenerating, words.length, title]만
  // 봐서, 단어 개수가 같은 채 내용·난이도·유형만 바꾸면 이전 렌더의 값으로 제출됐다.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canGenerate) {
        handleGenerate();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [canGenerate, handleGenerate]);

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

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <PenSquare className="h-8 w-8 text-primary" />
            퀴즈 만들기
          </h1>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 md:p-8 space-y-8">
          {/* ── 섹션 1: 퀴즈 제목 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="font-semibold text-foreground">퀴즈 제목</h2>
            </div>
            <Input
              placeholder="예: 1과 어휘 퀴즈"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </section>

          {/* ── 섹션 2: 단어 입력 / 프롬프트 입력 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="font-semibold text-foreground">입력 방식</h2>
            </div>

            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="mb-3">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="words">단어 입력</TabsTrigger>
                <TabsTrigger value="prompt">프롬프트 입력</TabsTrigger>
              </TabsList>
            </Tabs>

            {inputMode === "words" ? (
              <>
                <Textarea
                  placeholder={WORDS_PLACEHOLDER}
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  className="min-h-[200px] font-medium resize-none"
                />
                <div className="flex items-center justify-between mt-2 px-0.5">
                  <span className="text-sm text-muted-foreground">입력된 단어: <span className="font-semibold text-foreground">{words.length}</span>개</span>
                  <span className="text-xs font-mono text-muted-foreground">쉼표(,) 또는 줄바꿈으로 구분</span>
                </div>
              </>
            ) : (
              <>
                <Textarea
                  placeholder={PROMPT_PLACEHOLDER}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  maxLength={PROMPT_MAX_LENGTH}
                  className="min-h-[280px] resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2 px-0.5">
                  <span className="text-sm text-muted-foreground">읽기 지문, 기사, 단어 목록, 요청사항 등을 붙여넣으세요</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {promptText.length.toLocaleString()} / {PROMPT_MAX_LENGTH.toLocaleString()}자
                  </span>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="text-sm font-medium text-foreground">문제 수</label>
                  <Select
                    value={problemCount === null ? "auto" : String(problemCount)}
                    onValueChange={(v) => setProblemCount(v === "auto" ? null : Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">자동</SelectItem>
                      {PROBLEM_COUNT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}개
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">자동으로 두면 적어주신 단어 개수에 맞춰 만들어요</p>
                </div>
              </>
            )}
          </section>

          {/* ── 섹션 3: CEFR 레벨 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
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

          {/* ── 섹션 4: 퀴즈 유형 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <h2 className="font-semibold text-foreground">퀴즈 유형</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMatchupEnabled(!matchupEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${matchupEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {matchupEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <Link2 className={`w-4 h-4 ${matchupEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">짝 맞추기</span>
                </div>
                <div className={`text-xs ${matchupEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  단어 매칭
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTypeAnswerEnabled(!typeAnswerEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${typeAnswerEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {typeAnswerEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <Keyboard className={`w-4 h-4 ${typeAnswerEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">단어 받아쓰기</span>
                </div>
                <div className={`text-xs ${typeAnswerEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  뜻 보고 단어 쓰기
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFillBlankEnabled(!fillBlankEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${fillBlankEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {fillBlankEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <Type className={`w-4 h-4 ${fillBlankEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">빈칸 채우기</span>
                </div>
                <div className={`text-xs ${fillBlankEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  문장 완성하기
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWordMagnetEnabled(!wordMagnetEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${wordMagnetEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {wordMagnetEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <Magnet className={`w-4 h-4 ${wordMagnetEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">문장 순서 맞추기</span>
                </div>
                <div className={`text-xs ${wordMagnetEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  순서대로 단어 배치
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSentenceMakingEnabled(!sentenceMakingEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${sentenceMakingEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {sentenceMakingEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <PenLine className={`w-4 h-4 ${sentenceMakingEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">문장 만들기</span>
                </div>
                <div className={`text-xs ${sentenceMakingEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  단어 보고 문장 쓰기
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRecordingEnabled(!recordingEnabled)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${recordingEnabled
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                {recordingEnabled && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                <div className="flex items-center gap-2 mb-1">
                  <Mic className={`w-4 h-4 ${recordingEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold text-sm text-foreground">말하기 연습</span>
                </div>
                <div className={`text-xs ${recordingEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  읽거나 듣고 따라 말하기
                </div>
              </button>
            </div>
          </section>

          {/* ── 섹션 5: 추가 설정 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">5</span>
              <h2 className="font-semibold text-foreground">추가 설정</h2>
            </div>

            <div className="space-y-5">
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
              disabled={!canGenerate}
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
