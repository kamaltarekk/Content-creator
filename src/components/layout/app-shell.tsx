import Link from "next/link";

import { GlobalNav } from "@/components/layout/global-nav";
import { UserMenu } from "@/components/layout/user-menu";

export function AppShell({
  orgName,
  userName,
  userEmail,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface py-4">
        <Link href="/overview" className="px-6 pb-5">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Commercial <span className="text-lime">Attention OS</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{orgName}</p>
        </Link>
        <GlobalNav />
        <div className="mt-auto px-3 pt-4">
          <UserMenu name={userName} email={userEmail} />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
