import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { compileScriptContext } from "@/server/services/scriptContextCompiler.service";

/**
 * Verifies the compiler only surfaces approved data (relevance filtering),
 * never leaks another client's data into a compiled context (client
 * isolation), and preserves source references for everything it includes.
 */

const RUN_ID = `compiler-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientAId: string;
let clientBId: string;
let cohortAId: string;
let cohortBId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `CompilerOrg ${RUN_ID}`, slug: `compiler-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Compiler User", email: `compiler-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;

  const clientA = await prisma.client.create({
    data: { organizationId: orgId, name: `CompilerClientA ${RUN_ID}`, displayName: "Client A", brandType: "PERSONAL_BRAND" },
  });
  clientAId = clientA.id;
  const clientB = await prisma.client.create({
    data: { organizationId: orgId, name: `CompilerClientB ${RUN_ID}`, displayName: "Client B", brandType: "PERSONAL_BRAND" },
  });
  clientBId = clientB.id;

  await prisma.clientBrainItem.create({
    data: { clientId: clientAId, sectionKey: "BUSINESS", fieldKey: "PRODUCTS_SERVICES", valueText: "Client A's consulting offer.", status: "ACTIVE", currentVersionNumber: 1, createdById: userId },
  });
  await prisma.clientBrainItem.create({
    data: { clientId: clientBId, sectionKey: "BUSINESS", fieldKey: "PRODUCTS_SERVICES", valueText: "Client B's totally different product.", status: "ACTIVE", currentVersionNumber: 1, createdById: userId },
  });

  const cohortA = await prisma.cohort.create({ data: { clientId: clientAId, name: "Client A audience", approvalStatus: "APPROVED", createdById: userId } });
  cohortAId = cohortA.id;
  const cohortB = await prisma.cohort.create({ data: { clientId: clientBId, name: "Client B audience", approvalStatus: "APPROVED", createdById: userId } });
  cohortBId = cohortB.id;

  // Client A: one approved offer, one DRAFT (unapproved) offer — only the approved one should ever surface.
  const approvedOffer = await prisma.offer.create({
    data: { clientId: clientAId, name: "Approved Offer", corePromise: "A safe, reviewed promise.", ctaRoute: "Book a call", approvalStatus: "APPROVED", createdById: userId },
  });
  await prisma.offer.create({
    data: { clientId: clientAId, name: "Draft Offer", corePromise: "An unreviewed, risky promise.", approvalStatus: "DRAFT", createdById: userId },
  });
  await prisma.proofItem.create({
    data: { clientId: clientAId, offerId: approvedOffer.id, proofType: "CASE_STUDY", whatHappened: "Approved public case study.", publicUseStatus: "PUBLIC", approvalStatus: "APPROVED", needsReview: false, createdById: userId },
  });
  await prisma.proofItem.create({
    data: { clientId: clientAId, offerId: approvedOffer.id, proofType: "TESTIMONIAL", whatHappened: "Unapproved draft testimonial.", publicUseStatus: "PUBLIC", approvalStatus: "DRAFT", needsReview: false, createdById: userId },
  });
});

afterAll(async () => {
  await prisma.proofItem.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.offer.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.cohort.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId: { in: [clientAId, clientBId] } } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.deleteMany({ where: { id: { in: [clientAId, clientBId] } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("compileScriptContext (integration)", () => {
  it("only includes approved data, excluding drafts (relevance filtering)", async () => {
    const { context } = await compileScriptContext({
      clientId: clientAId,
      cohortId: cohortAId,
      contentObjective: "OFFER_PROMOTION",
      platform: "INSTAGRAM_REELS",
      offerId: (await prisma.offer.findFirstOrThrow({ where: { clientId: clientAId, approvalStatus: "APPROVED" } })).id,
    });

    expect(context.offer?.name).toBe("Approved Offer");
    expect(context.proof).toHaveLength(1);
    expect(context.proof[0].whatHappened).toBe("Approved public case study.");
    expect(context.business.whatTheySell).toBe("Client A's consulting offer.");
    expect(context.grounding.sourceReferences.length).toBeGreaterThan(0);
  });

  it("never leaks another client's data into the compiled context (client isolation)", async () => {
    const { context } = await compileScriptContext({
      clientId: clientBId,
      cohortId: cohortBId,
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
    });

    expect(context.audience.cohortName).toBe("Client B audience");
    expect(context.business.whatTheySell).toBe("Client B's totally different product.");
    expect(context.offer).toBeNull();
    expect(context.proof).toHaveLength(0);
    for (const ref of context.grounding.sourceReferences) {
      expect(ref.entityId).not.toBe(cohortAId);
    }
  });

  it("surfaces missing-critical-input warnings instead of fabricating data when nothing is set up", async () => {
    const { context, warnings } = await compileScriptContext({
      clientId: clientBId,
      cohortId: cohortBId,
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
    });

    expect(context.beliefChain).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => /belief/i.test(w))).toBe(true);
  });
});
