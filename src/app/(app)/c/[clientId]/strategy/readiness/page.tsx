import {
  getStrategyReadinessForClient,
  getPerCohortReadiness,
  getSpecificFollowUpQuestions,
  listReadinessSnapshots,
} from "@/server/services/strategyReadiness.service";
import { READINESS_CATEGORY_LABELS } from "@/server/domain/strategy-schema";
import { requireAction } from "@/server/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { StrategyReadinessPanel } from "@/components/strategy/strategy-readiness-panel";
import { GenerateSnapshotButton } from "@/components/strategy/generate-snapshot-button";

export default async function ReadinessPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("strategy.view", { clientId });

  const [readiness, perCohort, specificQuestions, snapshots] = await Promise.all([
    getStrategyReadinessForClient(clientId),
    getPerCohortReadiness(clientId),
    getSpecificFollowUpQuestions(clientId),
    listReadinessSnapshots(clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Readiness</p>
          <h1 className="text-2xl font-semibold text-foreground">Strategy Setup Readiness</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            How much of the commercial reasoning chain is filled in — a setup indicator, never a prediction of
            business success.
          </p>
        </div>
        <GenerateSnapshotButton clientId={clientId} />
      </div>

      <StrategyReadinessPanel readiness={readiness} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Per-cohort breakdown</p>
        {perCohort.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohorts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {perCohort.map((c) => (
              <div key={c.cohortId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="text-sm text-foreground">{c.cohortName}</span>
                {c.missingCategories.length === 0 ? (
                  <Badge variant="success">Complete</Badge>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {c.missingCategories.map((cat) => (
                      <Badge key={cat} variant="warning">
                        {READINESS_CATEGORY_LABELS[cat]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {specificQuestions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Specific follow-up questions</p>
          <ul className="flex flex-col gap-1.5">
            {specificQuestions.slice(0, 20).map((q, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {q.question}
              </li>
            ))}
          </ul>
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Snapshot history</p>
          <ul className="flex flex-col gap-1.5">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{s.overallScore}%</span>
                <span className="text-xs text-muted-foreground">{new Date(s.generatedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
