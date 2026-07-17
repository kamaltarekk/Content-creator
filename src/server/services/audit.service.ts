import "server-only";

import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export type LogAuditInput = {
  organizationId: string;
  clientId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

export function logAudit(input: LogAuditInput) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
