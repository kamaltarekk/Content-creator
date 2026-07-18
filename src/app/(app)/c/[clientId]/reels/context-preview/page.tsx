import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { ContextPreviewForm } from "@/components/reels/context-preview-form";

export default async function ContextPreviewPage({ params }: { params: Promise<{ clientId: string }> }) {
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
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Developer tool</p>
        <h1 className="text-xl font-semibold text-foreground">ScriptGenerationContext preview</h1>
        <p className="text-sm text-muted-foreground">
          Shows exactly what the AI generation layer will receive for a given audience and content objective — raw, for debugging only.
        </p>
      </div>
      <ContextPreviewForm clientId={clientId} cohorts={cohorts} />
    </div>
  );
}
