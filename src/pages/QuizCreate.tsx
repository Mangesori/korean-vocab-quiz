import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PenLine, PenSquare, Mic, Type, Sparkles, Link2, Keyboard, Magnet, Check, History, BookOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { isShortSentenceLevel } from "@/lib/quiz";
import { readEdgeFunctionError, isQuotaExceeded } from "@/lib/supabaseErrors";
import type { Problem, SentenceMakingProblem, RecordingProblem, MatchupProblem, TypeAnswerProblem } from "@/types/quiz";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const QUIZ_TYPE_CARDS = [
  { key: "matchup", label: "짝 맞추기", desc: "단어 매칭", icon: Link2 },
  { key: "type_answer", label: "단어 받아쓰기", desc: "뜻 보고 단어 쓰기", icon: Keyboard },
  { key: "fill_blank", label: "빈칸 채우기", desc: "문장 완성하기", icon: Type },
  { key: "word_magnet", label: "문장 순서 맞추기", desc: "순서대로 단어 배치", icon: Magnet },
  { key: "sentence_making", label: "문장 만들기", desc: "단어 보고 문장 쓰기", icon: PenLine },
  { key: "recording", label: "말하기 연습", desc: "읽거나 듣고 따라 말하기", icon: Mic },
] as const;

// get_class_wrong_answers RPC가 jsonb 배열로 돌려주는 원본 행 — 여기선 학생별 개수만 센다.
interface RpcWrongAnswerRow {
  student_id: string | null;
  word: string | null;
  correct_answer: string;
}

