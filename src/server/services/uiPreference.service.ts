import "server-only";

import type { BrainModePreference } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export async function getBrainModePreference(userId: string): Promise<BrainModePreference> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { brainModePreference: true } });
  return user.brainModePreference;
}

export async function setBrainModePreference(userId: string, mode: BrainModePreference): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { brainModePreference: mode } });
}
