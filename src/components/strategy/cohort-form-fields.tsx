"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CohortFieldsInput } from "@/server/domain/strategy-form-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

/** A cohort is not a fictional persona — every field here grounds it in a real, evidence-backed commercial situation. */
export function CohortFormFields({ form }: { form: UseFormReturn<CohortFieldsInput> }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Cohort name</Label>
        <Input id="name" placeholder="e.g. Marketing managers blamed for weak sales conversion" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        <p className="text-xs text-muted-foreground">
          Name the situation, not the demographic — avoid labels like &quot;Women 25–45&quot;.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="definition">Grounded definition</Label>
        <Textarea
          id="definition"
          rows={3}
          placeholder="Who exactly is this, and what real commercial situation are they in?"
          {...register("definition")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Role</Label>
          <Input id="role" placeholder="e.g. Marketing Manager" {...register("role")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={watch("priority") ?? "MEDIUM"}
            onValueChange={(value) => setValue("priority", value as CohortFieldsInput["priority"], { shouldValidate: true })}
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commercialContext">Commercial context</Label>
        <Textarea id="commercialContext" rows={2} placeholder="Why does this cohort matter commercially right now?" {...register("commercialContext")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentWorkflow">Current workflow</Label>
        <Textarea id="currentWorkflow" rows={2} placeholder="What do they actually do today?" {...register("currentWorkflow")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentBelief">Current belief</Label>
        <Textarea id="currentBelief" rows={2} placeholder="What do they currently think is true (even if wrong)?" {...register("currentBelief")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desiredOutcome">Desired outcome</Label>
        <Textarea id="desiredOutcome" rows={2} placeholder="What do they actually want to achieve?" {...register("desiredOutcome")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="decisionRisk">Decision risk</Label>
        <Textarea id="decisionRisk" rows={2} placeholder="What could stop them from acting?" {...register("decisionRisk")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attentionNotes">Content &amp; attention notes</Label>
        <Textarea
          id="attentionNotes"
          rows={2}
          placeholder="Where do they pay attention, and what content earns it?"
          {...register("attentionNotes")}
        />
      </div>
    </div>
  );
}
