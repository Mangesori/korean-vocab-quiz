/**
 * 붙여넣기로 퀴즈 만들기 — AI 호출 없음.
 *
 * QuizCreate는 단어만 받고 문장·뜻·번역을 generate-quiz 엣지 함수(=Claude API)에
 * 맡긴다. 이 페이지는 그 표를 선생님이 미리 채워 오는 대신 **API를 한 번도 부르지
 * 않는다**. 음성만 선택 사항으로 남고(ElevenLabs/Azure TTS), 기본은 꺼져 있다.
 *
 * 저장 순서는 QuizPreview.saveQuiz와 같다. 다만 저기서는 quiz_problems INSERT가
 * TTS 블록 **안**에 있어서 음성을 건너뛰면 그 표가 통째로 비는데, 여기서는
 * quiz_problems를 항상 먼저 넣고 음성은 나중에 URL만 채운다.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Keyboard,
  Library,
  Link2,
  Loader2,
  Magnet,
  Mic,
  PenLine,
  Type,
  Upload,
  Volume2,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { buildProblems, IMPORT_COLUMNS, parseImportText } from "@/lib/quiz/importFormat";
import { quizInsertErrorMessage } from "@/lib/supabaseErrors";
import { generateTtsAudio } from "@/utils/ttsService";
import type { BaseStage } from "@/types/quiz";
import type { Database } from "@/integrations/supabase/types";

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

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const STAGE_CARDS: { key: BaseStage; label: string; desc: string; icon: typeof Link2 }[] = [
  { key: "matchup", label: "짝 맞추기", desc: "단어 매칭", icon: Link2 },
  { key: "type_answer", label: "단어 받아쓰기", desc: "뜻 보고 단어 쓰기", icon: Keyboard },
  { key: "fill_blank", label: "빈칸 채우기", desc: "문장 완성하기", icon: Type },
  { key: "word_magnet", label: "문장 순서 맞추기", desc: "순서대로 단어 배치", icon: Magnet },
  { key: "sentence_making", label: "문장 만들기", desc: "단어 보고 문장 쓰기", icon: PenLine },
  { key: "recording", label: "말하기 연습", desc: "읽거나 듣고 따라 말하기", icon: Mic },
];

const PLACEHOLDER = `${IMPORT_COLUMNS.join("\t")}
공부하다\tto study\tA1\t저는 매일 한국어를 공부해요.\t공부해요\t-아/어요\tI study Korean every day.
공부하다\tto study\tA2\t저는 음악을 들으면서 공부해요.\t공부하면서\t-(으)면서\tI study while listening to music.

탭 또는 쉼표로 구분해요. 구글시트·엑셀에서 그대로 복사해 붙여넣으면 됩니다.
첫 줄이 열 이름이면 자동으로 건너뜁니다.`;

export default function QuizImport() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("A1");
  const [perWordLimit, setPerWordLimit] = useState(2);
  const [translationLanguage, setTranslationLanguage] = useState("en");
  const [wordsPerSet, setWordsPerSet] = useState(5);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  // 문장 은행은 퀴즈와 별개로 쌓이는 공용 자산이다. 복습이 단계마다 다른 문장을
  // 꺼내 쓰려면 여기에 있어야 하므로 기본값을 켬으로 둔다.
  const [saveToBank, setSaveToBank] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stages, setStages] = useState<Record<BaseStage, boolean>>({
    matchup: true,
    type_answer: false,
    fill_blank: true,
    word_magnet: false,
    sentence_making: false,
    recording: false,
  });

  // 붙여넣을 때마다 다시 파싱한다. 510줄 기준으로도 순수 문자열 처리라 체감되지 않는다.
  const parsed = useMemo(() => parseImportText(rawText), [rawText]);

  // 표에 실제로 들어 있는 레벨만 고르게 한다 — 없는 레벨을 골라 0문제가 되는 걸 막는다.
  const availableLevels = useMemo(() => {
    const set = new Set(parsed.rows.map((r) => r.level));
    return LEVELS.filter((l) => set.has(l));
  }, [parsed.rows]);

  const effectiveLevel = availableLevels.includes(level as (typeof LEVELS)[number])
    ? level
    : (availableLevels[0] ?? null);

  const built = useMemo(
    () => buildProblems(parsed.rows, { level: effectiveLevel, perWordLimit }),
    [parsed.rows, effectiveLevel, perWordLimit]
  );

  const anyStage = Object.values(stages).some(Boolean);
  const canSave = !isSaving && built.problems.length > 0 && title.trim().length > 0 && anyStage;

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    setRawText(text);
    if (!title.trim()) setTitle(file.name.replace(/\.(tsv|csv|txt)$/i, ""));
  }, [title]);

  const uploadAudio = async (text: string, quizId: string, problemId: string): Promise<string | null> => {
    try {
      const clean = text.replace(/([.?!])\s*\.+\s*$/, "$1").trim();
      const blob = await generateTtsAudio(clean, "elevenlabs");
      if (!blob) return null;

      const fileName = `${quizId}/${problemId}_sentence.mp3`;
      const { error } = await supabase.storage.from("quiz-audio").upload(fileName, blob, {
        contentType: "audio/mpeg",
        upsert: true,
      });
      if (error) {
        console.error("Audio upload failed:", error);
        return null;
      }
      return supabase.storage.from("quiz-audio").getPublicUrl(fileName).data.publicUrl;
    } catch (e) {
      console.error("TTS error:", e);
      return null;
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const quizData = {
        title: title.trim(),
        words: built.words,
        difficulty: (effectiveLevel ?? "A1") as Database["public"]["Enums"]["difficulty_level"],
        translation_language: translationLanguage as Database["public"]["Enums"]["translation_language"],
        words_per_set: wordsPerSet,
        timer_seconds: timerEnabled ? timerSeconds : null,
        problems: JSON.parse(JSON.stringify(built.problems)),
        teacher_id: user.id,
        fill_blank_enabled: stages.fill_blank,
        sentence_making_enabled: stages.sentence_making,
        recording_enabled: stages.recording,
        matchup_enabled: stages.matchup,
        type_answer_enabled: stages.type_answer,
        word_magnet_enabled: stages.word_magnet,
      };

      const { data, error } = await supabase.from("quizzes").insert(quizData as never).select().single();
      // 한도 트리거(enforce_quiz_quota)가 던지는 한국어 문구를 그대로 살린다.
      if (error) throw new Error(quizInsertErrorMessage(error, "저장에 실패했어요"));

      const quizId = (data as { id: string }).id;

      // quiz_answers는 필수다. 실패하면 방금 만든 quizzes 행을 되돌린다
      // (이 뒤의 자식 표들은 실패해도 퀴즈 자체는 살려 둔다 — QuizPreview와 같은 정책).
      const { error: answersError } = await supabase.from("quiz_answers").insert(
        built.problems.map((p) => ({
          quiz_id: quizId,
          problem_id: p.id,
          correct_answer: p.answer,
          word: p.word,
        }))
      );
      if (answersError) {
        console.error("Failed to save quiz answers:", answersError);
        await supabase.from("quizzes").delete().eq("id", quizId);
        throw new Error("문제 정보를 저장하지 못했어요");
      }

      // 빈칸 채우기 본문. QuizPreview와 달리 TTS 성공 여부와 무관하게 먼저 넣는다.
      const { error: problemsError } = await supabase.from("quiz_problems").insert(
        built.problems.map((p) => ({
          quiz_id: quizId,
          problem_id: p.id,
          word: p.word,
          sentence: p.sentence,
          hint: p.hint || null,
          translation: p.translation || null,
          sentence_audio_url: null,
          hint_audio_url: null,
        }))
      );
      if (problemsError) console.error("Failed to save quiz problems:", problemsError);

      if (stages.matchup && built.matchup.length) {
        const { error: e } = await supabase.from("matchup_problems").insert(
          built.matchup.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            korean_text: p.korean_text,
            meaning_text: p.meaning_text,
            sort_order: i,
          }))
        );
        if (e) console.error("Failed to save matchup problems:", e);
      }

      if (stages.type_answer && built.typeAnswer.length) {
        const { error: e } = await supabase.from("type_answer_problems").insert(
          built.typeAnswer.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            prompt: p.prompt,
            answer: p.answer,
            sort_order: i,
          }))
        );
        if (e) console.error("Failed to save type answer problems:", e);
      }

      if (stages.word_magnet && built.wordMagnet.length) {
        const { error: e } = await supabase.from("word_magnet_problems").insert(
          built.wordMagnet.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            base_text: p.base_text,
            translation: p.translation || null,
            items: p.items,
            sort_order: i,
          })) as unknown as Database["public"]["Tables"]["word_magnet_problems"]["Insert"][]
        );
        if (e) console.error("Failed to save word magnet problems:", e);
      }

      if (stages.sentence_making && built.sentenceMaking.length) {
        const { error: e } = await supabase.from("sentence_making_problems").insert(
          built.sentenceMaking.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            word: p.word,
            word_meaning: p.word_meaning || null,
            model_answer: p.model_answer,
            sort_order: i,
          }))
        );
        if (e) console.error("Failed to save sentence making problems:", e);
      }

      if (stages.recording && built.recording.length) {
        const { error: e } = await supabase.from("recording_problems").insert(
          built.recording.map((p, i) => ({
            quiz_id: quizId,
            problem_id: p.problem_id,
            sentence: p.sentence,
            mode: p.mode,
            translation: p.translation || null,
            source_type: "reuse" as const,
            sort_order: i,
            label: null,
          }))
        );
        if (e) console.error("Failed to save recording problems:", e);
      }

      // ── 문장 은행 ──
      // 퀴즈에 쓴 문장만이 아니라 **붙여넣은 표 전체**를 넣는다. 이번 퀴즈가 A1만
      // 썼더라도, 학생이 나중에 A2로 진급했을 때 쓸 A2 문장이 은행에 있어야 한다.
      let bankSaved = 0;
      if (saveToBank && parsed.rows.length > 0) {
        // seq는 서버가 매긴다. 여기서 매기면 "이번에 붙여넣은 표 안에서 몇 번째"밖에
        // 알 수 없어서, 나중에 다른 문장을 추가로 붙여넣을 때 번호가 겹쳐
        // 기존 은행 문장을 밀어낸다.
        const { data: saved, error: bankError } = await supabase.rpc("upsert_sentence_bank", {
          _rows: parsed.rows.map((r) => ({
            word: r.word,
            meaning: r.meaning,
            level: r.level,
            sentence: r.sentence,
            answer: r.answer,
            hint: r.hint,
            translation: r.translation,
          })),
          _source: "import",
        });

        if (bankError) {
          // 퀴즈는 이미 만들어졌으므로 저장 자체를 실패로 되돌리지는 않는다.
          console.error("Failed to save sentence bank:", bankError);
          toast.warning("퀴즈는 만들어졌지만 문장 은행 저장에 실패했어요.");
        } else {
          bankSaved = saved ?? 0;
        }
      }

      const bankNote = bankSaved > 0 ? ` · 문장 은행 ${bankSaved}개` : "";

      if (!ttsEnabled) {
        toast.success(`퀴즈가 저장되었습니다! (문제 ${built.problems.length}개${bankNote})`);
        navigate(`/quiz/${quizId}`);
        return;
      }

      // 음성은 유일하게 외부 API를 쓰는 부분이라 저장을 끝낸 뒤 별도로 돈다.
      // 실패해도 퀴즈는 이미 완성돼 있고 audio_url만 비어 있게 된다.
      toast.success("퀴즈가 저장되었습니다! 음성을 생성 중입니다...");
      navigate(`/quiz/${quizId}`);

      void (async () => {
        for (const p of built.problems) {
          // 빈칸이 아니라 정답이 채워진 완성 문장을 읽어야 한다.
          const url = await uploadAudio(p.sentence.replace(/\(\s*\)|\(\)/g, p.answer), quizId, p.id);
          if (!url) continue;
          await supabase
            .from("quiz_problems")
            .update({ sentence_audio_url: url })
            .eq("quiz_id", quizId)
            .eq("problem_id", p.id);
          if (stages.recording) {
            await supabase
              .from("recording_problems")
              .update({ sentence_audio_url: url })
              .eq("quiz_id", quizId)
              .eq("problem_id", p.id);
          }
        }
      })();
    } catch (e) {
      console.error("Import save error:", e);
      toast.error(e instanceof Error && e.message ? e.message : "저장에 실패했어요");
    } finally {
      setIsSaving(false);
    }
  };

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

  const stageCount = (key: BaseStage) =>
    key === "matchup"
      ? built.matchup.length
      : key === "type_answer"
        ? built.typeAnswer.length
        : key === "word_magnet"
          ? built.wordMagnet.length
          : key === "sentence_making"
            ? built.sentenceMaking.length
            : key === "recording"
              ? built.recording.length
              : built.problems.length;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ClipboardPaste className="h-8 w-8 text-primary" />
            붙여넣기로 퀴즈 만들기
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            문장을 미리 채운 표를 붙여넣으면 AI를 쓰지 않고 바로 퀴즈를 만들어요.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 md:p-8 space-y-8">
          {/* ── 1. 제목 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="font-semibold text-foreground">퀴즈 제목</h2>
            </div>
            <Input placeholder="예: 1과 어휘 퀴즈 (A1)" value={title} onChange={(e) => setTitle(e.target.value)} />
          </section>

          {/* ── 2. 표 붙여넣기 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="font-semibold text-foreground">표 붙여넣기</h2>
            </div>

            <Textarea
              placeholder={PLACEHOLDER}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[220px] font-mono text-xs resize-none"
            />

            <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
              <div className="text-sm text-muted-foreground">
                읽은 줄 <span className="font-semibold text-foreground">{parsed.rows.length}</span>개
                {parsed.issues.length > 0 && (
                  <span className="text-destructive"> · 문제 {parsed.issues.length}건</span>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                파일 열기
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".tsv,.csv,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {parsed.issues.length > 0 && (
              <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive mb-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  건너뛴 줄 {parsed.issues.length}개
                </div>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                  {parsed.issues.slice(0, 20).map((it) => (
                    <li key={it.line} className="text-xs text-muted-foreground">
                      <span className="font-mono text-foreground">{it.line}번째 줄</span> — {it.message}
                    </li>
                  ))}
                  {parsed.issues.length > 20 && (
                    <li className="text-xs text-muted-foreground">…외 {parsed.issues.length - 20}건</li>
                  )}
                </ul>
              </div>
            )}
          </section>

          {/* ── 3. 레벨 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h2 className="font-semibold text-foreground">레벨</h2>
            </div>
            {availableLevels.length === 0 ? (
              <p className="text-sm text-muted-foreground">표를 붙여넣으면 들어 있는 레벨이 여기 나와요.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {availableLevels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`px-4 py-2 rounded-full border-2 font-bold text-sm transition-all ${
                        effectiveLevel === l
                          ? "border-primary bg-accent text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">단어당 최대 문장 수</label>
                    <span className="text-sm font-semibold text-foreground">{perWordLimit}개</span>
                  </div>
                  <Slider value={[perWordLimit]} onValueChange={(v) => setPerWordLimit(v[0])} min={1} max={5} step={1} />
                  <p className="text-xs text-muted-foreground">
                    한 단어에 예문이 여러 개면 앞에서부터 이만큼만 써요.
                  </p>
                </div>
              </>
            )}
          </section>

          {/* ── 4. 퀴즈 유형 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <h2 className="font-semibold text-foreground">퀴즈 유형</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STAGE_CARDS.map(({ key, label, desc, icon: Icon }) => {
                const on = stages[key];
                const count = stageCount(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStages((s) => ({ ...s, [key]: !s[key] }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      on ? "border-primary bg-accent" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {on && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-bold text-sm text-foreground">{label}</span>
                    </div>
                    <div className={`text-xs ${on ? "text-primary" : "text-muted-foreground"}`}>
                      {count > 0 ? `${desc} · ${count}문제` : desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 5. 추가 설정 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">5</span>
              <h2 className="font-semibold text-foreground">추가 설정</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">세트당 단어 수</label>
                  <span className="text-sm font-semibold text-foreground">{wordsPerSet}개</span>
                </div>
                <Slider value={[wordsPerSet]} onValueChange={(v) => setWordsPerSet(v[0])} min={1} max={10} step={1} />
              </div>

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
                <p className="text-xs text-muted-foreground">표의 `번역` 칸이 어느 언어인지 알려 주는 값이에요.</p>
              </div>

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

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Library className="w-4 h-4 text-muted-foreground" />
                      문장 은행에도 저장
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      붙여넣은 <span className="font-semibold text-foreground">{parsed.rows.length}줄</span> 전체를
                      복습용으로 쌓아 둡니다. 복습할 때 같은 단어를 매번 다른 문장으로 물어봐요.
                    </div>
                  </div>
                  <Switch checked={saveToBank} onCheckedChange={setSaveToBank} />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      음성 만들기
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      이것만 외부 API(TTS)를 씁니다. 꺼 두면 저장이 훨씬 빨라요.
                    </div>
                  </div>
                  <Switch checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
                </div>
              </div>
            </div>
          </section>

          {/* ── 저장 ── */}
          <div className="pt-2 pb-8">
            <Button size="lg" className="w-full gap-2" onClick={handleSave} disabled={!canSave}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 저장 중...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  퀴즈 만들기
                  {built.problems.length > 0 && ` (${built.words.length}단어 · ${built.problems.length}문제)`}
                </>
              )}
            </Button>
            {!anyStage && built.problems.length > 0 && (
              <p className="text-xs text-destructive text-center mt-2">퀴즈 유형을 하나 이상 골라 주세요.</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
