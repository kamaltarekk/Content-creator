"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { StrategicRelationshipType } from "@prisma/client";

import { STRATEGIC_ENTITY_TYPE_LABELS, STRATEGIC_RELATIONSHIP_TYPE_LABELS } from "@/server/domain/strategy-schema";
import type { StrategicEntityView } from "@/types/strategy";
import { useCreateStrategicRelationship } from "@/hooks/use-relationship";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const nativeSelect =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function AddRelationshipDialog({ clientId, entities }: { clientId: string; entities: StrategicEntityView[] }) {
  const [open, setOpen] = useState(false);
  const [fromEntityId, setFromEntityId] = useState("");
  const [toEntityId, setToEntityId] = useState("");
  const [relationshipType, setRelationshipType] = useState<StrategicRelationshipType>("RELEVANT_TO");
  const [note, setNote] = useState("");
  const create = useCreateStrategicRelationship();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add relationship
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add relationship</DialogTitle>
          <DialogDescription>Connects two existing strategy entities. Cross-client relationships are rejected.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fromEntity">From</Label>
            <select id="fromEntity" className={nativeSelect} value={fromEntityId} onChange={(e) => setFromEntityId(e.target.value)}>
              <option value="">Select an entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  [{STRATEGIC_ENTITY_TYPE_LABELS[e.entityType]}] {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relationshipType">Relationship</Label>
            <select
              id="relationshipType"
              className={nativeSelect}
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as StrategicRelationshipType)}
            >
              {Object.entries(STRATEGIC_RELATIONSHIP_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="toEntity">To</Label>
            <select id="toEntity" className={nativeSelect} value={toEntityId} onChange={(e) => setToEntityId(e.target.value)}>
              <option value="">Select an entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  [{STRATEGIC_ENTITY_TYPE_LABELS[e.entityType]}] {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={create.isPending || !fromEntityId || !toEntityId || fromEntityId === toEntityId}
            onClick={() =>
              create.mutate(
                { clientId, fromEntityId, toEntityId, relationshipType, note: note || undefined },
                {
                  onSuccess: () => {
                    toast.success("Relationship added.");
                    setOpen(false);
                    setFromEntityId("");
                    setToEntityId("");
                    setNote("");
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add relationship."),
                },
              )
            }
          >
            {create.isPending ? "Adding…" : "Add relationship"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
