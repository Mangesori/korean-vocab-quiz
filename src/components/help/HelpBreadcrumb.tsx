import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { HelpRole } from "@/data/help";

interface HelpBreadcrumbProps {
  role: HelpRole;
  categoryLabel: string;
  title: string;
}

export function HelpBreadcrumb({ role, categoryLabel, title }: HelpBreadcrumbProps) {
  const roleLabel = role === "teacher" ? "선생님" : "학생";

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={`/help?role=${role}`}>도움말</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="inline-flex items-center gap-1.5 break-keep">
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
              {roleLabel}
            </span>
            <span>· {categoryLabel}</span>
          </span>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="break-keep">{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
