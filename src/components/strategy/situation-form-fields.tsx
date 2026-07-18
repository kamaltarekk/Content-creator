"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CommercialSituationFieldsInput } from "@/server/domain/strategy-form-schema";
import { TRIGGER_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SituationFormFields({ form }: { form: UseFormReturn<CommercialSituationFieldsInput> }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Situation title</Label>
        <Input id="title" placeholder="e.g. CEO blames marketing after a weak quarter" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="triggerType">Trigger type</Label>
        <Select
          value={watch("triggerType")}
          onValueChange={(value) => setValue("triggerType", value as CommercialSituationFieldsInput["triggerType"], { shouldValidate: true })}
        >
          <SelectTrigger id="triggerType" className="w-full">
            <SelectValue placeholder="Select a trigger type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="triggerDescription">Trigger description</Label>
        <Textarea id="triggerDescription" rows={2} placeholder="What specifically set this off, and when?" {...register("triggerDescription")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activeProblem">Active problem</Label>
        <Textarea id="activeProblem" rows={2} placeholder="The specific, painful problem right now." {...register("activeProblem")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentWorkflow">Current workflow</Label>
        <Textarea id="currentWorkflow" rows={2} placeholder="How are they handling it today?" {...register("currentWorkflow")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="urgencyNote">Urgency</Label>
        <Input id="urgencyNote" placeholder="e.g. Must resolve before next board meeting" {...register("urgencyNote")} />
      </div>
    </div>
  );
}
