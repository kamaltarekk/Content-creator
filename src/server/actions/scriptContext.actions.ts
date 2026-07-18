"use server";

import { requireAction } from "@/server/auth/permissions";
import { compileScriptContext } from "@/server/services/scriptContextCompiler.service";
import type { ContentObjective, ReelPlatform } from "@prisma/client";

export async function compileScriptContextPreviewAction(input: {
  clientId: string;
  cohortId: string;
  contentObjective: ContentObjective;
  platform: ReelPlatform;
}) {
  await requireAction("reel.generate", { clientId: input.clientId });
  return compileScriptContext(input);
}
