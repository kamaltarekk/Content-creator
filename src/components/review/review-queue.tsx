"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Pencil, Layers, FileText, Sparkles } from "lucide-react";
import type { ClientBrainFieldKey, ClientBrainSectionKey, ImportReviewAction } from "@prisma/client";

import {
  SECTION_FIELD_MAP,
  SECTION_LABELS,
  FIELD_LABELS,
  ALL_SECTION_KEYS,
} from "@/server/domain/brain-schema";
import type { ReviewQueueItem } from "@/types/review";
import { useResolveReview, useBulkApproveSafe } from "@/hooks/use-review";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ConfidenceBadge } from "@/components/review/confidence-badge";
import { REVIEW_FILTERS, matchesFilter, type ReviewFilterKey } from "@/components/review/review-filters";

const nativeSelect =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function ReviewQueue({ clientId, items }: { clientId: string; items: ReviewQueueItem[] }) {
  const [filter, setFilter] = useState<ReviewFilterKey>("ALL");
  const [activeId, setActiveId] = useState<string | null>(items[0]?.reviewId ?? null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editSection, setEditSection] = useState<ClientBrainSectionKey | "">("");
  const [editField, setEditField] = useState<ClientBrainFieldKey | "">("");

  const resolve = useResolveReview();
  const bulkApprove = useBulkApproveSafe(clientId);

  const filtered = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter]);
  const activeIndex = Math.max(0, filtered.findIndex((item) => item.reviewId === activeId));
  const active = filtered[activeIndex] ?? filtered[0] ?? null;

  const goTo = useCallback(
    (index: number) => {
      const next = filtered[Math.max(0, Math.min(filtered.length - 1, index))];
      if (next) setActiveId(next.reviewId);
      setEditing(false);
    },
    [filtered],
  );

  const submit = useCallback(
    (action: ImportReviewAction, overrides?: Partial<ReviewQueueItem> & { edit?: boolean }) => {
      if (!active) return;
      const input = {
        reviewId: active.reviewId,
        action,
        ...(overrides?.edit
          ? {
              editedValueText: editValue,
              editedSectionKey: (editSection || active.proposedSectionKey || undefined) as
                | ClientBrainSectionKey
                | undefined,
              editedFieldKey: (editField || active.proposedFieldKey || undefined) as
                | ClientBrainFieldKey
                | undefined,
            }
          : {}),
      };
      resolve.mutate(input, {
        onSuccess: (result) => {
          if (result.openedConflict) {
            toast.warning("This approval opened a conflict. Resolve it from the Client Brain conflicts view.");
          } else {
            toast.success("Item reviewed.");
          }
          goTo(activeIndex);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Review failed."),
      });
    },
    [active, activeIndex, editValue, editSection, editField, resolve, goTo],
  );

  const startEditing = useCallback(() => {
    if (!active) return;
    setEditValue(active.normalizedValueText ?? active.originalText);
    setEditSection(active.proposedSectionKey ?? "");
    setEditField(active.proposedFieldKey ?? "");
    setEditing(true);
  }, [active]);

  // Keyboard shortcuts (ignore while typing in an editable field).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT") return;
      if (!active) return;
      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          goTo(activeIndex + 1);
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          goTo(activeIndex - 1);
          break;
        case "a":
          event.preventDefault();
          submit("APPROVE");
          break;
        case "r":
          event.preventDefault();
          submit("REJECT");
          break;
        case "e":
          event.preventDefault();
          startEditing();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, activeIndex, goTo, submit, startEditing]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nothing to review</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload and process a source to populate the review queue.
        </p>
      </div>
    );
  }

  const total = items.length;
  const remaining = filtered.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
      {/* LEFT: filters + progress + list */}
      <aside className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending across this client</p>
          <p className="text-lg font-semibold text-foreground">{total}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {REVIEW_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setEditing(false);
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  filter === f.key
                    ? "bg-elevated text-foreground"
                    : "text-muted-foreground hover:bg-elevated/60",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={bulkApprove.isPending}
          onClick={() =>
            bulkApprove.mutate(
              filtered.map((item) => item.reviewId),
              {
                onSuccess: (result) =>
                  toast.success(
                    `Approved ${result.approvedCount} safe item(s); skipped ${result.skippedCount}; ${result.conflictCount} opened conflicts.`,
                  ),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Bulk approve failed."),
              },
            )
          }
        >
          <Layers className="size-4" />
          Bulk-approve safe items
        </Button>
        <p className="px-1 text-xs text-muted-foreground">
          Bulk approval never touches conflicts, low-confidence, or duplicate items.
        </p>

        <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
          {filtered.map((item) => (
            <button
              key={item.reviewId}
              onClick={() => {
                setActiveId(item.reviewId);
                setEditing(false);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-md p-2 text-left text-xs transition-colors",
                item.reviewId === active?.reviewId
                  ? "bg-elevated"
                  : "hover:bg-elevated/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground">{item.detectedSection}</span>
                {item.isConflictCandidate && <Badge variant="warning">conflict?</Badge>}
              </div>
              <span className="truncate text-muted-foreground">{item.normalizedValueText ?? item.originalText}</span>
              <span className="text-[10px] text-muted-foreground/70">
                {item.sourceFileName} · {item.sourceLocationLabel}
              </span>
            </button>
          ))}
          {remaining === 0 && <p className="p-2 text-xs text-muted-foreground">No items match this filter.</p>}
        </div>
      </aside>

      {/* CENTER: original content + context */}
      <section className="flex flex-col gap-3">
        {active ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="size-3.5" />
              <span>{active.sourceFileName}</span>
              <span>·</span>
              <span>{active.sourceLocationLabel}</span>
              <span>·</span>
              <Badge variant="outline">{active.blockType}</Badge>
              {active.detectedLanguage && <Badge variant="muted">{active.detectedLanguage}</Badge>}
            </div>
            <Separator />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Original extracted text</p>
              {/* Rendered as plain text — never as HTML from the source document. */}
              <p className="whitespace-pre-wrap text-sm text-foreground">{active.originalText}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Item {activeIndex + 1} of {remaining}
              </span>
              <span className="ml-auto">Shortcuts: J/K move · A approve · R reject · E edit</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No item selected.
          </div>
        )}
      </section>

      {/* RIGHT: proposed classification + actions */}
      <aside className="flex flex-col gap-3">
        {active && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{active.informationType.replaceAll("_", " ")}</Badge>
              <ConfidenceBadge confidence={active.confidence} />
              {active.validationStatus === "INVALID" && <Badge variant="destructive">invalid</Badge>}
            </div>

            {active.reasoningSummary && (
              <p className="text-xs text-muted-foreground italic">“{active.reasoningSummary}”</p>
            )}

            {active.validationNotes && (
              <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">{active.validationNotes}</p>
            )}

            {active.isConflictCandidate && (
              <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
                Possible conflict with existing approved data — approving will open a conflict to resolve.
              </p>
            )}

            <Separator />

            {editing ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">Destination section</label>
                <select
                  className={nativeSelect}
                  value={editSection}
                  onChange={(e) => {
                    setEditSection(e.target.value as ClientBrainSectionKey);
                    setEditField("");
                  }}
                >
                  <option value="">— none —</option>
                  {ALL_SECTION_KEYS.map((section) => (
                    <option key={section} value={section}>
                      {SECTION_LABELS[section]}
                    </option>
                  ))}
                </select>

                <label className="text-xs text-muted-foreground">Field</label>
                <select
                  className={nativeSelect}
                  value={editField}
                  onChange={(e) => setEditField(e.target.value as ClientBrainFieldKey)}
                  disabled={!editSection}
                >
                  <option value="">— none —</option>
                  {(editSection ? SECTION_FIELD_MAP[editSection as ClientBrainSectionKey] : []).map((field) => (
                    <option key={field} value={field}>
                      {FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>

                <label className="text-xs text-muted-foreground">Normalized value</label>
                <Textarea rows={4} value={editValue} onChange={(e) => setEditValue(e.target.value)} />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={resolve.isPending}
                    onClick={() => submit(editSection !== active.proposedSectionKey ? "REMAP" : "APPROVE_WITH_EDIT", { edit: true })}
                  >
                    <Check className="size-4" />
                    Save & approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1 text-sm">
                  <p className="text-xs text-muted-foreground">Proposed destination</p>
                  <p className="text-foreground">
                    {active.proposedSectionKey ? SECTION_LABELS[active.proposedSectionKey] : "Unclassified"}
                    {active.proposedFieldKey ? ` · ${FIELD_LABELS[active.proposedFieldKey]}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <p className="text-xs text-muted-foreground">Suggested normalized value</p>
                  <p className="text-foreground">{active.normalizedValueText ?? "—"}</p>
                </div>
                {active.suggestedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {active.suggestedTags.map((tag) => (
                      <Badge key={tag} variant="muted">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" disabled={resolve.isPending} onClick={() => submit("APPROVE")}>
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={startEditing}>
                    <Pencil className="size-4" />
                    Edit / remap
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => submit("KEEP_AS_RAW")}
                  >
                    Keep as raw
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={resolve.isPending}
                    onClick={() => submit("REJECT")}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => submit("MARK_HYPOTHESIS")}>
                    Mark hypothesis
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => submit("MARK_AUDIENCE_SIGNAL")}>
                    Mark audience signal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => submit("MARK_EVIDENCE")}>
                    Mark evidence
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
