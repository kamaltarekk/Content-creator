"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { buyingDecisionFieldsSchema, type BuyingDecisionFieldsInput } from "@/server/domain/strategy-form-schema";
import { useCreateBuyingDecision } from "@/hooks/use-decision";
import { DecisionFormFields } from "@/components/strategy/decision-form-fields";
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

const DEFAULTS: BuyingDecisionFieldsInput = {
  title: "",
  decisionType: "PROBLEM_RECOGNITION",
  description: "",
  timeframe: "",
  commercialSituationId: "",
};

export function AddDecisionDialog({
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
  const create = useCreateBuyingDecision();
  const form = useForm<BuyingDecisionFieldsInput>({ resolver: zodResolver(buyingDecisionFieldsSchema), defaultValues: DEFAULTS });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { clientId, cohortId, fields: values },
      {
        onSuccess: ({ decisionId }) => {
          toast.success("Buying decision added.");
          setOpen(false);
          form.reset(DEFAULTS);
          if (navigateToDetail) router.push(`/c/${clientId}/strategy/decisions/${decisionId}`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add decision."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add decision
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add buying decision</DialogTitle>
          <DialogDescription>The exact decision this cohort needs to make.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DecisionFormFields form={form} cohortId={cohortId} />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add decision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
