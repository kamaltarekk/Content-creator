"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { cohortFieldsSchema, type CohortFieldsInput } from "@/server/domain/strategy-form-schema";
import { useCreateCohort } from "@/hooks/use-cohort";
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

const DEFAULTS: CohortFieldsInput = {
  name: "",
  definition: "",
  priority: "MEDIUM",
  role: "",
  commercialContext: "",
  currentWorkflow: "",
  currentBelief: "",
  desiredOutcome: "",
  decisionRisk: "",
  attentionNotes: "",
};

export function CreateCohortDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateCohort();

  const form = useForm<CohortFieldsInput>({ resolver: zodResolver(cohortFieldsSchema), defaultValues: DEFAULTS });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { clientId, fields: values },
      {
        onSuccess: ({ cohortId }) => {
          toast.success("Cohort created as a draft.");
          setOpen(false);
          form.reset(DEFAULTS);
          router.push(`/c/${clientId}/strategy/cohorts/${cohortId}`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create cohort."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New cohort
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New cohort</DialogTitle>
          <DialogDescription>
            Created as a draft — not a fictional persona. It must be grounded in a real commercial situation before
            it can be approved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <CohortFormFields form={form} />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create cohort"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
