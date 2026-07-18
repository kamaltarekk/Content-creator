"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { BuyingDecisionFieldsInput } from "@/server/domain/strategy-form-schema";
import { DECISION_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { listCohortSituationsAction } from "@/server/actions/decision.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DecisionFormFields({
  form,
  cohortId,
}: {
  form: UseFormReturn<BuyingDecisionFieldsInput>;
  cohortId: string;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const [situations, setSituations] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    listCohortSituationsAction(cohortId).then(setSituations).catch(() => setSituations([]));
  }, [cohortId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Decision title</Label>
        <Input id="title" placeholder="e.g. Approve a new marketing measurement approach" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="decisionType">Decision type</Label>
        <Select
          value={watch("decisionType")}
          onValueChange={(value) => setValue("decisionType", value as BuyingDecisionFieldsInput["decisionType"], { shouldValidate: true })}
        >
          <SelectTrigger id="decisionType" className="w-full">
            <SelectValue placeholder="Select a decision type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DECISION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {situations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commercialSituationId">Linked situation (optional)</Label>
          <Select
            value={watch("commercialSituationId") || "none"}
            onValueChange={(value) => setValue("commercialSituationId", value === "none" ? "" : value)}
          >
            <SelectTrigger id="commercialSituationId" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {situations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} placeholder="What exactly needs to be decided?" {...register("description")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timeframe">Timeframe</Label>
        <Input id="timeframe" placeholder="e.g. Within this quarter" {...register("timeframe")} />
      </div>
    </div>
  );
}
