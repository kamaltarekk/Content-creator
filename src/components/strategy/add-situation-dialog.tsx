"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { commercialSituationFieldsSchema, type CommercialSituationFieldsInput } from "@/server/domain/strategy-form-schema";
import { useCreateCommercialSituation } from "@/hooks/use-situation";
import { SituationFormFields } from "@/components/strategy/situation-form-fields";
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

const DEFAULTS: CommercialSituationFieldsInput = {
  title: "",
  triggerType: "EVENT",
  triggerDescription: "",
  activeProblem: "",
  currentWorkflow: "",
  urgencyNote: "",
};

export function AddSituationDialog({ clientId, cohortId }: { clientId: string; cohortId: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateCommercialSituation();
  const form = useForm<CommercialSituationFieldsInput>({ resolver: zodResolver(commercialSituationFieldsSchema), defaultValues: DEFAULTS });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { clientId, cohortId, fields: values },
      {
        onSuccess: () => {
          toast.success("Commercial situation added.");
          setOpen(false);
          form.reset(DEFAULTS);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add situation."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add situation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add commercial situation</DialogTitle>
          <DialogDescription>The trigger that pushes this cohort to act right now.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <SituationFormFields form={form} />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add situation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
