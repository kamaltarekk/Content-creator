import "server-only";

import { prisma } from "@/server/db/prisma";

export type OrgDashboard = {
  activeClients: number;
  filesAwaitingProcessing: number;
  reviewsAwaitingApproval: number;
  openConflicts: number;
  recentClients: { id: string; displayName: string; updatedAt: string; status: string }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    actorName: string;
    clientName: string | null;
    createdAt: string;
  }[];
};

const PROCESSING_STATUSES = ["UPLOADED", "QUEUED", "PROCESSING"] as const;

/** Org-level dashboard stats for the Global Overview. */
export async function getOrgDashboard(organizationId: string): Promise<OrgDashboard> {
  const clientIds = (
    await prisma.client.findMany({ where: { organizationId }, select: { id: true } })
  ).map((client) => client.id);

  const [activeClients, filesAwaitingProcessing, reviewsAwaitingApproval, openConflicts, recentClients, activity] =
    await Promise.all([
      prisma.client.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.source.count({
        where: { clientId: { in: clientIds }, isDeleted: false, processingStatus: { in: [...PROCESSING_STATUSES] } },
      }),
      prisma.importReview.count({ where: { clientId: { in: clientIds }, status: "PENDING" } }),
      prisma.conflict.count({ where: { clientId: { in: clientIds }, status: "OPEN" } }),
      prisma.client.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, displayName: true, updatedAt: true, status: true },
      }),
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

  const actorIds = Array.from(new Set(activity.map((a) => a.actorUserId).filter(Boolean) as string[]));
  const activityClientIds = Array.from(new Set(activity.map((a) => a.clientId).filter(Boolean) as string[]));
  const [actors, activityClients] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
    prisma.client.findMany({ where: { id: { in: activityClientIds } }, select: { id: true, displayName: true } }),
  ]);
  const actorMap = new Map(actors.map((a) => [a.id, a.name]));
  const clientMap = new Map(activityClients.map((c) => [c.id, c.displayName]));

  return {
    activeClients,
    filesAwaitingProcessing,
    reviewsAwaitingApproval,
    openConflicts,
    recentClients: recentClients.map((client) => ({
      id: client.id,
      displayName: client.displayName,
      updatedAt: client.updatedAt.toISOString(),
      status: client.status,
    })),
    recentActivity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      actorName: entry.actorUserId ? (actorMap.get(entry.actorUserId) ?? "Someone") : "System",
      clientName: entry.clientId ? (clientMap.get(entry.clientId) ?? null) : null,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export type TeamData = {
  orgMembers: { id: string; name: string; email: string; role: string }[];
  clientAssignments: { clientName: string; memberName: string; role: string }[];
};

export async function getTeamData(organizationId: string): Promise<TeamData> {
  const [orgMembers, clientMembers] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clientMember.findMany({
      where: { client: { organizationId } },
      include: { user: { select: { name: true } }, client: { select: { displayName: true } } },
    }),
  ]);

  return {
    orgMembers: orgMembers.map((member) => ({
      id: member.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
    clientAssignments: clientMembers.map((member) => ({
      clientName: member.client.displayName,
      memberName: member.user.name,
      role: member.role,
    })),
  };
}
