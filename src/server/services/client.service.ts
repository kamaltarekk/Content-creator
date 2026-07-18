import "server-only";

import type { BrandType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { getCompletenessForClient } from "@/server/services/missingData.service";

const ALL_BRAIN_SECTIONS = [
  "BUSINESS",
  "POSITIONING",
  "MARKETS",
  "COHORTS",
  "BELIEFS",
  "VOICE",
  "OFFERS",
  "PROOF",
  "BRAND_ASSOCIATIONS",
  "PRODUCTION",
  "COMMERCIAL_OBJECTIVES",
  "CONSTRAINTS",
  "PROHIBITED_CLAIMS",
  "LEARNINGS",
] as const;

export function getClientById(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
  });
}

export function listClientOptionsForOrg(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
}

export async function listClientsForOrg(organizationId: string) {
  const clients = await prisma.client.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sources: true, members: true } },
    },
  });

  return Promise.all(
    clients.map(async (client) => {
      const [pendingReviews, completeness] = await Promise.all([
        prisma.importReview.count({ where: { clientId: client.id, status: "PENDING" } }),
        getCompletenessForClient(client.id),
      ]);

      return {
        ...client,
        sourceCount: client._count.sources,
        teamMemberCount: client._count.members,
        pendingReviews,
        completenessPercent: completeness.overall,
      };
    }),
  );
}

export type CreateClientInput = {
  name: string;
  displayName: string;
  brandType: BrandType;
  primaryMarket?: string;
  defaultLanguage?: string;
  timeZone?: string;
  shortDescription?: string;
};

export async function createClient(
  organizationId: string,
  actorUserId: string,
  input: CreateClientInput,
) {
  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        organizationId,
        name: input.name,
        displayName: input.displayName,
        brandType: input.brandType,
        primaryMarket: input.primaryMarket || null,
        defaultLanguage: input.defaultLanguage || "en",
        timeZone: input.timeZone || "UTC",
        shortDescription: input.shortDescription || null,
      },
    });

    await tx.clientBrainSection.createMany({
      data: ALL_BRAIN_SECTIONS.map((sectionKey) => ({
        clientId: created.id,
        sectionKey,
      })),
    });

    return created;
  });

  await logAudit({
    organizationId,
    clientId: client.id,
    actorUserId,
    action: "CREATE",
    entityType: "Client",
    entityId: client.id,
    metadata: { name: client.name },
  });

  return client;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export async function updateClient(
  clientId: string,
  actorUserId: string,
  organizationId: string,
  input: UpdateClientInput,
) {
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.brandType !== undefined && { brandType: input.brandType }),
      ...(input.primaryMarket !== undefined && { primaryMarket: input.primaryMarket || null }),
      ...(input.defaultLanguage !== undefined && { defaultLanguage: input.defaultLanguage }),
      ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
      ...(input.shortDescription !== undefined && {
        shortDescription: input.shortDescription || null,
      }),
    },
  });

  await logAudit({
    organizationId,
    clientId: client.id,
    actorUserId,
    action: "UPDATE",
    entityType: "Client",
    entityId: client.id,
  });

  return client;
}

export async function archiveClient(clientId: string, actorUserId: string, organizationId: string) {
  const client = await prisma.client.update({
    where: { id: clientId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await logAudit({
    organizationId,
    clientId: client.id,
    actorUserId,
    action: "ARCHIVE",
    entityType: "Client",
    entityId: client.id,
  });

  return client;
}
