import { HelpSearchInput } from "./HelpSearchInput";
import { HelpRoleToggle } from "./HelpRoleToggle";
import type { HelpRole } from "@/data/help";

interface HelpHeroProps {
  draft: string;
  onDraftChange: (value: string) => void;
  role: HelpRole | null;
  onRoleChange: (role: HelpRole) => void;
  roleReady: boolean;
}

export function HelpHero({ draft, onDraftChange, role, onRoleChange, roleReady }: HelpHeroProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="container max-w-3xl py-14 text-center md:py-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          도움말 센터
        </div>
        <h1 className="mb-3.5 text-3xl font-black leading-[1.15] tracking-tight text-foreground break-keep md:text-4xl">
          무엇을 도와드릴까요?
        </h1>
        <p className="mx-auto mb-7 max-w-md text-[17px] leading-relaxed text-muted-foreground break-keep">
          나무 사용법을 선생님과 학생 두 관점으로 정리했어요. 검색하거나 역할을 선택해 둘러보세요.
        </p>

        <div className="mx-auto mb-5 max-w-[520px]">
          <HelpSearchInput value={draft} onChange={onDraftChange} />
        </div>

        <HelpRoleToggle role={role} onChange={onRoleChange} disabled={!roleReady} />
      </div>
    </section>
  );
}
