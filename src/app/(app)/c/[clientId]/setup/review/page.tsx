import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { getSetupSummary } from "@/server/services/guidedAnswer.service";
import { SetupReviewActions } from "@/components/guided-setup/setup-review-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUMMARY_ROWS: { key: keyof Awaited<ReturnType<typeof getSetupSummary>>; label: string }[] = [
  { key: "audience", label: "Audience" },
  { key: "whatIsHappening", label: "What is happening" },
  { key: "beliefToChallenge", label: "Belief to challenge" },
  { key: "betterUnderstanding", label: "Better understanding" },
  { key: "betterDecision", label: "Better decision" },
  { key: "offerName", label: "Offer" },
  { key: "voice", label: "Voice" },
  { key: "ctaRoute", label: "Call to action" },
];

export default async function GuidedSetupReviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("setup.view", { clientId });

  const [summary, latestSession] = await Promise.all([
    getSetupSummary(clientId),
    prisma.guidedSetupSession.findFirst({ where: { clientId }, orderBy: { startedAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guided setup</p>
        <h1 className="text-xl font-semibold text-foreground">Here&apos;s what we understand about {summary.clientName}</h1>
        <p className="text-sm text-muted-foreground">Review this before we create the first Reel. Anything missing can be added later.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-1">
          {SUMMARY_ROWS.map(({ key, label }) => {
            const value = summary[key];
            if (typeof value !== "string" && value !== null) return null;
            return (
              <div key={label} className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
                <span className="text-sm text-foreground">{value ?? <span className="text-muted-foreground italic">Not set yet</span>}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {summary.allAnswers.length > 0 && (
        <details className="rounded-lg border border-border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">See all answers ({summary.allAnswers.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
            {summary.allAnswers.map((answer, i) => (
              <div key={`${answer.section}-${i}`} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{answer.label}</span>
                <span className="text-sm text-foreground">{answer.value}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Is this correct?</CardTitle>
        </CardHeader>
        <CardContent>
          <SetupReviewActions clientId={clientId} sessionId={latestSession?.id ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
