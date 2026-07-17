"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const CLIENT_NAV_ITEMS = [
  { segment: "", label: "Client Overview" },
  { segment: "sources", label: "Source Library" },
  { segment: "brain", label: "Client Brain" },
  { segment: "reviews", label: "Import Reviews" },
];

export function ClientNav({
  clientId,
  clientName,
  brandType,
}: {
  clientId: string;
  clientName: string;
  brandType: string;
}) {
  const pathname = usePathname();
  const basePath = `/c/${clientId}`;

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-2.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Workspace
        </p>
        <span className="text-muted-foreground">/</span>
        <p className="text-base font-semibold text-foreground">{clientName}</p>
        <Badge variant="outline" className="text-muted-foreground">
          {brandType}
        </Badge>
      </div>
      <nav className="flex gap-1">
        {CLIENT_NAV_ITEMS.map((item) => {
          const href = item.segment ? `${basePath}/${item.segment}` : basePath;
          const isActive = item.segment
            ? pathname.startsWith(href)
            : pathname === basePath;
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
    </div>
  );
}
