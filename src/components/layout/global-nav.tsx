"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Users, Settings, Search } from "lucide-react";

import { cn } from "@/lib/utils";

const GLOBAL_NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {GLOBAL_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-elevated text-foreground"
                : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
