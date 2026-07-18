import { requireAction } from "@/server/auth/permissions";
import { startOrResumeGuidedSetup } from "@/server/services/guidedSetup.service";
import { GuidedSetupFlow } from "@/components/guided-setup/guided-setup-flow";

export default async function GuidedSetupPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const session = await requireAction("setup.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const setupSession = await startOrResumeGuidedSetup({
    clientId,
    organizationId: session.user.orgId,
    userId: session.user.id,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guided setup</p>
        <h1 className="text-xl font-semibold text-foreground">Let&apos;s set up this client</h1>
        <p className="text-sm text-muted-foreground">One simple question at a time — answers save automatically.</p>
      </div>
      <GuidedSetupFlow clientId={clientId} sessionId={setupSession.id} />
    </div>
  );
}
