import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createCohort, updateCohort } from "@/server/services/cohort.service";
import { createStrategicRelationship, CrossClientRelationshipError } from "@/server/services/strategicRelationship.service";

const RUN_ID = `strat-rel-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientAId: string;
let clientBId: string;

async function seedBase() {
  const org = await prisma.organization.create({ data: { name: `StratOrg ${RUN_ID}`, slug: `strat-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Strategist", email: `strat-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const clientA = await prisma.client.create({
    data: { organizationId: orgId, name: `StratClientA ${RUN_ID}`, displayName: "Strat Client A", brandType: "PERSONAL_BRAND" },
  });
  clientAId = clientA.id;
  const clientB = await prisma.client.create({
    data: { organizationId: orgId, name: `StratClientB ${RUN_ID}`, displayName: "Strat Client B", brandType: "PERSONAL_BRAND" },
  });
  clientBId = clientB.id;
}

afterAll(async () => {
  await prisma.strategicRelationship.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.strategicEntity.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.cohortVersion.deleteMany({ where: { cohort: { clientId: { in: [clientAId, clientBId] } } } });
  await prisma.cohort.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.deleteMany({ where: { id: { in: [clientAId, clientBId] } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("strategic relationship graph", () => {
  it("rejects a relationship between entities from different clients", async () => {
    await seedBase();

    const cohortA = await createCohort({
      clientId: clientAId,
      organizationId: orgId,
      actorUserId: userId,
      input: { name: "Cohort A" },
    });
    const cohortB = await createCohort({
      clientId: clientBId,
      organizationId: orgId,
      actorUserId: userId,
      input: { name: "Cohort B" },
    });

    const entityA = await prisma.strategicEntity.findFirstOrThrow({ where: { clientId: clientAId, entityId: cohortA.id } });
    const entityB = await prisma.strategicEntity.findFirstOrThrow({ where: { clientId: clientBId, entityId: cohortB.id } });

    await expect(
      createStrategicRelationship({
        clientId: clientAId,
        organizationId: orgId,
        actorUserId: userId,
        fromEntityId: entityA.id,
        toEntityId: entityB.id,
        relationshipType: "RELEVANT_TO",
      }),
    ).rejects.toThrow(CrossClientRelationshipError);

    const count = await prisma.strategicRelationship.count({ where: { clientId: clientAId } });
    expect(count).toBe(0);
  });

  it("preserves every prior version when a cohort is edited multiple times", async () => {
    const cohort = await createCohort({
      clientId: clientAId,
      organizationId: orgId,
      actorUserId: userId,
      input: { name: "Versioned Cohort" },
    });

    await updateCohort({ cohortId: cohort.id, organizationId: orgId, actorUserId: userId, input: { name: "Versioned Cohort v2" } });
    await updateCohort({ cohortId: cohort.id, organizationId: orgId, actorUserId: userId, input: { name: "Versioned Cohort v3" } });

    const versions = await prisma.cohortVersion.findMany({ where: { cohortId: cohort.id }, orderBy: { versionNumber: "asc" } });
    expect(versions).toHaveLength(3);
    expect(versions.map((v) => v.name)).toEqual(["Versioned Cohort", "Versioned Cohort v2", "Versioned Cohort v3"]);
    expect(versions[0].name).toBe("Versioned Cohort"); // first version untouched by later edits

    const current = await prisma.cohort.findUniqueOrThrow({ where: { id: cohort.id } });
    expect(current.currentVersionNumber).toBe(3);
  });
});
