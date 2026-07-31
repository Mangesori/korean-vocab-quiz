import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function HelpSearchInput({ value, onChange, className }: HelpSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="궁금한 내용을 검색하세요 (예: 초대 코드, 마이크, 짝맞추기)"
        aria-label="도움말 검색"
        className="w-full rounded-xl border border-border bg-card py-3.5 pl-[46px] pr-11 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-[15px] w-[15px]" />
        </button>
      )}
    </div>
  );
}
