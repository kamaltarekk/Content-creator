"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  createCohortAction,
  updateCohortAction,
  setCohortApprovalStatusAction,
  archiveCohortAction,
  mergeCohortsAction,
  addCohortSourceReferenceAction,
} from "@/server/actions/cohort.actions";
import type { CohortFieldsInput } from "@/server/domain/strategy-form-schema";

export function useCreateCohort() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; fields: CohortFieldsInput }) =>
      createCohortAction(input.clientId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useUpdateCohort() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { cohortId: string; fields: CohortFieldsInput }) =>
      updateCohortAction(input.cohortId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useSetCohortApprovalStatus() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      cohortId: string;
      approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW";
    }) => setCohortApprovalStatusAction(input.cohortId, input.approvalStatus),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveCohort() {
  const router = useRouter();
  return useMutation({
    mutationFn: (cohortId: string) => archiveCohortAction(cohortId),
    onSuccess: () => router.refresh(),
  });
}

export function useMergeCohorts() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { primaryCohortId: string; duplicateCohortId: string }) =>
      mergeCohortsAction(input.primaryCohortId, input.duplicateCohortId),
    onSuccess: () => router.refresh(),
  });
}

export function useAddCohortSourceReference() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      cohortId: string;
      relationshipType: Parameters<typeof addCohortSourceReferenceAction>[1]["relationshipType"];
      clientBrainItemId?: string;
      note?: string;
      audienceSignalNote?: string;
    }) => addCohortSourceReferenceAction(input.cohortId, input),
    onSuccess: () => router.refresh(),
  });
}
