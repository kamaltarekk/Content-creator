"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STRATEGY_NAV_ITEMS = [
  { segment: "", label: "Strategy Overview" },
  { segment: "cohorts", label: "Cohorts" },
  { segment: "decisions", label: "Buying Decisions" },
  { segment: "beliefs", label: "Beliefs" },
  { segment: "relationships", label: "Relationships" },
  { segment: "reviews", label: "Suggestion Reviews" },
  { segment: "readiness", label: "Readiness" },
];

/** Sub-nav for the Strategy tool (spec: Cohort + Buying Decision + Belief Intelligence). */
export function StrategyNav({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const basePath = `/c/${clientId}/strategy`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3">
      {STRATEGY_NAV_ITEMS.map((item) => {
        const href = item.segment ? `${basePath}/${item.segment}` : basePath;
        const isActive = item.segment ? pathname.startsWith(href) : pathname === basePath;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-elevated text-foreground"
                : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
