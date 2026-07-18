"use server";

import { revalidatePath } from "next/cache";

import { requireAction } from "@/server/auth/permissions";
import { createReadinessSnapshot } from "@/server/services/strategyReadiness.service";

export async function generateReadinessSnapshotAction(clientId: string) {
  const session = await requireAction("strategy.view", { clientId });

  const snapshot = await createReadinessSnapshot({ clientId, generatedById: session.user.id });

  revalidatePath(`/c/${clientId}/strategy/readiness`);
  return { snapshotId: snapshot.id };
}
