import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Loader2, ArrowLeft, Eye, EyeOff, ArrowRight, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { LevelBadge } from "@/components/ui/level-badge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac/roles";
import { FillBlankPreview } from "@/components/quiz/FillBlankPreview";
import { SentenceMakingPreview } from "@/components/quiz/SentenceMakingPreview";
import { RecordingPreview } from "@/components/quiz/RecordingPreview";
import { MatchUpPreview } from "@/components/quiz/MatchUpPreview";
import { TypeAnswerPreview } from "@/components/quiz/TypeAnswerPreview";
import { WordMagnetPreview } from "@/components/quiz/WordMagnetPreview";
import { parseSentenceToItems } from "@/lib/korean/wordMagnet";
import { segmentSentences } from "@/lib/korean/segment";
import { suggestAcceptableOrders, mergeOrders } from "@/lib/korean/suggestOrders";
import { isShortSentenceLevel } from "@/lib/quiz";
import { quizInsertErrorMessage, readEdgeFunctionError } from "@/lib/supabaseErrors";
import { STAGE_ORDER, STAGE_LABELS, type BaseStage } from "@/types/quiz";
import type { Problem, SentenceMakingProblem, RecordingProblem, MatchupProblem, TypeAnswerProblem, WordMagnetProblem, QuizDraft } from "@/types/quiz";
import { generateTtsAudio, type TtsProvider } from "@/utils/ttsService";
import { FeedbackPromptCard } from "@/components/feedback/FeedbackPromptCard";
import { CheckCircle2 } from "lucide-react";

/** 미리보기에서 보던 단계. 새로고침·탭 복귀 후에도 같은 단계로 돌아오게 한다. */
const PREVIEW_STAGE_KEY = "quizPreviewStage";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "영어",
  zh_CN: "중국어 간체",
  zh_TW: "중국어 번체",
  ja: "일본어",
  vi: "베트남어",
  th: "태국어",
  id: "인도네시아어",
  es: "스페인어",
  fr: "프랑스어",
  de: "독일어",
  ru: "러시아어",
};

