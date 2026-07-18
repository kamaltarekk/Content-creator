"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  createBeliefMapAction,
  updateBeliefMapAction,
  setBeliefMapApprovalStatusAction,
  archiveBeliefMapAction,
} from "@/server/actions/belief.actions";
import type { BeliefMapFieldsInput } from "@/server/domain/strategy-form-schema";

export function useCreateBeliefMap() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; cohortId: string; fields: BeliefMapFieldsInput }) =>
      createBeliefMapAction(input.clientId, input.cohortId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useUpdateBeliefMap() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { beliefMapId: string; fields: BeliefMapFieldsInput }) =>
      updateBeliefMapAction(input.beliefMapId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useSetBeliefApprovalStatus() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { beliefMapId: string; approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW" }) =>
      setBeliefMapApprovalStatusAction(input.beliefMapId, input.approvalStatus),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveBeliefMap() {
  const router = useRouter();
  return useMutation({
    mutationFn: (beliefMapId: string) => archiveBeliefMapAction(beliefMapId),
    onSuccess: () => router.refresh(),
  });
}
