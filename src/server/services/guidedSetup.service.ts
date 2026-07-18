import "server-only";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { SECTION_ORDER } from "@/server/services/guidedQuestion.service";

/** Starts a new Guided Setup session, or resumes the client's existing in-progress one. */
export async function startOrResumeGuidedSetup(params: {
  clientId: string;
  organizationId: string;
  userId: string;
  entryMode?: "FULL_GUIDED" | "FAST_IMPORT";
}) {
  const existing = await prisma.guidedSetupSession.findFirst({
    where: { clientId: params.clientId, userId: params.userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;

  const session = await prisma.guidedSetupSession.create({
    data: {
      clientId: params.clientId,
      userId: params.userId,
      entryMode: params.entryMode ?? "FULL_GUIDED",
      status: "IN_PROGRESS",
      currentSection: SECTION_ORDER[0],
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.userId,
    action: "CREATE",
    entityType: "GuidedSetupSession",
    entityId: session.id,
  });

  return session;
}

export function getSession(sessionId: string) {
  return prisma.guidedSetupSession.findUnique({ where: { id: sessionId } });
}

export async function updateSessionPosition(params: { sessionId: string; section: string | null; questionKey: string | null }) {
  return prisma.guidedSetupSession.update({
    where: { id: params.sessionId },
    data: { currentSection: params.section as never, currentQuestionKey: params.questionKey },
  });
}

export async function completeGuidedSetup(params: { sessionId: string; organizationId: string; clientId: string; userId: string }) {
  const session = await prisma.guidedSetupSession.update({
    where: { id: params.sessionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.userId,
    action: "UPDATE",
    entityType: "GuidedSetupSession",
    entityId: session.id,
    metadata: { completed: true },
  });

  return session;
}
