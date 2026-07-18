"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { cohortFieldsSchema, type CohortFieldsInput } from "@/server/domain/strategy-form-schema";
import type { CohortDetailView } from "@/types/strategy";
import { useUpdateCohort } from "@/hooks/use-cohort";
import { CohortFormFields } from "@/components/strategy/cohort-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EditCohortDialog({ cohort }: { cohort: CohortDetailView }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateCohort();

  const form = useForm<CohortFieldsInput>({
    resolver: zodResolver(cohortFieldsSchema),
    defaultValues: {
      name: cohort.name,
      definition: cohort.definition ?? "",
      priority: cohort.priority,
      role: cohort.role ?? "",
      commercialContext: cohort.commercialContext ?? "",
      currentWorkflow: cohort.currentWorkflow ?? "",
      currentBelief: cohort.currentBelief ?? "",
      desiredOutcome: cohort.desiredOutcome ?? "",
      decisionRisk: cohort.decisionRisk ?? "",
      attentionNotes: cohort.attentionNotes ?? "",
      emotionalDrivers: cohort.emotionalDrivers,
      platformPresence: cohort.platformPresence,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    update.mutate(
      { cohortId: cohort.id, fields: values },
      {
        onSuccess: () => {
          toast.success("Cohort updated — a new version was recorded.");
          setOpen(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update cohort."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit cohort</DialogTitle>
          <DialogDescription>Saving records a new version — prior versions are never lost.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <CohortFormFields form={form} />
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