export default function QuizPreview() {
  const { user, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [resegmentingId, setResegmentingId] = useState<string | null>(null);
  const [suggestingWordMagnetIds, setSuggestingWordMagnetIds] = useState<Set<string>>(new Set());
  // 어순 추천이 끝나기 전에 저장을 누르면 확인 팝업을 띄우고, "기다렸다가 저장"을 고르면
  // 추천이 끝나는 즉시 자동 저장한다(saveQuiz는 조기 return 아래에 정의돼 ref로 부른다).
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [waitingToSave, setWaitingToSave] = useState(false);
  const saveQuizRef = useRef<() => Promise<void>>();
  const [regeneratingWordMagnetId, setRegeneratingWordMagnetId] = useState<string | null>(null);
  const [regeneratingRecId, setRegeneratingRecId] = useState<string | null>(null);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  // 이번에 저장된 퀴즈가 이 선생님의 "첫 퀴즈"였을 때만 저장 완료 화면에 피드백 카드를 보여준다.
  // null이면 평소대로 저장 즉시 이동, id가 들어오면 이 화면에서 멈춰 피드백을 유도한 뒤 계속하기로 이동.
  const [firstQuizSavedId, setFirstQuizSavedId] = useState<string | null>(null);

  type PreviewStage = BaseStage;
  const [previewStage, setPreviewStage] = useState<PreviewStage>(STAGE_ORDER[0]);

  const enabledStages = useMemo(() => {
    const isEnabled: Record<BaseStage, boolean> = {
      matchup: !!draft?.matchupEnabled,
      type_answer: !!draft?.typeAnswerEnabled,
      fill_blank: draft?.fillBlankEnabled !== false,
      word_magnet: !!draft?.wordMagnetEnabled,
      sentence_making: !!draft?.sentenceMakingEnabled,
      recording: !!draft?.recordingEnabled,
    };
    return STAGE_ORDER.filter((s) => isEnabled[s]);
  }, [draft?.fillBlankEnabled, draft?.matchupEnabled, draft?.typeAnswerEnabled, draft?.wordMagnetEnabled, draft?.sentenceMakingEnabled, draft?.recordingEnabled]);

  // draft 로드 시 정규 순서상 첫 활성 스테이지에서 시작 (1회 초기화)
  // draft가 null인 초기엔 enabledStages가 ["fill_blank"]로만 계산되므로,
  // 로드 후 첫 활성 스테이지(보통 짝 맞추기)로 강제 초기화해야 한다.
  const stageInitRef = useRef(false);
  // 교사가 직접 수정/추가한 말하기(recording) 문제 id 집합. 빈칸 채우기 스테이지를
  // 다시 지나갈 때 이 문제들은 자동 재생성에서 제외하고 보존한다. (렌더 유발 불필요 → ref)
  const manuallyEditedRecIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (draft && !stageInitRef.current && enabledStages.length > 0) {
      stageInitRef.current = true;
      // 새로고침으로 컴포넌트가 다시 마운트돼도 보던 단계를 유지한다.
      const saved = sessionStorage.getItem(PREVIEW_STAGE_KEY) as PreviewStage | null;
      setPreviewStage(saved && enabledStages.includes(saved) ? saved : enabledStages[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, enabledStages]);

  useEffect(() => {
    if (stageInitRef.current) {
      sessionStorage.setItem(PREVIEW_STAGE_KEY, previewStage);
    }
  }, [previewStage]);

  // 현재 스테이지가 비활성화되면(미리보기 중 토글 등) 첫 활성 스테이지로 보정
  useEffect(() => {
    if (enabledStages.length > 0 && !enabledStages.includes(previewStage)) {
      setPreviewStage(enabledStages[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledStages]);

  const currentStageIndex = enabledStages.indexOf(previewStage);
  const isLastStage = currentStageIndex === enabledStages.length - 1;
  const nextStage = enabledStages[currentStageIndex + 1];
  const prevStage = enabledStages[currentStageIndex - 1];

  // 빈칸 문제 id → 단어. 문장순서·말하기 카드 헤더에 출처 단어 라벨로 표시(파생 시 problem_id가 빈칸 id와 동일).
  const sourceWordById = useMemo(() => {
    const map: Record<string, string> = {};
    (draft?.problems || []).forEach((p) => {
      if (p.word) map[p.id] = p.word;
    });
    return map;
  }, [draft?.problems]);

  // 빈칸 채우기 문장에서 말하기 문제를 파생하되, 교사가 직접 수정한 문제(manuallyEditedRecIds)는
  // 그대로 보존하고 손대지 않은 문제만 다시 동기화한다. 또 빈칸 문제와 매칭 안 되는(교사가 직접
  // 추가했거나 원본 빈칸 문제가 삭제된) 기존 말하기 문제는 뒤에 append해서 유실을 막는다.
  const generateRecordingProblems = useCallback(() => {
    if (!draft?.recordingEnabled || !draft.problems) return;

    const existingById = new Map((draft.recordingProblems || []).map((p) => [p.problem_id, p]));
    const fillBlankIds = new Set(draft.problems.map((p) => p.id));

    const merged: RecordingProblem[] = draft.problems.map((problem) => {
      const existing = existingById.get(problem.id);
      // 교사가 직접 수정한 문제는 그대로 보존
      if (manuallyEditedRecIds.current.has(problem.id) && existing) {
        return existing;
      }
      // 손대지 않은 문제는 빈칸 문장에서 파생(기존 mode/label은 보존 → 매번 read로 리셋되던 문제 해소)
      // B1+면 빈칸 파생 대신 short_sentence(있으면)를 그대로 사용, 없으면 기존 치환 폴백.
      const useShort = isShortSentenceLevel(draft.difficulty) && !!problem.short_sentence?.trim();
      return {
        problem_id: problem.id,
        sentence: useShort
          ? problem.short_sentence!.trim()
          : problem.sentence.replace(/\(\s*\)|\(\)/g, problem.answer),
        mode: existing?.mode ?? ("read" as const),
        translation: (useShort
          ? (problem.short_translation ?? problem.translation ?? "")
          : (problem.translation || "")
        ).replace(/[[\]]/g, ""),
        label: existing?.label,
      };
    });

    // 빈칸 문제와 대응되지 않는 기존 말하기 문제(직접 추가/원본 삭제)는 뒤에 그대로 append
    const orphaned = (draft.recordingProblems || []).filter((p) => !fillBlankIds.has(p.problem_id));

    setDraft((prev) => {
      if (!prev) return null;
      return { ...prev, recordingProblems: [...merged, ...orphaned] };
    });
  }, [draft?.recordingEnabled, draft?.problems, draft?.recordingProblems]);

  // 매치업: 단어 목록에서 파생 (비었을 때만 — 엣지/교사가 채운 건 보존)
  const generateMatchupProblems = useCallback(() => {
    if (!draft?.matchupEnabled || !draft.problems) return;
    if (draft.matchupProblems && draft.matchupProblems.length > 0) return;
    const muProblems: MatchupProblem[] = draft.problems
      .filter((p) => p.word?.trim())
      .map((p) => ({ problem_id: p.id, korean_text: p.word, meaning_text: p.meaning || "" }));
    setDraft((prev) => (prev ? { ...prev, matchupProblems: muProblems } : null));
  }, [draft?.matchupEnabled, draft?.problems, draft?.matchupProblems]);

  // 답 입력: 단어 목록에서 파생 (비었을 때만)
  const generateTypeAnswerProblems = useCallback(() => {
    if (!draft?.typeAnswerEnabled || !draft.problems) return;
    if (draft.typeAnswerProblems && draft.typeAnswerProblems.length > 0) return;
    const taProblems: TypeAnswerProblem[] = draft.problems
      .filter((p) => p.word?.trim())
      .map((p) => ({ problem_id: p.id, prompt: p.meaning || "", answer: p.word }));
    setDraft((prev) => (prev ? { ...prev, typeAnswerProblems: taProblems } : null));
  }, [draft?.typeAnswerEnabled, draft?.problems, draft?.typeAnswerProblems]);

  /**
   * 문장 순서 맞추기 허용 어순을 AI에게 제안받아 반영한다. "replace"는 타일이 막 바뀌어
   * 비워둔 목록을 채우고, "merge"는 선생님이 넣은 것을 지키며 덧붙인다.
   * 응답이 오는 사이 타일이 바뀌었으면 옛 타일 기준 제안이라 버린다.
   * 상태 setter만 쓰므로 의존성 없이 고정해 둔다.
   */
  const applyWordMagnetSuggestions = useCallback(
    async (
      targets: { problem_id: string; items: { content: string; isParticle: boolean }[] }[],
      mode: "merge" | "replace",
    ) => {
      const eligible = targets.filter((t) => t.items.length > 2);
      if (eligible.length === 0) return {} as Record<string, string[]>;
      setSuggestingWordMagnetIds((prev) => new Set([...prev, ...eligible.map((t) => t.problem_id)]));
      try {
        const map = await suggestAcceptableOrders(
          eligible.map((t) => ({ id: t.problem_id, tiles: t.items }))
        );
        if (!map) return null;
        const sentAt = new Map(eligible.map((t) => [t.problem_id, JSON.stringify(t.items)]));
        setDraft((prev) => {
          if (!prev?.wordMagnetProblems) return prev;
          return {
            ...prev,
            wordMagnetProblems: prev.wordMagnetProblems.map((p) => {
              const incoming = map[p.problem_id];
              if (!incoming || sentAt.get(p.problem_id) !== JSON.stringify(p.items)) return p;
              const existing = mode === "merge" ? (p.acceptable_orders ?? []) : [];
              return { ...p, acceptable_orders: mergeOrders(existing, incoming, p.base_text) };
            }),
          };
        });
        return map;
      } finally {
        setSuggestingWordMagnetIds((prev) => {
          const next = new Set(prev);
          eligible.forEach((t) => next.delete(t.problem_id));
          return next;
        });
      }
    },
    [],
  );

  // 빈칸 채우기 문장에서 파생되는 base_text를 다시 계산하되, 이미 있는 word_magnet
  // 항목과 base_text가 동일한 문제는 그대로 재사용(교사가 손으로 고친 타일 순서 보존 +
  // 안 바뀐 문제까지 AI 분절 API를 다시 부르는 낭비 방지). 실제로 문장이 바뀌었거나
  // 새로 생긴 문제만 분절 대상에 포함.
  const generateWordMagnetProblems = useCallback(async () => {
    if (!draft?.wordMagnetEnabled || !draft.problems) return;

    const existingByProblemId = new Map((draft.wordMagnetProblems || []).map((p) => [p.problem_id, p]));

    const base = draft.problems
      .map((problem) => {
        // "문제 재생성" 버튼으로 독립 문장을 만들어둔 문제는 그걸 그대로 사용 —
        // 빈칸 채우기 문장이 나중에 바뀌어도 이 문제만은 다시 파생되지 않는다.
        if (problem.word_magnet_sentence) {
          return {
            problem_id: problem.id,
            base_text: problem.word_magnet_sentence,
            translation: problem.word_magnet_translation || "",
          };
        }
        // B1+면 short_sentence(있으면)를 base_text로, 없으면 기존 빈칸 치환 폴백.
        // 어느 경우든 끝 문장부호 정리 후처리는 유지.
        const useShort = isShortSentenceLevel(draft.difficulty) && !!problem.short_sentence?.trim();
        const baseText = (useShort
          ? problem.short_sentence!.trim()
          : problem.sentence.replace(/\(\s*\)|\(\)/g, problem.answer))
          .replace(/([.?!])\s*\.+\s*$/, "$1")
          .trim();
        return {
          problem_id: problem.id,
          base_text: baseText,
          translation: (useShort
            ? (problem.short_translation ?? problem.translation ?? "")
            : (problem.translation || "")
          ).replace(/[[\]]/g, ""),
        };
      })
      .filter((p) => p.base_text.length > 0);

    const heuristic = (text: string) =>
      parseSentenceToItems(text).map((it) => ({ content: it.content, isParticle: it.isParticle }));

    const unchanged = base.filter((b) => existingByProblemId.get(b.problem_id)?.base_text === b.base_text);
    const toSegment = base.filter((b) => existingByProblemId.get(b.problem_id)?.base_text !== b.base_text);

    if (toSegment.length === 0) {
      // 전부 안 바뀜 — API 호출 없이 기존 항목 그대로 유지
      setDraft((prev) =>
        prev
          ? { ...prev, wordMagnetProblems: base.map((b) => existingByProblemId.get(b.problem_id)!) }
          : null
      );
      return;
    }

    // 1) 바뀐/새 문제만 즉시 휴리스틱으로 채워 표시(안 바뀐 문제는 기존 항목 유지)
    setIsSegmenting(true);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            wordMagnetProblems: base.map((b) =>
              existingByProblemId.get(b.problem_id)?.base_text === b.base_text
                ? existingByProblemId.get(b.problem_id)!
                : { ...b, items: heuristic(b.base_text) }
            ),
          }
        : null
    );

    // 2) 바뀐/새 문제만 AI 분절로 업그레이드(실패 시 휴리스틱 유지)
    let segmented: Record<string, { content: string; isParticle: boolean }[]> = {};
    try {
      const map = await segmentSentences(toSegment.map((b) => ({ id: b.problem_id, text: b.base_text })));
      segmented = map;
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              wordMagnetProblems: base.map((b) => {
                if (unchanged.some((u) => u.problem_id === b.problem_id)) {
                  return existingByProblemId.get(b.problem_id)!;
                }
                return {
                  ...b,
                  items: map[b.problem_id] && map[b.problem_id].length > 0 ? map[b.problem_id] : heuristic(b.base_text),
                };
              }),
            }
          : null
      );
    } finally {
      setIsSegmenting(false);
    }

    // 3) 새 타일 기준으로 허용 어순 자동 제안(부가 기능 — 실패해도 조용히 넘어간다)
    void applyWordMagnetSuggestions(
      toSegment.map((b) => ({
        problem_id: b.problem_id,
        items:
          segmented[b.problem_id] && segmented[b.problem_id].length > 0
            ? segmented[b.problem_id]
            : heuristic(b.base_text),
      })),
      "replace",
    );
  }, [draft?.wordMagnetEnabled, draft?.problems, draft?.wordMagnetProblems, applyWordMagnetSuggestions]);

  const updateWordMagnetItems = (
    problemId: string,
    items: { content: string; isParticle: boolean }[]
  ) => {
    setDraft((prev) => {
      if (!prev || !prev.wordMagnetProblems) return prev;
      return {
        ...prev,
        wordMagnetProblems: prev.wordMagnetProblems.map((p) =>
          p.problem_id === problemId ? { ...p, items } : p
        ),
      };
    });
  };

  // 타일이 통째로 바뀌는 경로(재분절·재생성)용 — 기존 허용 어순은 새 타일로 만들 수 없으니 함께 비운다.
  const replaceWordMagnetTiles = (
    problemId: string,
    items: { content: string; isParticle: boolean }[]
  ) => {
    setDraft((prev) => {
      if (!prev || !prev.wordMagnetProblems) return prev;
      return {
        ...prev,
        wordMagnetProblems: prev.wordMagnetProblems.map((p) =>
          p.problem_id === problemId ? { ...p, items, acceptable_orders: [] } : p
        ),
      };
    });
  };

  const updateWordMagnetAcceptableOrders = (problemId: string, orders: string[]) => {
    setDraft((prev) => {
      if (!prev || !prev.wordMagnetProblems) return prev;
      return {
        ...prev,
        wordMagnetProblems: prev.wordMagnetProblems.map((p) =>
          p.problem_id === problemId ? { ...p, acceptable_orders: orders } : p
        ),
      };
    });
  };

  const suggestWordMagnetOrders = async (problemId: string) => {
    const target = draft?.wordMagnetProblems?.find((p) => p.problem_id === problemId);
    if (!target) return;
    const map = await applyWordMagnetSuggestions([target], "merge");
    if (map === null) {
      toast.error("AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } else if ((map[problemId]?.length ?? 0) === 0) {
      toast.info("이 문장은 다른 자연스러운 어순이 없다고 판단했어요.");
    }
  };

  const resegmentWordMagnetProblem = async (problemId: string) => {
    const target = draft?.wordMagnetProblems?.find((p) => p.problem_id === problemId);
    if (!target || !target.base_text.trim()) return;
    setResegmentingId(problemId);
    try {
      const map = await segmentSentences([{ id: problemId, text: target.base_text }]);
      const items = map[problemId] || [];
      replaceWordMagnetTiles(problemId, items);
      void applyWordMagnetSuggestions([{ problem_id: problemId, items }], "replace");
    } finally {
      setResegmentingId(null);
    }
  };

  // 문장 순서 맞추기 문제 하나를 AI로 완전히 새로 생성 — 빈칸 채우기 문제는 건드리지 않고,
  // 새로 만든 문장을 problem.word_magnet_sentence에 남겨서 이후 자동 갱신 로직이
  // 다시 빈칸 채우기 문장에서 파생하지 않도록 한다.
  const regenerateWordMagnetProblem = async (problemId: string) => {
    const sourceProblem = draft?.problems.find((p) => p.id === problemId);
    if (!sourceProblem || !draft) return;
    setRegeneratingWordMagnetId(problemId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words: [sourceProblem.word],
          difficulty: draft.difficulty,
          translationLanguage: draft.translationLanguage,
          wordsPerSet: 1,
          regenerateSingle: true,
          wordMagnetEnabled: true,
          purpose: "regenerate",
        },
      });

      // 서버가 보낸 한국어 사유는 error.context(Response) 본문에 있다. Error로 감싸면
      // Response가 사라지므로 여기서 읽어야 한다(본문은 한 번만 읽을 수 있음).
      if (error) {
        const parsed = await readEdgeFunctionError(error, "재생성에 실패했습니다");
        throw new Error(parsed.message);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const newProblem = data.problems[0];
      // B1+면 새로 생성된 short_sentence(있으면)를 base_text로, 없으면 빈칸 치환 폴백.
      const useShort = isShortSentenceLevel(draft.difficulty) && !!newProblem.short_sentence?.trim();
      const baseText = (useShort
        ? newProblem.short_sentence.trim()
        : newProblem.sentence.replace(/\(\s*\)|\(\)/g, newProblem.answer))
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .trim();
      const translation = (useShort
        ? (newProblem.short_translation ?? newProblem.translation ?? "")
        : (newProblem.translation || "")
      ).replace(/[[\]]/g, "");

      // 동기화된 말하기 문제가 이후 자동 재파생에 덮이지 않도록 수동 편집으로 표시
      manuallyEditedRecIds.current.add(problemId);
      setDraft((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          problems: prev.problems.map((p) =>
            p.id === problemId ? { ...p, word_magnet_sentence: baseText, word_magnet_translation: translation } : p
          ),
          wordMagnetProblems: (prev.wordMagnetProblems || []).map((p) =>
            p.problem_id === problemId
              ? {
                  ...p,
                  base_text: baseText,
                  translation,
                  items: parseSentenceToItems(baseText).map((it) => ({ content: it.content, isParticle: it.isParticle })),
                  acceptable_orders: [],
                }
              : p
          ),
          // 같은 문제의 말하기 문장/번역도 새 값으로 동기화
          recordingProblems: prev.recordingProblems
            ? prev.recordingProblems.map((r) =>
                r.problem_id === problemId ? { ...r, sentence: baseText, translation } : r
              )
            : prev.recordingProblems,
        };
      });

      let finalItems = parseSentenceToItems(baseText).map((it) => ({ content: it.content, isParticle: it.isParticle }));
      try {
        const map = await segmentSentences([{ id: problemId, text: baseText }]);
        if (map[problemId] && map[problemId].length > 0) {
          finalItems = map[problemId];
          replaceWordMagnetTiles(problemId, finalItems);
        }
      } catch (segErr) {
        console.error("Segmentation upgrade failed, keeping heuristic tiles:", segErr);
      }
      void applyWordMagnetSuggestions([{ problem_id: problemId, items: finalItems }], "replace");

      toast.success("문제가 재생성되었습니다");
    } catch (err) {
      console.error("Regenerate word magnet error:", err);
      toast.error(err instanceof Error && err.message ? err.message : "재생성에 실패했습니다");
    } finally {
      setRegeneratingWordMagnetId(null);
    }
  };

  // 스테이지 진입 시 해당 유형 문제 파생 (모두 비었을 때만 — 교사 수정 보존)
  useEffect(() => {
    if (previewStage === "matchup") generateMatchupProblems();
    if (previewStage === "type_answer") generateTypeAnswerProblems();
    if (previewStage === "word_magnet" && (!draft?.wordMagnetProblems || draft.wordMagnetProblems.length === 0)) {
      generateWordMagnetProblems();
    }
    if (previewStage === "recording" && (!draft?.recordingProblems || draft.recordingProblems.length === 0)) {
      generateRecordingProblems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewStage]);

  const handleNextStage = () => {
    if (previewStage === "fill_blank") {
      if (draft?.recordingEnabled) generateRecordingProblems();
      if (draft?.wordMagnetEnabled) generateWordMagnetProblems();
    }
    setPreviewStage(nextStage);
  };

  // 분절 직후 곧바로 어순 추천이 이어지므로(같은 틱에 상태가 바뀜) 둘을 함께 "준비 중"으로 본다.
  // 분절 중에 저장하면 타일도 임시(휴리스틱) 상태로 저장되기 때문에 함께 기다리는 게 맞다.
  const wordMagnetPreparing =
    !!draft?.wordMagnetEnabled && (isSegmenting || suggestingWordMagnetIds.size > 0);

  useEffect(() => {
    if (waitingToSave && !wordMagnetPreparing) {
      setWaitingToSave(false);
      void saveQuizRef.current?.();
    }
  }, [waitingToSave, wordMagnetPreparing]);

  useEffect(() => {
    if (draft) {
      sessionStorage.setItem("quizDraft", JSON.stringify(draft));
    }
  }, [draft]);

  useEffect(() => {
    const stored = sessionStorage.getItem("quizDraft");
    if (stored) {
      setDraft(JSON.parse(stored));
    } else {
      navigate("/quiz/create");
    }
  }, [navigate]);

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

  if (!draft) {
    return null;
  }

  const updateProblem = (problemId: string, field: keyof Problem, value: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      const updated = prev.problems.map((p) => (p.id === problemId ? { ...p, [field]: value } : p));
      const updatedWords = field === "word" ? updated.map((p) => p.word) : prev.words;
      return { ...prev, problems: updated, words: updatedWords };
    });
  };

  const addFillBlankProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: Problem = {
        id: `fill-${Date.now()}`,
        word: "",
        answer: "",
        sentence: "( )",
        hint: "",
        translation: "",
      };
      return { ...prev, problems: [...prev.problems, newProblem], words: [...prev.words, ""] };
    });
  };

  const deleteFillBlankProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = prev.problems.filter((p) => p.id !== problemId);
      return { ...prev, problems: updated, words: updated.map((p) => p.word) };
    });
  };

  const updateSentenceMakingProblem = (problemId: string, field: keyof SentenceMakingProblem, value: string) => {
    setDraft((prev) => {
      if (!prev || !prev.sentenceMakingProblems) return prev;
      const updated = prev.sentenceMakingProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, sentenceMakingProblems: updated };
    });
  };

  const deleteSentenceMakingProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.sentenceMakingProblems) return prev;
      return {
        ...prev,
        sentenceMakingProblems: prev.sentenceMakingProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const addSentenceMakingProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: SentenceMakingProblem = {
        problem_id: `sm-${Date.now()}`,
        word: "",
        word_meaning: "",
        model_answer: "",
      };
      return { ...prev, sentenceMakingProblems: [...(prev.sentenceMakingProblems || []), newProblem] };
    });
  };

  const updateMatchupProblem = (problemId: string, field: keyof MatchupProblem, value: string) => {
    setDraft((prev) => {
      if (!prev || !prev.matchupProblems) return prev;
      const updated = prev.matchupProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, matchupProblems: updated };
    });
  };

  const deleteMatchupProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.matchupProblems) return prev;
      return {
        ...prev,
        matchupProblems: prev.matchupProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const addMatchupProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: MatchupProblem = {
        problem_id: `mu-${Date.now()}`,
        korean_text: "",
        meaning_text: "",
      };
      return { ...prev, matchupProblems: [...(prev.matchupProblems || []), newProblem] };
    });
  };

  const updateTypeAnswerProblem = (problemId: string, field: keyof TypeAnswerProblem, value: string) => {
    setDraft((prev) => {
      if (!prev || !prev.typeAnswerProblems) return prev;
      const updated = prev.typeAnswerProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, typeAnswerProblems: updated };
    });
  };

  const deleteTypeAnswerProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.typeAnswerProblems) return prev;
      return {
        ...prev,
        typeAnswerProblems: prev.typeAnswerProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const addTypeAnswerProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: TypeAnswerProblem = {
        problem_id: `ta-${Date.now()}`,
        prompt: "",
        answer: "",
      };
      return { ...prev, typeAnswerProblems: [...(prev.typeAnswerProblems || []), newProblem] };
    });
  };

  // 워드마그넷: base_text 수정 시 타일(items) 자동 재파생, translation은 그대로 반영.
  // 동시에 같은 problem_id의 말하기 연습 문장/번역도 동기화(한 방향: 문장순서 → 말하기).
  const updateWordMagnetProblem = (
    problemId: string,
    field: "base_text" | "translation",
    value: string
  ) => {
    // 동기화된 말하기 문제가 이후 "빈칸→말하기 자동 재파생"에 덮이지 않도록 수동 편집으로 표시
    manuallyEditedRecIds.current.add(problemId);
    setDraft((prev) => {
      if (!prev || !prev.wordMagnetProblems) return prev;
      const updated = prev.wordMagnetProblems.map((p) => {
        if (p.problem_id !== problemId) return p;
        if (field === "base_text") {
          const items = parseSentenceToItems(value).map((it) => ({
            content: it.content,
            isParticle: it.isParticle,
          }));
          // 문장이 바뀌면 타일도 다시 만들어지므로 기존 허용 어순은 더 이상 유효하지 않다.
          return { ...p, base_text: value, items, acceptable_orders: [] };
        }
        return { ...p, translation: value };
      });
      // 같은 문제의 말하기 문장(sentence)/번역(translation)도 함께 갱신
      const recField = field === "base_text" ? "sentence" : "translation";
      const recordingProblems = prev.recordingProblems
        ? prev.recordingProblems.map((r) =>
            r.problem_id === problemId ? { ...r, [recField]: value } : r
          )
        : prev.recordingProblems;
      return { ...prev, wordMagnetProblems: updated, recordingProblems };
    });
  };

  const deleteWordMagnetProblem = (problemId: string) => {
    setDraft((prev) => {
      if (!prev || !prev.wordMagnetProblems) return prev;
      return {
        ...prev,
        wordMagnetProblems: prev.wordMagnetProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  const addWordMagnetProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newProblem: WordMagnetProblem = {
        problem_id: `wm-${Date.now()}`,
        base_text: "",
        translation: "",
        items: [],
      };
      return { ...prev, wordMagnetProblems: [...(prev.wordMagnetProblems || []), newProblem] };
    });
  };

  const updateRecordingProblem = (problemId: string, field: keyof RecordingProblem, value: string) => {
    // 어떤 field든 편집하면 수동 편집으로 표시 → 이후 자동 재생성에서 보존
    manuallyEditedRecIds.current.add(problemId);
    setDraft((prev) => {
      if (!prev || !prev.recordingProblems) return prev;
      const updated = prev.recordingProblems.map((p) =>
        p.problem_id === problemId ? { ...p, [field]: value } : p
      );
      return { ...prev, recordingProblems: updated };
    });
  };

  const deleteRecordingProblem = (problemId: string) => {
    // 삭제 시 집합에서도 제거(누수 방지)
    manuallyEditedRecIds.current.delete(problemId);
    setDraft((prev) => {
      if (!prev || !prev.recordingProblems) return prev;
      return {
        ...prev,
        recordingProblems: prev.recordingProblems.filter((p) => p.problem_id !== problemId),
      };
    });
  };

  // 말하기 문제 하나를 AI로 같은 단어의 새 예문으로 재생성 — 빈칸 채우기 문장 복사가 아니라 완전히 새 문장.
  const regenerateRecordingProblem = async (problemId: string, index: number) => {
    if (!draft) return;
    // 교사가 "단어" 칩(label)을 바꿨으면 그 값을 우선 사용, 없으면 원본 빈칸 채우기 단어로 폴백
    const recProblem = draft.recordingProblems?.find((p) => p.problem_id === problemId);
    const word = recProblem?.label?.trim() || sourceWordById[problemId] || draft.problems[index]?.word;
    if (!word) {
      toast.error("원본 단어를 찾을 수 없습니다");
      return;
    }
    setRegeneratingRecId(problemId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words: [word],
          difficulty: draft.difficulty,
          translationLanguage: draft.translationLanguage,
          wordsPerSet: 1,
          regenerateSingle: true,
          recordingEnabled: true,
          purpose: "regenerate",
        },
      });

      // 서버가 보낸 한국어 사유는 error.context(Response) 본문에 있다. Error로 감싸면
      // Response가 사라지므로 여기서 읽어야 한다(본문은 한 번만 읽을 수 있음).
      if (error) {
        const parsed = await readEdgeFunctionError(error, "재생성에 실패했습니다");
        throw new Error(parsed.message);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const newProblem = data.problems[0];
      // B1+면 새로 생성된 short_sentence(있으면)를 문장으로, 없으면 빈칸 치환 폴백.
      const useShort = isShortSentenceLevel(draft.difficulty) && !!newProblem.short_sentence?.trim();
      const sentence = (useShort
        ? newProblem.short_sentence.trim()
        : newProblem.sentence.replace(/\(\s*\)|\(\)/g, newProblem.answer))
        .replace(/([.?!])\s*\.+\s*$/, "$1")
        .trim();
      const translation = (useShort
        ? (newProblem.short_translation ?? newProblem.translation ?? "")
        : (newProblem.translation || "")
      ).replace(/[[\]]/g, "");

      // 재생성 결과는 독립 편집 → 이후 빈칸 채우기 자동 동기화에서 덮이면 안 됨
      manuallyEditedRecIds.current.add(problemId);

      setDraft((prev) => {
        if (!prev || !prev.recordingProblems) return prev;
        const updated = prev.recordingProblems.map((p) =>
          p.problem_id === problemId ? { ...p, sentence, translation } : p
        );
        return { ...prev, recordingProblems: updated };
      });
      toast.success("새 문장으로 재생성되었습니다");
    } catch (err) {
      console.error("Regenerate recording error:", err);
      toast.error(err instanceof Error && err.message ? err.message : "재생성에 실패했습니다");
    } finally {
      setRegeneratingRecId(null);
    }
  };

  const addRecordingProblem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newId = `rec-${Date.now()}`;
      // 직접 추가한 문제 → 수동 편집으로 표시(append 규칙으로도 보존되지만 안전하게 명시)
      manuallyEditedRecIds.current.add(newId);
      const newProblem: RecordingProblem = {
        problem_id: newId,
        sentence: "",
        mode: "read",
        translation: "",
        label: "",
      };
      return { ...prev, recordingProblems: [...(prev.recordingProblems || []), newProblem] };
    });
  };

  const regenerateProblem = async (problem: Problem) => {
    setRegeneratingId(problem.id);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          words: [problem.word],
          difficulty: draft.difficulty,
          translationLanguage: draft.translationLanguage,
          wordsPerSet: 1,
          regenerateSingle: true,
          purpose: "regenerate",
        },
      });

      // 서버가 보낸 한국어 사유는 error.context(Response) 본문에 있다. Error로 감싸면
      // Response가 사라지므로 여기서 읽어야 한다(본문은 한 번만 읽을 수 있음).
      if (error) {
        const parsed = await readEdgeFunctionError(error, "재생성에 실패했습니다");
        throw new Error(parsed.message);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const newProblem = data.problems[0];
      setDraft((prev) => {
        if (!prev) return null;
        const updated = prev.problems.map((p) => (p.id === problem.id ? { ...newProblem, id: problem.id } : p));
        return { ...prev, problems: updated };
      });
      toast.success("문제가 재생성되었습니다");
    } catch (error) {
      console.error("Regenerate error:", error);
      toast.error(error instanceof Error && error.message ? error.message : "재생성에 실패했습니다");
    } finally {
      setRegeneratingId(null);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateAndUploadAudio = async (
    text: string,
    quizId: string,
    problemId: string,
    type: "sentence" | "hint" | "recording"
  ): Promise<string | null> => {
    try {
      const problem = draft.problems.find((p) => p.id === problemId);
      let cleanText = text;
      if (type === "sentence" && problem) {
        cleanText = text.replace(/\(\s*\)|\(\)/g, problem.answer);
      }
      cleanText = cleanText.replace(/([.?!])\s*\.+\s*$/, "$1").replace(/\.\s*\.$/, ".");

      const audioBlob = await generateTtsAudio(cleanText, draft.ttsProvider || "elevenlabs");

      if (!audioBlob) {
        console.error(`TTS generation failed for ${type}`);
        return null;
      }

      const fileName = `${quizId}/${problemId}_${type}.mp3`;

      const { error: uploadError } = await supabase.storage.from("quiz-audio").upload(fileName, audioBlob, {
        contentType: "audio/mpeg",
        upsert: true,
      });

      if (uploadError) {
        console.error(`Audio upload failed for ${type}:`, uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from("quiz-audio").getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      console.error(`TTS error for ${type}:`, error);
      return null;
    }
  };

  const saveQuiz = async () => {
    setIsSaving(true);

    try {
      const shuffledProblems = shuffleArray(draft.problems);

      const quizData = {
        title: draft.title,
        words: draft.words,
        difficulty: draft.difficulty as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        translation_language: draft.translationLanguage as
          | "en"
          | "zh_CN"
          | "zh_TW"
          | "ja"
          | "vi"
          | "th"
          | "id"
          | "es"
          | "fr"
          | "de"
          | "ru",
        words_per_set: draft.wordsPerSet,
        timer_seconds: draft.timerSeconds,
        problems: JSON.parse(JSON.stringify(shuffledProblems)),
        teacher_id: user.id,
        source: "ai_generated",
        fill_blank_enabled: draft.fillBlankEnabled !== false,
        sentence_making_enabled: draft.sentenceMakingEnabled || false,
        recording_enabled: draft.recordingEnabled || false,
        matchup_enabled: draft.matchupEnabled || false,
        type_answer_enabled: draft.typeAnswerEnabled || false,
        word_magnet_enabled: draft.wordMagnetEnabled || false,
      };

      const { data, error } = await supabase.from("quizzes").insert(quizData as any).select().single();

      // 한도 트리거(enforce_quiz_quota)에 막히면 트리거가 던진 한국어 문구가 여기로 온다.
      // 그 외 DB 에러는 영문 Postgres 문구라 헬퍼가 아래 fallback으로 덮는다.
      if (error) throw new Error(quizInsertErrorMessage(error, "저장에 실패했어요"));

      const answersToInsert = shuffledProblems.map((problem) => ({
        quiz_id: data.id,
        problem_id: problem.id,
        correct_answer: problem.answer,
        word: problem.word,
      }));

      const { error: answersError } = await supabase.from("quiz_answers").insert(answersToInsert);

      if (answersError) {
        console.error("Failed to save quiz answers:", answersError);
        await supabase.from("quizzes").delete().eq("id", data.id);
        // 아래 catch가 message를 그대로 토스트에 띄우므로 사용자에게 보여줄 한국어로 쓴다.
        throw new Error("문제 정보를 저장하지 못했어요");
      }

      if (draft.sentenceMakingEnabled && draft.sentenceMakingProblems && draft.sentenceMakingProblems.length > 0) {
        const smProblemsToInsert = draft.sentenceMakingProblems.map((p) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          word: p.word,
          word_meaning: p.word_meaning || null,
          model_answer: p.model_answer,
        }));

        const { error: smError } = await supabase.from("sentence_making_problems").insert(smProblemsToInsert);
        if (smError) {
          console.error("Failed to save sentence making problems:", smError);
        }
      }

      if (draft.matchupEnabled && draft.matchupProblems && draft.matchupProblems.length > 0) {
        const muProblemsToInsert = draft.matchupProblems
          .filter((p) => p.korean_text.trim() && p.meaning_text.trim())
          .map((p) => ({
            quiz_id: data.id,
            problem_id: p.problem_id,
            korean_text: p.korean_text,
            meaning_text: p.meaning_text,
          }));

        if (muProblemsToInsert.length > 0) {
          const { error: muError } = await supabase.from("matchup_problems").insert(muProblemsToInsert);
          if (muError) {
            console.error("Failed to save matchup problems:", muError);
          }
        }
      }

      if (draft.typeAnswerEnabled && draft.typeAnswerProblems && draft.typeAnswerProblems.length > 0) {
        const taProblemsToInsert = draft.typeAnswerProblems
          .filter((p) => p.prompt.trim() && p.answer.trim())
          .map((p) => ({
            quiz_id: data.id,
            problem_id: p.problem_id,
            prompt: p.prompt,
            answer: p.answer,
          }));

        if (taProblemsToInsert.length > 0) {
          const { error: taError } = await supabase.from("type_answer_problems").insert(taProblemsToInsert);
          if (taError) {
            console.error("Failed to save type answer problems:", taError);
          }
        }
      }

      if (draft.wordMagnetEnabled && draft.wordMagnetProblems && draft.wordMagnetProblems.length > 0) {
        const wmProblemsToInsert = draft.wordMagnetProblems
          .filter((p) => p.base_text.trim() && p.items.length > 0)
          .map((p, index) => ({
            quiz_id: data.id,
            problem_id: p.problem_id,
            base_text: p.base_text,
            translation: p.translation || null,
            items: p.items,
            acceptable_orders: p.acceptable_orders ?? [],
            sort_order: index,
          })) as unknown as Database["public"]["Tables"]["word_magnet_problems"]["Insert"][];

        if (wmProblemsToInsert.length > 0) {
          const { error: wmError } = await supabase.from("word_magnet_problems").insert(wmProblemsToInsert);
          if (wmError) {
            console.error("Failed to save word magnet problems:", wmError);
          }
        }
      }

      if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
        const recProblemsToInsert = draft.recordingProblems.map((p, index) => ({
          quiz_id: data.id,
          problem_id: p.problem_id,
          sentence: p.sentence,
          mode: p.mode,
          translation: p.translation || null,
          source_type: "reuse" as const,
          sort_order: index,
          label: p.label || null,
        }));

        const { error: recError } = await supabase.from("recording_problems").insert(recProblemsToInsert);
        if (recError) {
          console.error("Failed to save recording problems:", recError);
        }
      }

      // ── 문장 은행 자동 수집 ──
      // 복습은 같은 단어를 매번 다른 문장으로 물어보는데, 은행이 비어 있으면
      // 회전할 문장이 없어 늘 원본만 나온다. AI가 만든 문장도 모아 두면 커버리지가
      // 빨리 채워진다. 다만 검수를 거치지 않았으므로 source='quiz'로 표시해서,
      // 복습에서는 붙여넣기로 검수한 문장(import)을 먼저 쓰고 모자랄 때만 쓰이게 한다.
      // 실패해도 퀴즈 저장 자체는 성공이므로 조용히 넘어간다.
      try {
        const bankRows = shuffledProblems
          // 은행에는 빈칸이 없는 완성형 문장을 넣는다(6종이 서로 다른 형태로 쓴다).
          .map((p) => ({
            word: p.word,
            meaning: p.meaning ?? null,
            level: draft.difficulty,
            sentence: p.sentence.replace(/\(\s*\)|\(\)/g, p.answer).replace(/\s+/g, " ").trim(),
            answer: p.answer,
            hint: p.hint ?? null,
            translation: p.translation ?? null,
          }))
          .filter((r) => r.word && r.sentence && r.answer && !r.sentence.includes("("));

        if (bankRows.length > 0) {
          await supabase.rpc("upsert_sentence_bank", { _rows: bankRows, _source: "quiz" });
        }
      } catch (bankError) {
        console.error("Failed to collect sentences into bank:", bankError);
      }

      toast.success("퀴즈가 저장되었습니다! 음성을 생성 중입니다...");

      (async () => {
        try {
          const problemsWithAudio = [];

          for (const problem of shuffledProblems) {
            const sentenceAudioUrl = await generateAndUploadAudio(problem.sentence, data.id, problem.id, "sentence");

            problemsWithAudio.push({
              quiz_id: data.id,
              problem_id: problem.id,
              word: problem.word,
              sentence: problem.sentence,
              hint: problem.hint,
              translation: problem.translation,
              sentence_audio_url: sentenceAudioUrl,
              hint_audio_url: null,
            });
          }

          const { error: problemsError } = await supabase.from("quiz_problems").insert(problemsWithAudio);

          if (problemsError) {
            console.error("Failed to save quiz problems with audio:", problemsError);
          } else {
            console.log("Audio generation completed for fill-blank problems:", data.id);
          }

          if (draft.recordingEnabled && draft.recordingProblems && draft.recordingProblems.length > 0) {
            const fillBlankAudioMap = new Map(
              problemsWithAudio
                .filter((p) => p.sentence_audio_url)
                .map((p) => [p.problem_id, p.sentence_audio_url])
            );

            for (const recProblem of draft.recordingProblems) {
              // 대응 fill_blank 문제의 "완성 문장" 계산 (공통 헬퍼).
              const fbSource = shuffledProblems.find((p) => p.id === recProblem.problem_id);
              const filledSentence = fbSource
                ? fbSource.sentence
                    .replace(/\(\s*\)|\(\)/g, fbSource.answer)
                    .replace(/([.?!])\s*\.+\s*$/, "$1")
                    .trim()
                : "";

              let audioUrl: string | null | undefined;
              if (fbSource && recProblem.sentence.trim() === filledSentence.trim()) {
                // A1/A2: recording 문장 == fill_blank 완성 문장 → 기존 오디오 재사용(비용 절약).
                audioUrl = fillBlankAudioMap.get(recProblem.problem_id);
              } else {
                // B1+ 짧은 문장: recording 문장과 다르므로 recording 문장으로 오디오 직접 생성.
                // type을 "recording"으로 따로 둬서 파일 경로(${problemId}_${type}.mp3)가 빈칸
                // 채우기 sentence 오디오(${problemId}_sentence.mp3)와 겹치지 않게 한다 — 겹치면
                // upsert:true라 나중에 업로드되는 이쪽이 먼저 만든 파일을 덮어써 버린다.
                audioUrl = await generateAndUploadAudio(
                  recProblem.sentence,
                  data.id,
                  recProblem.problem_id,
                  "recording"
                );
              }

              if (audioUrl) {
                const { error: updateError } = await supabase
                  .from("recording_problems")
                  .update({ sentence_audio_url: audioUrl })
                  .eq("quiz_id", data.id)
                  .eq("problem_id", recProblem.problem_id);

                if (updateError) {
                  console.error("Failed to update recording audio URL:", updateError);
                }
              }
            }
            console.log("Recording audio URLs synced (reuse for matching, generated for short sentences):", data.id);
          }
        } catch (audioError) {
          console.error("Audio generation error:", audioError);
        }
      })();

      sessionStorage.removeItem("quizDraft");
      sessionStorage.removeItem(PREVIEW_STAGE_KEY);

      // 이 퀴즈가 이 선생님의 첫 퀴즈였는지 확인 — 방금 저장한 것까지 포함해 정확히 1개일 때만.
      // count만 세는 가벼운 조회라 저장 흐름을 지연시키지 않는다. 실패해도 저장 자체는
      // 이미 끝났으므로 조용히 넘어가고 평소대로 이동한다.
      let isFirstQuiz = false;
      try {
        const { count, error: countError } = await supabase
          .from("quizzes")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id);
        if (!countError && count === 1) {
          isFirstQuiz = true;
        }
      } catch (countCheckError) {
        console.error("Failed to check first-quiz status:", countCheckError);
      }

      if (isFirstQuiz) {
        // 저장 완료 화면에서 잠시 멈춰 피드백을 유도한 뒤, 선생님이 "계속하기"를 누르면 이동한다.
        setFirstQuizSavedId(data.id);
      } else {
        navigate(`/quiz/${data.id}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      // quizzes INSERT는 한도 트리거(enforce_quiz_quota)에 막힐 수 있고, 그때 트리거가 던진
      // 한국어 문구가 error.message로 그대로 온다. 고정 문구로 덮으면 한도 사실이 가려진다.
      toast.error(error instanceof Error && error.message ? error.message : "저장에 실패했어요");
    } finally {
      setIsSaving(false);
    }
  };

  // 첫 퀴즈를 막 저장했을 때: 목록/상세로 바로 넘기지 않고 여기서 잠깐 멈춰 피드백을 유도한다.
  saveQuizRef.current = saveQuiz;

  const handleSaveClick = () => {
    if (wordMagnetPreparing) {
      setSaveConfirmOpen(true);
      return;
    }
    void saveQuiz();
  };

  if (firstQuizSavedId) {
    return (
      <AppLayout>
        <div className="container mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">퀴즈가 저장되었어요!</h1>
            <p className="mt-1 text-sm text-muted-foreground">음성은 이어서 백그라운드로 생성돼요.</p>
          </div>

          <FeedbackPromptCard context="first_quiz_created" title="첫 퀴즈를 만드셨네요! 사용해보니 어떠셨나요?" />

          <Button onClick={() => navigate(`/quiz/${firstQuizSavedId}`)} size="lg">
            계속하기
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </AppLayout>
    );
  }

  const wordsPerSet = draft.wordsPerSet || 5;
  const problemSets: Problem[][] = [];
  for (let i = 0; i < draft.problems.length; i += wordsPerSet) {
    problemSets.push(draft.problems.slice(i, i + wordsPerSet));
  }

  const langLabel = LANGUAGE_LABELS[draft.translationLanguage] || draft.translationLanguage;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" onClick={() => navigate("/quiz/create")} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> 돌아가기
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{draft.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <LevelBadge level={draft.difficulty} />
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground whitespace-nowrap">{draft.problems.length}개 문제</span>
              <span className="text-muted-foreground">·</span>
              <label className="text-sm text-muted-foreground whitespace-nowrap">음성 엔진</label>
              <select
                className="text-sm border rounded px-2 py-1 bg-background text-foreground"
                value={draft.ttsProvider || "elevenlabs"}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, ttsProvider: e.target.value as TtsProvider } : prev)}
              >
                <option value="azure">Azure Speech (무료)</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              {studentPreview ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Label htmlFor="student-preview" className="text-sm cursor-pointer whitespace-nowrap">
                학생 화면
              </Label>
              <Switch id="student-preview" checked={studentPreview} onCheckedChange={setStudentPreview} />
            </div>

            <div className="flex items-center gap-4">
              {currentStageIndex > 0 && (
                <Button variant="outline" onClick={() => setPreviewStage(prevStage)} size="lg">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전
                </Button>
              )}

              {!isLastStage ? (
                <Button onClick={handleNextStage} size="lg">
                  다음: {STAGE_LABELS[nextStage] ?? ""}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSaveClick} disabled={isSaving || waitingToSave} size="lg">
                  {isSaving || waitingToSave ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {waitingToSave ? "어순 추천 기다리는 중…" : "저장하기"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {enabledStages.length > 1 && (
          <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
            {enabledStages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  onClick={() => setPreviewStage(stage)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors cursor-pointer hover:opacity-80 ${
                    previewStage === stage
                      ? "bg-primary text-primary-foreground border-primary"
                      : index < currentStageIndex
                        ? "bg-success/15 text-success-foreground border-success/30"
                        : "bg-white text-[#8A837D] border-border"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      previewStage === stage
                        ? "bg-white/20"
                        : index < currentStageIndex
                          ? "bg-success/20"
                          : "bg-[#F4F0EA] text-[#8A837D]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {index < enabledStages.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}

        {previewStage === "fill_blank" && (
          <FillBlankPreview
            problemSets={problemSets}
            wordsPerSet={wordsPerSet}
            studentPreview={studentPreview}
            showTranslations={showTranslations}
            setShowTranslations={setShowTranslations}
            regeneratingId={regeneratingId}
            langLabel={langLabel}
            updateProblem={updateProblem}
            regenerateProblem={regenerateProblem}
            addFillBlankProblem={addFillBlankProblem}
            deleteFillBlankProblem={deleteFillBlankProblem}
          />
        )}

        {previewStage === "matchup" && draft.matchupProblems && draft.matchupProblems.length > 0 && (
          <MatchUpPreview
            problems={draft.matchupProblems}
            studentPreview={studentPreview}
            updateMatchupProblem={updateMatchupProblem}
            deleteMatchupProblem={deleteMatchupProblem}
            addMatchupProblem={addMatchupProblem}
          />
        )}

        {previewStage === "type_answer" && draft.typeAnswerProblems && draft.typeAnswerProblems.length > 0 && (
          <TypeAnswerPreview
            problems={draft.typeAnswerProblems}
            studentPreview={studentPreview}
            updateTypeAnswerProblem={updateTypeAnswerProblem}
            deleteTypeAnswerProblem={deleteTypeAnswerProblem}
            addTypeAnswerProblem={addTypeAnswerProblem}
          />
        )}

        {previewStage === "word_magnet" && draft.wordMagnetProblems && draft.wordMagnetProblems.length > 0 && (
          <>
            {isSegmenting && !studentPreview && (
              <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 text-sm text-primary/80">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI가 타일을 분절하는 중...
              </div>
            )}
            <WordMagnetPreview
              problems={draft.wordMagnetProblems}
              studentPreview={studentPreview}
              updateWordMagnetProblem={updateWordMagnetProblem}
              updateWordMagnetItems={updateWordMagnetItems}
              updateWordMagnetAcceptableOrders={updateWordMagnetAcceptableOrders}
              suggestWordMagnetOrders={suggestWordMagnetOrders}
              suggestingWordMagnetIds={suggestingWordMagnetIds}
              resegmentWordMagnetProblem={resegmentWordMagnetProblem}
              resegmentingId={resegmentingId}
              regenerateWordMagnetProblem={regenerateWordMagnetProblem}
              regeneratingWordMagnetId={regeneratingWordMagnetId}
              deleteWordMagnetProblem={deleteWordMagnetProblem}
              addWordMagnetProblem={addWordMagnetProblem}
              sourceWords={sourceWordById}
            />
          </>
        )}

        {previewStage === "sentence_making" &&
          draft.sentenceMakingProblems &&
          draft.sentenceMakingProblems.length > 0 && (
            <SentenceMakingPreview
              problems={draft.sentenceMakingProblems}
              studentPreview={studentPreview}
              updateSentenceMakingProblem={updateSentenceMakingProblem}
              deleteSentenceMakingProblem={deleteSentenceMakingProblem}
              addSentenceMakingProblem={addSentenceMakingProblem}
            />
          )}

        {previewStage === "recording" && draft.recordingProblems && draft.recordingProblems.length > 0 && (
          <RecordingPreview
            problems={draft.recordingProblems}
            studentPreview={studentPreview}
            updateRecordingProblem={updateRecordingProblem}
            deleteRecordingProblem={deleteRecordingProblem}
            regenerateRecordingProblem={regenerateRecordingProblem}
            addRecordingProblem={addRecordingProblem}
            sourceWords={sourceWordById}
            regeneratingProblemId={regeneratingRecId}
          />
        )}

        <div className="mt-8 flex justify-center gap-4">
          {currentStageIndex > 0 && (
            <Button variant="outline" onClick={() => setPreviewStage(prevStage)} size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전
            </Button>
          )}

          {!isLastStage ? (
            <Button onClick={handleNextStage} size="lg">
              다음: {STAGE_LABELS[nextStage] ?? ""}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSaveClick} disabled={isSaving || waitingToSave} size="lg">
              {isSaving || waitingToSave ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {waitingToSave ? "어순 추천 기다리는 중…" : "퀴즈 저장하기"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>다른 정답 어순을 아직 추천받고 있어요</AlertDialogTitle>
            <AlertDialogDescription>
              문장 순서 맞추기에서 정답으로 인정할 다른 어순을 AI가 찾고 있어요. 보통 1분 안에 끝나요.
              <br />
              지금 저장하면 다른 어순 없이 저장돼요. 나중에 퀴즈 편집 화면의 "전체 AI 추천"으로 추가할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-background text-foreground border border-input hover:bg-accent hover:text-accent-foreground"
              onClick={() => void saveQuiz()}
            >
              지금 저장
            </AlertDialogAction>
            <AlertDialogAction onClick={() => setWaitingToSave(true)}>기다렸다가 저장</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
