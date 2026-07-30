import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GrammarHintButtonProps {
  /** 문법 힌트 문자열. 빈 문자열이면 호출부에서 아예 렌더하지 않는다 */
  hint: string;
  /** 붙어 있는 입력칸과 같은 높이를 받는다. 기본값은 데스크톱 기준 */
  heightClass?: string;
}

/**
 * 빈칸 채우기 문법 힌트 버튼.
 * 힌트를 문장 줄에서 빼내 정답 입력칸 "오른쪽" 버튼으로 두고, 클릭하면 Popover로 보여준다.
 * 학생이 힌트를 "이미 문장에 들어있는 글자"로 오해해 원형만 입력하는 문제를 막기 위함.
 *
 * - 트리거 라벨은 `문법` 한 단어로 고정 — 힌트 길이에 따라 버튼 너비가 달라지지 않으므로
 *   입력칸 시작 위치가 문항마다 들쭉날쭉해지지 않는다.
 * - 입력칸과 좌우로 맞붙여 한 덩어리로 렌더한다(왼쪽 모서리 각짐 `rounded-l-none`).
 *   따로 떨어진 알약이면 각진 입력칸 옆에 뜬 배지처럼 보여 입력칸의 부속으로 안 읽힌다.
 *   맞붙이므로 호출부의 래퍼에서 gap을 없애고 입력칸의 오른쪽 모서리도 각지게 해야 한다.
 *   버튼의 왼쪽 테두리(`border-primary/30`)는 남겨둔다 — 입력칸과 버튼 사이를 가르는
 *   구분선 역할을 한다(입력칸 쪽은 `border-r-0`라 자체 테두리가 없다).
 * - 공개 상태는 Popover가 직접 소유한다(호스트에 revealed/onReveal 상태 없음).
 * - 바깥을 클릭하면 닫히는 것은 의도된 동작이다.
 * - 정답 산출에 필수인 요소라 `tabIndex={-1}`을 붙이지 않는다(같은 행의 듣기/번역 버튼과 다른 점).
 * - 자체 포커스 링이 없다(`focus-visible:outline-none`만). 입력칸+버튼을 감싸는 호출부
 *   래퍼가 `focus-within:ring-*`로 포커스 링을 대신 그린다 — 입력칸에 포커스가 가든 이
 *   버튼에 포커스가 가든 하나의 링이 둘을 함께 감싸야 한 덩어리로 보인다. 이 버튼에도
 *   자체 링을 남기면 탭으로 넘어올 때 두 링이 겹쳐 보인다.
 */
export function GrammarHintButton({ hint, heightClass = "h-10" }: GrammarHintButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex shrink-0 items-center justify-center rounded-l-none rounded-r-xl border border-primary/30 bg-accent px-3 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary/10 focus-visible:outline-none ${heightClass}`}
        >
          문법
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-[16rem] px-3 py-1.5 text-sm font-semibold text-primary">
        {hint}
      </PopoverContent>
    </Popover>
  );
}
