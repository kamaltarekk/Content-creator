"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { createClientAction, updateClientAction, archiveClientAction } from "@/server/actions/client.actions";
import type { ClientFormValues } from "@/server/domain/client-schema";

export function useCreateClient() {
  return useMutation({
    mutationFn: (input: ClientFormValues) => createClientAction(input),
  });
}

export function useUpdateClient(clientId: string) {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: Omit<ClientFormValues, "name">) => updateClientAction(clientId, input),
    onSuccess: () => router.refresh(),
  });
}

export function useArchiveClient() {
  const router = useRouter();
  return useMutation({
    mutationFn: (clientId: string) => archiveClientAction(clientId),
    onSuccess: () => router.refresh(),
  });
}
