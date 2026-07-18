"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

import { listLinkableBrainItemsAction } from "@/server/actions/cohort.actions";
import { useAddCohortSourceReference } from "@/hooks/use-cohort";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const RELATIONSHIP_OPTIONS = [
  "SUPPORTS",
  "CONTRADICTS",
  "INSPIRED_BY",
  "VALIDATES",
  "WEAK_SIGNAL",
  "STRONG_SIGNAL",
  "CONTEXT_ONLY",
] as const;

type LinkableItem = { id: string; sectionKey: string; fieldKey: string; valueText: string | null; subjectLabel: string | null };

export function AddCohortSourceDialog({ clientId, cohortId }: { clientId: string; cohortId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LinkableItem[]>([]);
  const [clientBrainItemId, setClientBrainItemId] = useState("");
  const [relationshipType, setRelationshipType] = useState<(typeof RELATIONSHIP_OPTIONS)[number]>("SUPPORTS");
  const [note, setNote] = useState("");
  const add = useAddCohortSourceReference();

  useEffect(() => {
    if (open && items.length === 0) {
      listLinkableBrainItemsAction(clientId).then(setItems).catch(() => toast.error("Failed to load Client Brain items."));
    }
  }, [open, clientId, items.length]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="size-4" />
          Link source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a source</DialogTitle>
          <DialogDescription>
            Reference an existing, approved Client Brain item — this never duplicates or overwrites it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brainItem">Client Brain item</Label>
            <select
              id="brainItem"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              value={clientBrainItemId}
              onChange={(e) => setClientBrainItemId(e.target.value)}
            >
              <option value="">Select an item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sectionKey} · {item.subjectLabel ?? item.fieldKey}: {(item.valueText ?? "").slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relationshipType">Relationship</Label>
            <Select value={relationshipType} onValueChange={(v) => setRelationshipType(v as typeof relationshipType)}>
              <SelectTrigger id="relationshipType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.replace(/_/g, " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={add.isPending || !clientBrainItemId}
            onClick={() =>
              add.mutate(
                { cohortId, relationshipType, clientBrainItemId, note: note || undefined },
                {
                  onSuccess: () => {
                    toast.success("Source linked.");
                    setOpen(false);
                    setClientBrainItemId("");
                    setNote("");
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to link source."),
                },
              )
            }
          >
            {add.isPending ? "Linking…" : "Link source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
