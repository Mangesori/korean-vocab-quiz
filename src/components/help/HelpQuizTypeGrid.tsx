import { STAGE_LABELS, STAGE_ORDER, type BaseStage } from "@/types/quiz";

// 이름·순서는 STAGE_ORDER/STAGE_LABELS(단일 소스)에서 가져온다. 이모지·설명 문구는
// 도움말 전용 카피라 여기서만 관리한다 — 유형이 추가·개명되면 이름은 자동으로 따라가고,
// 새 유형의 이모지·설명만 추가하면 된다.
const STAGE_EMOJI: Record<BaseStage, string> = {
  matchup: "🔗",
  type_answer: "⌨️",
  fill_blank: "🔤",
  word_magnet: "↔️",
  sentence_making: "✏️",
  recording: "🎤",
};

const STAGE_DESCRIPTIONS: Record<BaseStage, string> = {
  matchup: "단어와 뜻을 서로 연결합니다.",
  type_answer: "뜻을 보고 알맞은 단어를 씁니다.",
  fill_blank: "예문의 빈칸에 맞는 단어를 넣습니다.",
  word_magnet: "흩어진 단어를 순서대로 배치합니다.",
  sentence_making: "단어를 활용해 문장을 직접 씁니다.",
  recording: "예문을 따라 말하고 녹음합니다.",
};

export function HelpQuizTypeGrid() {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
      {STAGE_ORDER.map((stage) => (
        <div key={stage} className="rounded-2xl border border-border bg-background px-5 py-[18px]">
          <div className="mb-0.5 text-sm font-bold text-foreground">
            <span className="mr-1.5">{STAGE_EMOJI[stage]}</span>
            {STAGE_LABELS[stage]}
          </div>
          <div className="text-[13px] leading-relaxed text-muted-foreground break-keep">
            {STAGE_DESCRIPTIONS[stage]}
          </div>
        </div>
      ))}
    </div>
  );
}
