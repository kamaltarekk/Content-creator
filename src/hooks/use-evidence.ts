"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { StrategicEntityType } from "@prisma/client";

import { addEvidenceLinkAction, removeEvidenceLinkAction } from "@/server/actions/evidence.actions";
import type { EvidenceLinkFieldsInput } from "@/server/domain/strategy-form-schema";

export function useAddEvidenceLink() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      target: { targetEntityType: StrategicEntityType; targetEntityId: string; beliefMapId?: string };
      fields: EvidenceLinkFieldsInput;
    }) => addEvidenceLinkAction(input.clientId, input.target, input.fields),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveEvidenceLink() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { evidenceLinkId: string; clientId: string; beliefMapId?: string }) =>
      removeEvidenceLinkAction(input.evidenceLinkId, input.clientId, input.beliefMapId),
    onSuccess: () => router.refresh(),
  });
}
