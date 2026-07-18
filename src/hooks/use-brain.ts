"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

import {
  createBrainItemAction,
  editBrainItemAction,
  archiveBrainItemAction,
} from "@/server/actions/brain.actions";

export function useCreateBrainItem() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      sectionKey: ClientBrainSectionKey;
      fieldKey: ClientBrainFieldKey;
      valueText: string;
      subjectLabel?: string;
    }) => createBrainItemAction(input),
    onSuccess: () => router.refresh(),
  });
}

export function useEditBrainItem() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { itemId: string; valueText: string }) =>
      editBrainItemAction(input.itemId, input.valueText),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveBrainItem() {
  const router = useRouter();
  return useMutation({
    mutationFn: (itemId: string) => archiveBrainItemAction(itemId),
    onSuccess: () => router.refresh(),
  });
}