// get_class_wrong_answers는 아직 types.ts에 등록돼 있지 않다 (WrongAnswerQuizCreate.tsx와 동일 우회).
type UntypedRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 연결 줄의 "오답 복습" 칩에 붙일 학생별 오답 개수 — 오답 복습 화면과 같은 소스
  // (get_class_wrong_answers)로 세되, 여기선 발견성용 요약이라 상위 2명만 보여준다.
  const { data: wrongAnswerCounts } = useQuery({
    queryKey: ["wrongAnswerCountsByStudent", user?.id],
    queryFn: async () => {
      const { data: classesData } = await supabase.from("classes").select("id").eq("teacher_id", user!.id);
      const classIds = (classesData ?? []).map((c) => c.id);
      if (classIds.length === 0) return [] as { name: string; count: number }[];

      const { data: membersData } = await supabase.from("class_members").select("student_id").in("class_id", classIds);
      const studentIds = [...new Set((membersData ?? []).map((m) => m.student_id))];
      if (studentIds.length === 0) return [] as { name: string; count: number }[];

      const { data: waData } = await (supabase as unknown as UntypedRpcClient).rpc("get_class_wrong_answers", {
        _student_ids: studentIds,
      });
      const rows = (waData ?? []) as RpcWrongAnswerRow[];

      const wordsByStudent = new Map<string, Set<string>>();
      rows.forEach((r) => {
        const word = (r.word && r.word.trim()) || r.correct_answer;
        if (!r.student_id || !word) return;
        const set = wordsByStudent.get(r.student_id) ?? new Set<string>();
        set.add(word);
        wordsByStudent.set(r.student_id, set);
      });
      if (wordsByStudent.size === 0) return [] as { name: string; count: number }[];

      const { data: profilesData } = await supabase.from("profiles").select("user_id, name").in("user_id", [...wordsByStudent.keys()]);
      const nameById = new Map((profilesData ?? []).map((p) => [p.user_id, p.name]));

      return [...wordsByStudent.entries()]
        .map(([studentId, words]) => ({ name: nameById.get(studentId) ?? "이름 없음", count: words.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);
    },
    enabled: !!user,
  });

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
      <div className="bg-[#FAF8F5] px-[18px] sm:px-[30px] py-[26px] sm:py-[30px]">
        <div className="max-w-[756px] mx-auto">
          <div className="flex items-center gap-2.5">
            <PenSquare className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
            <div className="text-[21px] font-bold tracking-[-0.4px]">퀴즈 만들기</div>
          </div>

          <div className="mt-[18px] bg-white border border-[#EBE5DE] rounded-[18px] px-7 py-[26px]">
            {/* ── 다른 방식으로 만들기 ── */}
            <div className="flex items-center gap-2 flex-wrap pb-5 border-b border-[#F2EDE7]">
              <span className="text-xs text-[#8A837D] mr-0.5">다른 방식으로 만들기</span>
              <Link
                to="/quiz/wrong-answer"
                className="inline-flex items-center gap-1.5 border border-[#E3DCD3] rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold text-[#4A443F]"
              >
                <History className="w-3.5 h-3.5 text-[#B4552D]" />
                오답 복습
                {wrongAnswerCounts && wrongAnswerCounts.length > 0 && (
                  <span className="text-[#8A837D] font-medium">
                    {wrongAnswerCounts.map((s) => `${s.name} ${s.count}`).join(' · ')}
                  </span>
                )}
              </Link>
              <Link
                to="/quiz/vocab-practice"
                className="inline-flex items-center gap-1.5 border border-[#E3DCD3] rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold text-[#4A443F]"
              >
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                어휘 보강
              </Link>
            </div>

          {/* ── 1단계: 퀴즈 제목과 단어 ── */}
          <section className="mt-[22px]">
            <div className="flex items-center gap-2.5">
              <span className="w-[26px] h-[26px] rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="text-[15.5px] font-bold tracking-[-0.2px]">퀴즈 제목과 단어</h2>
            </div>

            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="mt-[13px]">
              <TabsList className="w-full grid grid-cols-2 bg-[#F5F1EB] rounded-[11px] p-1 h-auto">
                <TabsTrigger
                  value="words"
                  className="rounded-[8px] text-[12.5px] font-bold py-[9px] data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  단어 입력
                </TabsTrigger>
                <TabsTrigger
                  value="prompt"
                  className="rounded-[8px] text-[12.5px] font-bold py-[9px] data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  프롬프트 입력
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Input
              placeholder="퀴즈 제목 *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2.5 bg-[#FAF8F5] border-[#EBE5DE] rounded-[11px] text-[13px] h-auto py-[13px] px-[15px]"
            />

            {inputMode === "words" ? (
              <>
                <Textarea
                  placeholder={WORDS_PLACEHOLDER}
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  className="mt-2.5 min-h-[200px] font-medium resize-none bg-[#FAF8F5] border-[#EBE5DE] rounded-[11px]"
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
                  className="mt-2.5 min-h-[200px] resize-none leading-relaxed bg-[#FAF8F5] border-[#EBE5DE] rounded-[11px]"
                />
                <div className="flex items-center justify-between mt-2 px-0.5">
                  <span className="text-sm text-muted-foreground">지문·단어·문법 요청을 함께 쓸 수 있습니다</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {promptText.length.toLocaleString()} / {PROMPT_MAX_LENGTH.toLocaleString()}자
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <span className="text-[12.5px] font-semibold text-[#4A443F]">문제 수</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setProblemCount(null)}
                      className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${problemCount === null ? 'border-primary bg-[#E8F1EB] text-primary' : 'border-transparent bg-[#F5F1EB] text-[#6B6460] font-semibold'}`}
                    >
                      자동
                    </button>
                    {PROBLEM_COUNT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setProblemCount(n)}
                        className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${problemCount === n ? 'border-primary bg-[#E8F1EB] text-primary' : 'border-transparent bg-[#F5F1EB] text-[#6B6460] font-semibold'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">자동으로 두면 프롬프트 속 단어 수에 맞춰 만들어요</p>
              </>
            )}
          </section>

          {/* ── 2단계: 난이도와 유형 ── */}
          <section className="mt-6 pt-5 border-t border-[#F2EDE7]">
            <div className="flex items-center gap-2.5">
              <span className="w-[26px] h-[26px] rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="text-[15.5px] font-bold tracking-[-0.2px]">난이도와 유형</h2>
            </div>

            <div className="flex gap-[7px] mt-3.5">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`flex-1 text-center text-[12.5px] rounded-[10px] py-[9px] ${
                    difficulty === level
                      ? 'font-bold text-primary bg-[#E8F1EB] border-[1.5px] border-primary'
                      : 'font-semibold text-[#6B6460] bg-[#F5F1EB] border border-transparent'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              {QUIZ_TYPE_CARDS.map(({ key, label, desc, icon: Icon }) => {
                const enabled = {
                  matchup: matchupEnabled,
                  type_answer: typeAnswerEnabled,
                  fill_blank: fillBlankEnabled,
                  word_magnet: wordMagnetEnabled,
                  sentence_making: sentenceMakingEnabled,
                  recording: recordingEnabled,
                }[key];
                const setEnabled = {
                  matchup: setMatchupEnabled,
                  type_answer: setTypeAnswerEnabled,
                  fill_blank: setFillBlankEnabled,
                  word_magnet: setWordMagnetEnabled,
                  sentence_making: setSentenceMakingEnabled,
                  recording: setRecordingEnabled,
                }[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`text-left rounded-[11px] px-3.5 py-3 border ${
                      enabled ? 'border-[1.5px] border-primary bg-[#F4F9F6]' : 'border-[#E7E1DA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex items-center gap-1.5 text-[13px] ${enabled ? 'font-bold' : 'font-semibold'}`}>
                        <Icon className={`w-3.5 h-3.5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        {label}
                      </span>
                      {enabled && <Check className="w-[15px] h-[15px] text-primary shrink-0" strokeWidth={2.4} />}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${enabled ? 'text-[#5C7D6C]' : 'text-[#8A837D]'}`}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 3단계: 추가 설정 (기본 접힘) ── */}
          <section className="mt-6 pt-5 border-t border-[#F2EDE7]">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[12.5px] font-semibold text-primary"
            >
              <span className="flex items-center gap-2.5">
                <span className="w-[26px] h-[26px] rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                추가 설정 (세트당 단어 수 · 번역 언어 · 제한 시간)
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
            </button>

            {settingsOpen && (
              <div className="space-y-5 mt-4 pl-[34px]">
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
            )}
          </section>

          {/* ── CTA ── */}
          <div className="mt-5">
            <Button
              size="lg"
              className="w-full gap-2 rounded-[13px] h-auto py-[15px] text-[14px]"
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
      </div>
    </AppLayout>
  );
}
