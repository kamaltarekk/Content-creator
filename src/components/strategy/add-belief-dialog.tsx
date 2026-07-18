"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { beliefMapFieldsSchema, type BeliefMapFieldsInput } from "@/server/domain/strategy-form-schema";
import { useCreateBeliefMap } from "@/hooks/use-belief";
import { BeliefFormFields } from "@/components/strategy/belief-form-fields";
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

const DEFAULTS: BeliefMapFieldsInput = {
  observedSituation: "",
  currentInterpretation: "",
  currentBeliefStatement: "",
  beliefType: "WRONG",
  behaviorCaused: "",
  commercialConsequence: "",
  betterBeliefStatement: "",
  betterCommercialDecision: "",
  relevantOfferPlaceholder: "",
  commercialSituationId: "",
};

export function AddBeliefDialog({
  clientId,
  cohortId,
  navigateToDetail = false,
}: {
  clientId: string;
  cohortId: string;
  navigateToDetail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateBeliefMap();
  const form = useForm<BeliefMapFieldsInput>({ resolver: zodResolver(beliefMapFieldsSchema), defaultValues: DEFAULTS });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { clientId, cohortId, fields: values },
      {
        onSuccess: ({ beliefMapId }) => {
          toast.success("Belief map created.");
          setOpen(false);
          form.reset(DEFAULTS);
          if (navigateToDetail) router.push(`/c/${clientId}/strategy/beliefs/${beliefMapId}`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create belief map."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add belief
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New belief map</DialogTitle>
          <DialogDescription>
            The reasoning chain from an observed situation to a better commercial decision. A trivial reframe (e.g.
            a one-word antonym swap) will be flagged, never auto-rewritten.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <BeliefFormFields form={form} cohortId={cohortId} />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create belief map"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
