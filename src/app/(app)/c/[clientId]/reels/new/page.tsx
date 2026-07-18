import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { CreateFirstReelWizard } from "@/components/reels/create-first-reel-wizard";

export default async function CreateFirstReelPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("reel.generate", { clientId });

  const cohorts = await prisma.cohort.findMany({
    where: { clientId, approvalStatus: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Create a Reel</p>
        <h1 className="text-xl font-semibold text-foreground">Let&apos;s create a Reel</h1>
        <p className="text-sm text-muted-foreground">A few quick choices — everything else is compiled automatically from what you already know.</p>
      </div>
      <CreateFirstReelWizard clientId={clientId} cohorts={cohorts} />
    </div>
  );
}
