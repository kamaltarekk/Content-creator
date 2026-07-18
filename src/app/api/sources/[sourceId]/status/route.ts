import { NextResponse } from "next/server";

import { AuthorizationError, UnauthenticatedError, requireClientAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { ensureJobRunnerStarted } from "@/server/jobs/local.job.runner";

export async function GET(_request: Request, context: { params: Promise<{ sourceId: string }> }) {
  // A fresh server process (e.g. after restart) may have pending jobs waiting;
  // polling the status is a good moment to make sure the worker is running.
  ensureJobRunnerStarted();

  const { sourceId } = await context.params;

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      clientId: true,
      processingStatus: true,
      requiresMultimodal: true,
      _count: { select: { blocks: true, extractedItems: true } },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  try {
    await requireClientAccess(source.clientId);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({
    processingStatus: source.processingStatus,
    requiresMultimodal: source.requiresMultimodal,
    blockCount: source._count.blocks,
    extractedItemCount: source._count.extractedItems,
  });
}
