import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, AlertTriangle, HelpCircle, XCircle } from "lucide-react";

import { requireClientAccess } from "@/server/auth/permissions";
import { getGuidedBrainOverview, type BrainReadinessStatus } from "@/server/services/guidedBrainOverview.service";
import { getBrainModePreference } from "@/server/services/uiPreference.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainModeToggle } from "@/components/brain/brain-mode-toggle";

const STATUS_BADGE: Record<BrainReadinessStatus, { variant: "success" | "warning" | "outline" | "destructive"; icon: typeof CheckCircle2 }> = {
  READY: { variant: "success", icon: CheckCircle2 },
  NEEDS_REVIEW: { variant: "warning", icon: HelpCircle },
  MISSING: { variant: "outline", icon: AlertTriangle },
  CONFLICT: { variant: "destructive", icon: XCircle },
};

export default async function ClientBrainGuidedPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const session = await requireClientAccess(clientId);

  const preference = await getBrainModePreference(session.user.id);
  if (preference === "EXPERT") redirect(`/c/${clientId}/brain/expert`);

  const overview = await getGuidedBrainOverview(clientId);
  const { variant, icon: StatusIcon } = STATUS_BADGE[overview.status];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Client Brain</p>
          <h1 className="text-2xl font-semibold text-foreground">What we know about {overview.clientName}</h1>
        </div>
        <BrainModeToggle clientId={clientId} mode="GUIDED" />
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 pt-1">
          <Badge variant={variant} className="mt-0.5 gap-1.5 px-3 py-1 text-sm">
            <StatusIcon className="size-3.5" />
            {overview.statusLabel}
          </Badge>
          <p className="text-sm text-muted-foreground">{overview.statusDescription}</p>
        </CardContent>
      </Card>

      <Card className="border-lime/30 bg-lime/[0.04]">
        <CardHeader>
          <CardTitle className="text-sm">Next best action</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="font-medium text-foreground">{overview.nextBestAction.title}</p>
            <p className="text-sm text-muted-foreground">{overview.nextBestAction.description}</p>
          </div>
          <Button asChild className="w-fit">
            <Link href={overview.nextBestAction.href}>
              {overview.nextBestAction.actionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What we understand</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.whatWeUnderstand.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-sm text-foreground">
                {overview.whatWeUnderstand.map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-lime" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nothing confirmed yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What we still need</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.whatWeStillNeed.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-sm text-foreground">
                {overview.whatWeStillNeed.map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5 text-warning" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nothing missing.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Link href={`/c/${clientId}/brain/expert`} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
        See all Client Brain details (Expert Mode)
      </Link>
    </div>
  );
}
