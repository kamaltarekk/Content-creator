"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Pencil, Layers, Sparkles } from "lucide-react";

import type { StrategySuggestionView } from "@/types/strategy";
import { listReviewTargetsAction } from "@/server/actions/strategySuggestion.actions";
import { isBulkApprovable } from "@/server/domain/strategy-conflict";
import { STRATEGIC_ENTITY_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { useResolveSuggestion, useBulkApproveSuggestions } from "@/hooks/use-strategy-suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ConfidenceBadge } from "@/components/review/confidence-badge";

const NEEDS_COHORT_TARGET = ["COMMERCIAL_SITUATION", "BUYING_DECISION", "BELIEF_MAP"];
const nativeSelect =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function primaryFieldKey(suggestionType: string): string {
  if (suggestionType === "COHORT") return "name";
  if (suggestionType === "BELIEF_MAP") return "currentBeliefStatement";
  return "title";
}

export function StrategySuggestionQueue({ clientId, suggestions }: { clientId: string; suggestions: StrategySuggestionView[] }) {
  const [activeId, setActiveId] = useState<string | null>(suggestions[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [targetCohortId, setTargetCohortId] = useState("");
  const [targetDecisionId, setTargetDecisionId] = useState("");
  const [targetBeliefId, setTargetBeliefId] = useState("");
  const [targets, setTargets] = useState<{ cohorts: { id: string; name: string }[]; decisions: { id: string; title: string }[]; beliefs: { id: string; currentBeliefStatement: string }[] }>({
    cohorts: [],
    decisions: [],
    beliefs: [],
  });

  const resolve = useResolveSuggestion();
  const bulkApprove = useBulkApproveSuggestions();

  useEffect(() => {
    listReviewTargetsAction(clientId).then(setTargets).catch(() => {});
  }, [clientId]);

  const active = useMemo(() => suggestions.find((s) => s.id === activeId) ?? suggestions[0] ?? null, [suggestions, activeId]);

  const eligibleForBulk = suggestions.filter((s) =>
    isBulkApprovable({
      confidence: s.confidence,
      isDuplicateCandidate: s.isDuplicateCandidate,
      possibleConflictsCount: s.possibleConflicts.length,
      suggestionType: s.suggestionType,
    }),
  );

  function resetTargets() {
    setTargetCohortId("");
    setTargetDecisionId("");
    setTargetBeliefId("");
    setEditing(false);
  }

  function submit(action: Parameters<typeof resolve.mutate>[0]["action"], extra?: Record<string, string>) {
    if (!active) return;
    resolve.mutate(
      {
        suggestionId: active.id,
        clientId,
        action,
        targetCohortId: targetCohortId || undefined,
        targetDecisionId: targetDecisionId || undefined,
        targetEntityType: targetBeliefId ? "BELIEF" : undefined,
        targetEntityId: targetBeliefId || undefined,
        edits: editing ? { [primaryFieldKey(active.suggestionType)]: editValue, title: editValue } : undefined,
        ...extra,
      },
      {
        onSuccess: () => {
          toast.success("Suggestion resolved.");
          resetTargets();
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to resolve suggestion."),
      },
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nothing to review</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          No pending AI strategy suggestions. Generate one from the Overview page, or check back after uploading
          more sources.
        </p>
      </div>
    );
  }

  const needsCohortTarget = active && NEEDS_COHORT_TARGET.includes(active.suggestionType);
  const needsDecisionTarget = active && active.suggestionType === "BUYING_ROLE_PARTICIPANT";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
      {/* LEFT: list + bulk approve */}
      <aside className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending suggestions</p>
          <p className="text-lg font-semibold text-foreground">{suggestions.length}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={bulkApprove.isPending || eligibleForBulk.length === 0}
          onClick={() =>
            bulkApprove.mutate(
              { clientId, suggestionIds: eligibleForBulk.map((s) => s.id) },
              {
                onSuccess: (result) => toast.success(`Approved ${result.approved}; skipped ${result.skipped}.`),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Bulk approve failed."),
              },
            )
          }
        >
          <Layers className="size-4" />
          Bulk-approve safe ({eligibleForBulk.length})
        </Button>
        <p className="px-1 text-xs text-muted-foreground">
          Bulk approval never touches conflicts, duplicates, or low-confidence suggestions.
        </p>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                resetTargets();
              }}
              className={`flex flex-col gap-1 rounded-md p-2 text-left text-xs transition-colors ${s.id === active?.id ? "bg-elevated" : "hover:bg-elevated/50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground">{s.suggestionType.replaceAll("_", " ")}</span>
                {s.isDuplicateCandidate && <Badge variant="warning">duplicate?</Badge>}
              </div>
              <span className="truncate text-muted-foreground">{s.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* CENTER: proposed content */}
      <section className="flex flex-col gap-3">
        {active && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{active.suggestionType.replaceAll("_", " ")}</Badge>
              <ConfidenceBadge confidence={active.confidence} />
            </div>
            <p className="text-sm font-medium text-foreground">{active.title}</p>
            <Separator />
            {editing ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">Edit before approving</label>
                <Textarea rows={4} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(active.proposedFields).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{key}</p>
                    <p className="text-sm whitespace-pre-wrap text-foreground">
                      {Array.isArray(value) ? value.join(", ") : (value ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {active.sourceReferences.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Source references</p>
                <ul className="flex flex-col gap-1">
                  {active.sourceReferences.map((ref, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      [{ref.source_type}] {ref.reference_id} {ref.note ? `— ${ref.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {active.missingEvidence.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Missing evidence</p>
                <ul className="flex flex-col gap-1">
                  {active.missingEvidence.map((m, i) => (
                    <li key={i} className="text-xs text-warning">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* RIGHT: reasoning + conflicts + actions */}
      <aside className="flex flex-col gap-3">
        {active && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground italic">&ldquo;{active.reasoningSummary}&rdquo;</p>

            {active.isDuplicateCandidate && (
              <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
                Possible duplicate
                {active.duplicateOfEntityType ? ` of an existing ${STRATEGIC_ENTITY_TYPE_LABELS[active.duplicateOfEntityType]}` : ""} —
                review carefully before approving.
              </p>
            )}

            {active.possibleConflicts.length > 0 && (
              <div className="flex flex-col gap-1">
                {active.possibleConflicts.map((c, i) => (
                  <p key={i} className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
                    Conflicts with {c.existing_entity_type} {c.existing_entity_id}: {c.reason}
                  </p>
                ))}
              </div>
            )}

            {needsCohortTarget && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Target cohort</label>
                <select className={nativeSelect} value={targetCohortId} onChange={(e) => setTargetCohortId(e.target.value)}>
                  <option value="">Select a cohort</option>
                  {targets.cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {needsDecisionTarget && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Target buying decision</label>
                <select className={nativeSelect} value={targetDecisionId} onChange={(e) => setTargetDecisionId(e.target.value)}>
                  <option value="">Select a decision</option>
                  {targets.decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Separator />

            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={resolve.isPending} onClick={() => submit("EDIT_APPROVE")}>
                  <Check className="size-4" />
                  Save &amp; approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" disabled={resolve.isPending} onClick={() => submit("APPROVE")}>
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => {
                      setEditValue(String(active.proposedFields[primaryFieldKey(active.suggestionType)] ?? active.title));
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit &amp; approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => submit("KEEP_HYPOTHESIS")}>
                    Keep as hypothesis
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={resolve.isPending} onClick={() => submit("REJECT")}>
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {active.isDuplicateCandidate && active.suggestionType === "COHORT" && active.duplicateOfEntityId && (
                    <Button size="sm" variant="ghost" onClick={() => submit("MERGE")}>
                      Merge with existing
                    </Button>
                  )}
                  {needsCohortTarget && (
                    <Button size="sm" variant="ghost" disabled={!targetCohortId} onClick={() => submit("ATTACH_COHORT")}>
                      Attach to cohort as source
                    </Button>
                  )}
                  <div className="flex items-center gap-1">
                    <select className={nativeSelect} value={targetBeliefId} onChange={(e) => setTargetBeliefId(e.target.value)}>
                      <option value="">Attach as evidence to…</option>
                      {targets.beliefs.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.currentBeliefStatement.slice(0, 40)}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" disabled={!targetBeliefId} onClick={() => submit("ATTACH_EVIDENCE")}>
                      Attach
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => submit("MARK_RESEARCH")}>
                    Mark for research
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => submit("DEFER")}>
                    Defer
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
