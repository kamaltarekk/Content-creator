"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  createBuyingDecisionAction,
  updateBuyingDecisionAction,
  setBuyingDecisionApprovalStatusAction,
  archiveBuyingDecisionAction,
  addBuyingRoleParticipantAction,
  removeBuyingRoleParticipantAction,
  addObjectionAction,
  resolveObjectionAction,
  removeObjectionAction,
  addDecisionCriterionAction,
  removeDecisionCriterionAction,
} from "@/server/actions/decision.actions";
import type {
  BuyingDecisionFieldsInput,
  BuyingRoleParticipantFieldsInput,
  ObjectionFieldsInput,
  DecisionCriterionFieldsInput,
} from "@/server/domain/strategy-form-schema";

export function useCreateBuyingDecision() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; cohortId: string; fields: BuyingDecisionFieldsInput }) =>
      createBuyingDecisionAction(input.clientId, input.cohortId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useUpdateBuyingDecision() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { decisionId: string; fields: BuyingDecisionFieldsInput }) =>
      updateBuyingDecisionAction(input.decisionId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useSetDecisionApprovalStatus() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { decisionId: string; approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW" }) =>
      setBuyingDecisionApprovalStatusAction(input.decisionId, input.approvalStatus),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveBuyingDecision() {
  const router = useRouter();
  return useMutation({
    mutationFn: (decisionId: string) => archiveBuyingDecisionAction(decisionId),
    onSuccess: () => router.refresh(),
  });
}

export function useAddBuyingRoleParticipant() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { decisionId: string; fields: BuyingRoleParticipantFieldsInput }) =>
      addBuyingRoleParticipantAction(input.decisionId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveBuyingRoleParticipant() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { participantId: string; decisionId: string }) =>
      removeBuyingRoleParticipantAction(input.participantId, input.decisionId),
    onSuccess: () => router.refresh(),
  });
}

export function useAddObjection() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { decisionId: string; fields: ObjectionFieldsInput }) => addObjectionAction(input.decisionId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useResolveObjection() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { objectionId: string; decisionId: string; resolutionNote: string }) =>
      resolveObjectionAction(input.objectionId, input.decisionId, input.resolutionNote),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveObjection() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { objectionId: string; decisionId: string }) => removeObjectionAction(input.objectionId, input.decisionId),
    onSuccess: () => router.refresh(),
  });
}

export function useAddDecisionCriterion() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { decisionId: string; fields: DecisionCriterionFieldsInput }) =>
      addDecisionCriterionAction(input.decisionId, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveDecisionCriterion() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { criterionId: string; decisionId: string }) =>
      removeDecisionCriterionAction(input.criterionId, input.decisionId),
    onSuccess: () => router.refresh(),
  });
}
