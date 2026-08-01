import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Play, Radio } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLiveSession } from "@/hooks/useLiveSession";
import { STAGE_LABELS, type BaseStage } from "@/types/quiz";
import {
  DEFAULT_LIVE_SETTINGS,
  LIVE_STAGES,
  type LiveSessionSettings,
} from "@/types/liveSession";

const STAGE_DOT: Record<BaseStage, string> = {
  fill_blank: "bg-type-fill-blank",
  matchup: "bg-type-matchup",
  type_answer: "bg-type-type-answer",
  word_magnet: "bg-type-word-magnet",
  sentence_making: "bg-type-sentence-making",
  recording: "bg-type-recording",
};

const SETTING_ROWS: { key: keyof LiveSessionSettings; label: string; desc: string }[] = [
  {
    key: "watchScreens",
    label: "학생 화면 실시간 보기",
    desc: "학생이 푸는 과정을 볼 수 있어요. 끄면 진행률만 보입니다.",
  },
  {
    key: "allowGuests",
    label: "비회원 참여 허용",
    desc: "로그인 없이 이름만 적고 들어올 수 있어요. 로그인한 학생은 결과가 저장됩니다.",
  },
  { key: "anonymize", label: "학생 이름 숨기기", desc: "화면에 이름 대신 번호로 표시합니다." },
  {
    key: "shuffle",
    label: "학생마다 문제 순서 섞기",
    desc: "끄면 모두가 같은 순서로 풉니다. 켜면 학생끼리 순서가 달라져 선생님 화면에서 같은 번호끼리 비교하기 어려워요.",
  },
];

/**
 * 퀴즈 상세에서 라이브 세션을 여는 다이얼로그.
 * 세션을 만들면 곧바로 선생님 라이브 화면(/live/:id)으로 넘어간다.
 */
export function StartLiveDialog({
  open,
  onOpenChange,
  quizId,
  /** 이 퀴즈에 실제로 들어 있는 유형 (말하기 연습은 걸러서 넘길 것) */
  availableStages,
  classId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quizId: string;
  availableStages: BaseStage[];
  classId?: string | null;
}) {
  const navigate = useNavigate();
  const { createSession } = useLiveSession();

  const liveable = availableStages.filter((s) => LIVE_STAGES.includes(s));
  const [stages, setStages] = useState<BaseStage[]>(liveable);
  const [settings, setSettings] = useState<LiveSessionSettings>(DEFAULT_LIVE_SETTINGS);
  const [isBusy, setIsBusy] = useState(false);

  const excluded = availableStages.filter((s) => !LIVE_STAGES.includes(s));

  const toggle = (s: BaseStage) =>
    setStages(stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s]);

  const open_ = async () => {
    setIsBusy(true);
    const created = await createSession({ quizId, classId, stages, settings });
    setIsBusy(false);
    if (!created) {
      toast.error("세션을 열지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    onOpenChange(false);
    navigate(`/live/${created.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-destructive" />
            라이브 세션 시작
          </DialogTitle>
          <DialogDescription className="break-keep">
            학생들이 참여 코드로 들어와 다 같이 푸는 실시간 수업이에요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 유형 선택 */}
          <div>
            <p className="font-semibold text-sm text-foreground mb-2">퀴즈 유형</p>
            {liveable.length === 0 ? (
              <p className="text-xs text-muted-foreground break-keep">
                이 퀴즈에는 라이브로 진행할 수 있는 유형이 없어요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {liveable.map((s) => {
                  const on = stages.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-100",
                        on
                          ? "bg-accent border-primary text-accent-foreground"
                          : "bg-card border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full", on ? STAGE_DOT[s] : "bg-border")} />
                      {STAGE_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            )}

            {excluded.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 break-keep">
                {excluded.map((s) => STAGE_LABELS[s]).join(", ")}은 라이브에서 빠집니다. 다 같이
                동시에 녹음하면 소리가 섞이고 AI 채점도 바로 나오지 않아서예요.
              </p>
            )}
          </div>

          {/* 설정 */}
          <div className="border border-border rounded-xl divide-y divide-border">
            {SETTING_ROWS.map((r) => (
              <label
                key={r.key}
                className="p-3 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-keep">{r.desc}</p>
                </div>
                <Switch
                  checked={settings[r.key]}
                  onCheckedChange={(v) => setSettings({ ...settings, [r.key]: v })}
                  className="shrink-0 mt-0.5"
                />
              </label>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full h-11 font-bold gap-2"
            disabled={stages.length === 0 || isBusy}
            onClick={open_}
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            세션 열기
          </Button>
          <p className="text-xs text-muted-foreground text-center -mt-1">
            세션을 열면 참여 코드가 만들어집니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
