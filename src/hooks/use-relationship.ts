"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { StrategicRelationshipType } from "@prisma/client";

import { createStrategicRelationshipAction, removeStrategicRelationshipAction } from "@/server/actions/relationship.actions";

export function useCreateStrategicRelationship() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      fromEntityId: string;
      toEntityId: string;
      relationshipType: StrategicRelationshipType;
      note?: string;
    }) => createStrategicRelationshipAction(input.clientId, input),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveStrategicRelationship() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { relationshipId: string; clientId: string }) =>
      removeStrategicRelationshipAction(input.relationshipId, input.clientId),
    onSuccess: () => router.refresh(),
  });
}
