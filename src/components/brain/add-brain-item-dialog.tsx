"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

import { SECTION_FIELD_MAP, FIELD_LABELS, SECTION_LABELS, ENTITY_SECTIONS } from "@/server/domain/brain-schema";
import { useCreateBrainItem } from "@/hooks/use-brain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function AddBrainItemDialog({
  clientId,
  sectionKey,
}: {
  clientId: string;
  sectionKey: ClientBrainSectionKey;
}) {
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState<ClientBrainFieldKey | "">("");
  const [valueText, setValueText] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const create = useCreateBrainItem();

  const isEntitySection = ENTITY_SECTIONS.includes(sectionKey);

  function reset() {
    setFieldKey("");
    setValueText("");
    setSubjectLabel("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add manually
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {SECTION_LABELS[sectionKey]}</DialogTitle>
          <DialogDescription>
            Manually added items are marked approved with full confidence and are versioned like any other.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field">Field</Label>
            <select
              id="field"
              className={nativeSelect}
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value as ClientBrainFieldKey)}
            >
              <option value="">Select a field</option>
              {SECTION_FIELD_MAP[sectionKey].map((field) => (
                <option key={field} value={field}>
                  {FIELD_LABELS[field]}
                </option>
              ))}
            </select>
          </div>

          {isEntitySection && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject">Entity label (optional)</Label>
              <Input
                id="subject"
                placeholder="e.g. the cohort or offer this belongs to"
                value={subjectLabel}
                onChange={(e) => setSubjectLabel(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Value</Label>
            <Textarea id="value" rows={3} value={valueText} onChange={(e) => setValueText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={create.isPending || !fieldKey || !valueText.trim()}
            onClick={() =>
              create.mutate(
                {
                  clientId,
                  sectionKey,
                  fieldKey: fieldKey as ClientBrainFieldKey,
                  valueText,
                  subjectLabel: subjectLabel || undefined,
                },
                {
                  onSuccess: () => {
                    toast.success("Added to the Client Brain.");
                    setOpen(false);
                    reset();
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add."),
                },
              )
            }
          >
            {create.isPending ? "Adding…" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
