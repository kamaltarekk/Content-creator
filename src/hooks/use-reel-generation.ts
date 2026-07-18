"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  previewStrategicDirectionAction,
  createFirstReelAction,
  changeSelectedHookAction,
  editReelScriptAction,
  regenerateReelAction,
} from "@/server/actions/reelGeneration.actions";

export function usePreviewStrategicDirection() {
  return useMutation({ mutationFn: previewStrategicDirectionAction });
}

export function useCreateFirstReel() {
  return useMutation({ mutationFn: createFirstReelAction });
}

export function useChangeSelectedHook() {
  const router = useRouter();
  return useMutation({ mutationFn: changeSelectedHookAction, onSuccess: () => router.refresh() });
}

export function useEditReelScript() {
  const router = useRouter();
  return useMutation({ mutationFn: editReelScriptAction, onSuccess: () => router.refresh() });
}

export function useRegenerateReel() {
  const router = useRouter();
  return useMutation({ mutationFn: regenerateReelAction, onSuccess: () => router.refresh() });
}
