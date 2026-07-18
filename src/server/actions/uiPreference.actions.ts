"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/permissions";
import { setBrainModePreference } from "@/server/services/uiPreference.service";

export async function setBrainModePreferenceAction(mode: "GUIDED" | "EXPERT", clientId: string) {
  const session = await requireUser();
  await setBrainModePreference(session.user.id, mode);
  revalidatePath(`/c/${clientId}/brain`);
  revalidatePath(`/c/${clientId}/brain/expert`);
  return { ok: true };
}
