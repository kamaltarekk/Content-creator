import { BUYING_ROLE_LABELS } from "@/server/domain/strategy-schema";
import type { BuyingRoleParticipantView } from "@/types/strategy";

/**
 * A lightweight, self-contained visual map of the buying committee — no
 * external graph library. Participants are placed along an influence axis
 * (1 = low, 5 = high) so blockers/decision-makers stand out at a glance.
 * Always paired with an accessible table (BuyingCommitteeTable) — this view
 * is never the only way to read or edit the committee.
 */
export function BuyingCommitteeVisual({ participants }: { participants: BuyingRoleParticipantView[] }) {
  if (participants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No committee members mapped yet.
      </p>
    );
  }

  const columns = [1, 2, 3, 4, 5].map((score) => ({
    score,
    members: participants.filter((p) => (p.influenceScore ?? 3) === score),
  }));

  return (
    <div aria-hidden="true" className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-end justify-between gap-2">
        {columns.map((column) => (
          <div key={column.score} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex min-h-24 w-full flex-col-reverse items-center justify-start gap-1.5">
              {column.members.map((member) => (
                <div
                  key={member.id}
                  className="w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-center"
                  title={`${member.label} — ${BUYING_ROLE_LABELS[member.role]}`}
                >
                  <p className="truncate text-xs font-medium text-foreground">{member.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{BUYING_ROLE_LABELS[member.role]}</p>
                </div>
              ))}
            </div>
            <div className="h-1 w-full rounded-full bg-muted" />
            <span className="text-[10px] text-muted-foreground">{column.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>Low influence</span>
        <span>High influence</span>
      </div>
    </div>
  );
}

export function stanceVariant(stance: string | null): "destructive" | "success" | "muted" {
  if (!stance) return "muted";
  const lower = stance.toLowerCase();
  if (lower.includes("block")) return "destructive";
  if (lower.includes("support") || lower.includes("champion")) return "success";
  return "muted";
}
