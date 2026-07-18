"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  createCommercialSituationAction,
  setCommercialSituationApprovalStatusAction,
  archiveCommercialSituationAction,
} from "@/server/actions/situation.actions";
import type { CommercialSituationFieldsInput } from "@/server/domain/strategy-form-schema";

export function useCreateCommercialSituation() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; cohortId: string; fields: CommercialSituationFieldsInput }) =>
      createCommercialSituationAction(input.clientId, input.cohortId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useSetSituationApprovalStatus() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { situationId: string; approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW" }) =>
      setCommercialSituationApprovalStatusAction(input.situationId, input.approvalStatus),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveCommercialSituation() {
  const router = useRouter();
  return useMutation({
    mutationFn: (situationId: string) => archiveCommercialSituationAction(situationId),
    onSuccess: () => router.refresh(),
  });
}
