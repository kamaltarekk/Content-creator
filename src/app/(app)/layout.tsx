import { requireUser } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  const organization = session.user.orgId
    ? await prisma.organization.findUnique({ where: { id: session.user.orgId } })
    : null;

  return (
    <AppShell
      orgName={organization?.name ?? "No organization"}
      userName={session.user.name ?? "Unknown"}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
