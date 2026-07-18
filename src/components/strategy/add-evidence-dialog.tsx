"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { listLinkableEvidenceItemsAction } from "@/server/actions/evidence.actions";
import { useAddEvidenceLink } from "@/hooks/use-evidence";
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

const STRENGTH_OPTIONS = ["ANECDOTAL", "WEAK", "MODERATE", "STRONG", "VERIFIED", "DISPUTED"] as const;

type LinkableItem = { id: string; sectionKey: string; fieldKey: string; valueText: string | null; subjectLabel: string | null };

export function AddEvidenceDialog({ clientId, beliefMapId }: { clientId: string; beliefMapId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LinkableItem[]>([]);
  const [description, setDescription] = useState("");
  const [evidenceStrength, setEvidenceStrength] = useState<(typeof STRENGTH_OPTIONS)[number]>("WEAK");
  const [clientBrainItemId, setClientBrainItemId] = useState("");
  const add = useAddEvidenceLink();

  useEffect(() => {
    if (open && items.length === 0) {
      listLinkableEvidenceItemsAction(clientId).then(setItems).catch(() => toast.error("Failed to load evidence items."));
    }
  }, [open, clientId, items.length]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add evidence
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>
            Evidence must be real — never invented. Rate its strength honestly; a weak or missing rating is
            expected and useful.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What is the evidence, specifically?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evidenceStrength">Strength</Label>
            <Select value={evidenceStrength} onValueChange={(v) => setEvidenceStrength(v as typeof evidenceStrength)}>
              <SelectTrigger id="evidenceStrength" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRENGTH_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brainItem">Trace to a Client Brain item (optional)</Label>
              <select
                id="brainItem"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                value={clientBrainItemId}
                onChange={(e) => setClientBrainItemId(e.target.value)}
              >
                <option value="">None</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sectionKey} · {item.subjectLabel ?? item.fieldKey}: {(item.valueText ?? "").slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={add.isPending || !description.trim()}
            onClick={() =>
              add.mutate(
                {
                  clientId,
                  target: { targetEntityType: "BELIEF", targetEntityId: beliefMapId, beliefMapId },
                  fields: { description, evidenceStrength, clientBrainItemId: clientBrainItemId || undefined },
                },
                {
                  onSuccess: () => {
                    toast.success("Evidence linked.");
                    setOpen(false);
                    setDescription("");
                    setClientBrainItemId("");
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add evidence."),
                },
              )
            }
          >
            {add.isPending ? "Adding…" : "Add evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
