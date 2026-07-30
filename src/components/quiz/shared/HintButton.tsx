import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HintButtonProps {
  active: boolean;
  onToggle: () => void;
}

/** 헤더 줄 우측 힌트 토글. 세 유형이 같은 크기·같은 위치를 쓰도록 한 곳에 모았다. */
export function HintButton({ active, onToggle }: HintButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
    >
      <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${active ? "text-warning" : ""}`} />
      힌트
    </Button>
  );
}
