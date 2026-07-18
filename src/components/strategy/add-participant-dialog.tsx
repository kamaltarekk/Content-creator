"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { buyingRoleParticipantFieldsSchema, type BuyingRoleParticipantFieldsInput } from "@/server/domain/strategy-form-schema";
import { BUYING_ROLE_LABELS } from "@/server/domain/strategy-schema";
import { useAddBuyingRoleParticipant } from "@/hooks/use-decision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const DEFAULTS: BuyingRoleParticipantFieldsInput = { role: "USER", label: "", influenceScore: 3, stance: "", notes: "" };

export function AddParticipantDialog({ decisionId }: { decisionId: string }) {
  const [open, setOpen] = useState(false);
  const add = useAddBuyingRoleParticipant();
  const form = useForm<BuyingRoleParticipantFieldsInput>({ resolver: zodResolver(buyingRoleParticipantFieldsSchema), defaultValues: DEFAULTS });
  const { register, watch, setValue } = form;

  const onSubmit = form.handleSubmit((values) => {
    add.mutate(
      { decisionId, fields: values },
      {
        onSuccess: () => {
          toast.success("Committee member added.");
          setOpen(false);
          form.reset(DEFAULTS);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add."),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add committee member</DialogTitle>
          <DialogDescription>Always paired with the table below — never visualization-only.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Name / title</Label>
            <Input id="label" placeholder="e.g. CEO" {...register("label")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Buying role</Label>
            <Select value={watch("role")} onValueChange={(v) => setValue("role", v as BuyingRoleParticipantFieldsInput["role"])}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BUYING_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="influenceScore">Influence (1 low – 5 high)</Label>
            <Input
              id="influenceScore"
              type="number"
              min={1}
              max={5}
              {...register("influenceScore", { valueAsNumber: true })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stance">Stance</Label>
            <Input id="stance" placeholder="e.g. supportive, possible blocker" {...register("stance")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
