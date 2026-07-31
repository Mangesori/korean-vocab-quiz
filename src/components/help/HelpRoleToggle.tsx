import { Backpack, GraduationCap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HelpRole } from "@/data/help";

interface HelpRoleToggleProps {
  role: HelpRole | null;
  onChange: (role: HelpRole) => void;
  disabled?: boolean;
}

const OPTIONS: { value: HelpRole; label: string; icon: LucideIcon }[] = [
  { value: "teacher", label: "선생님용", icon: GraduationCap },
  { value: "student", label: "학생용", icon: Backpack },
];

export function HelpRoleToggle({ role, onChange, disabled }: HelpRoleToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = role === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
