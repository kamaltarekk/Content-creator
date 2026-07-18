"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { BeliefMapFieldsInput } from "@/server/domain/strategy-form-schema";
import { BELIEF_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { listCohortSituationsForBeliefAction } from "@/server/actions/belief.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BeliefFormFields({ form, cohortId }: { form: UseFormReturn<BeliefMapFieldsInput>; cohortId: string }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const [situations, setSituations] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    listCohortSituationsForBeliefAction(cohortId).then(setSituations).catch(() => setSituations([]));
  }, [cohortId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observedSituation">Observed situation</Label>
        <Textarea id="observedSituation" rows={2} placeholder="What actually happened?" {...register("observedSituation")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentInterpretation">Current interpretation</Label>
        <Textarea id="currentInterpretation" rows={2} placeholder="How does the cohort interpret it?" {...register("currentInterpretation")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentBeliefStatement">Current (wrong) belief</Label>
        <Textarea
          id="currentBeliefStatement"
          rows={2}
          placeholder="State the belief precisely — this is what gets reframed."
          {...register("currentBeliefStatement")}
        />
        {errors.currentBeliefStatement && <p className="text-xs text-destructive">{errors.currentBeliefStatement.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="beliefType">Belief type</Label>
        <Select
          value={watch("beliefType") ?? "WRONG"}
          onValueChange={(value) => setValue("beliefType", value as BeliefMapFieldsInput["beliefType"])}
        >
          <SelectTrigger id="beliefType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BELIEF_TYPE_LABELS).map(([value, label]) => (
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
        <Label htmlFor="behaviorCaused">Behavior this belief causes</Label>
        <Textarea id="behaviorCaused" rows={2} {...register("behaviorCaused")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commercialConsequence">Commercial consequence</Label>
        <Textarea id="commercialConsequence" rows={2} {...register("commercialConsequence")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="betterBeliefStatement">Better belief</Label>
        <Textarea
          id="betterBeliefStatement"
          rows={2}
          placeholder="Must be materially different — not a one-word antonym swap."
          {...register("betterBeliefStatement")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="betterCommercialDecision">Better commercial decision</Label>
        <Textarea id="betterCommercialDecision" rows={2} placeholder="A concrete, actionable next step." {...register("betterCommercialDecision")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="relevantOfferPlaceholder">Relevant offer (placeholder)</Label>
        <Input
          id="relevantOfferPlaceholder"
          placeholder="Free text until the Offer + Proof + Claims module exists"
          {...register("relevantOfferPlaceholder")}
        />
      </div>
    </div>
  );
}
