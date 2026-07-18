import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  PrismaClient,
  type ClientBrainFieldKey,
  type ClientBrainSectionKey,
  type InformationType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STORAGE_ROOT = resolve(process.cwd(), process.env.STORAGE_LOCAL_ROOT || ".data/uploads");

const ALL_SECTIONS: ClientBrainSectionKey[] = [
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
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Organization + users (owner, strategist, client approver) ---
  const org = await prisma.organization.upsert({
    where: { slug: "demo-agency" },
    update: {},
    create: { name: "Demo Agency", slug: "demo-agency" },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo-agency.test" },
    update: {},
    create: { name: "Kamal Tarek", email: "owner@demo-agency.test", passwordHash },
  });
  const strategist = await prisma.user.upsert({
    where: { email: "strategist@demo-agency.test" },
    update: {},
    create: { name: "Sara Nabil", email: "strategist@demo-agency.test", passwordHash },
  });
  const approver = await prisma.user.upsert({
    where: { email: "approver@demo-agency.test" },
    update: {},
    create: { name: "Omar Client", email: "approver@demo-agency.test", passwordHash },
  });

  for (const [user, role] of [
    [owner, "OWNER"],
    [strategist, "STRATEGIST"],
    [approver, "CLIENT_APPROVER"],
  ] as const) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role },
      create: { organizationId: org.id, userId: user.id, role },
    });
  }

  // --- Reset the demo client so the seed is deterministic ---
  const existing = await prisma.client.findFirst({
    where: { organizationId: org.id, name: "Kamal Ghamry" },
  });
  if (existing) {
    const clientId = existing.id;
    await prisma.conflictResolution.deleteMany({ where: { conflict: { clientId } } });
    await prisma.conflict.deleteMany({ where: { clientId } });
    await prisma.clientBrainItemSource.deleteMany({ where: { item: { clientId } } });
    await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
    await prisma.clientBrainItem.deleteMany({ where: { clientId } });
    await prisma.clientBrainSection.deleteMany({ where: { clientId } });
    await prisma.importReview.deleteMany({ where: { clientId } });
    const sources = await prisma.source.findMany({ where: { clientId }, select: { id: true } });
    const sourceIds = sources.map((s) => s.id);
    await prisma.extractedItem.deleteMany({ where: { sourceId: { in: sourceIds } } });
    await prisma.sourceBlock.deleteMany({ where: { sourceId: { in: sourceIds } } });
    await prisma.sourceProcessingJob.deleteMany({ where: { sourceId: { in: sourceIds } } });
    await prisma.sourceVersion.deleteMany({ where: { sourceId: { in: sourceIds } } });
    await prisma.source.deleteMany({ where: { clientId } });
    await prisma.missingDataItem.deleteMany({ where: { clientId } });
    await prisma.tag.deleteMany({ where: { clientId } });
    await prisma.clientMember.deleteMany({ where: { clientId } });
    await prisma.auditLog.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
  }

  // --- Client ---
  const client = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Kamal Ghamry",
      displayName: "Kamal Ghamry",
      brandType: "PERSONAL_BRAND",
      primaryMarket: "Egypt",
      defaultLanguage: "ar",
      timeZone: "Africa/Cairo",
      shortDescription: "Commercial Marketing Belief Reframer — turns wrong marketing beliefs into better commercial decisions.",
    },
  });

  await prisma.clientBrainSection.createMany({
    data: ALL_SECTIONS.map((sectionKey) => ({ clientId: client.id, sectionKey })),
  });

  // The client-scoped approver is assigned to this client only.
  await prisma.clientMember.create({
    data: { clientId: client.id, userId: approver.id, role: "CLIENT_APPROVER" },
  });

  // --- Source: the sample framework CSV, stored + processed ---
  const csvContent = existsSync("sample-data/sample-source.csv")
    ? readFileSync("sample-data/sample-source.csv")
    : Buffer.from("section,note\nPositioning,Kamal is a Commercial Marketing Belief Reframer.\n");
  const checksum = createHash("sha256").update(csvContent).digest("hex");

  const source = await prisma.source.create({
    data: {
      clientId: client.id,
      fileName: "SPB-Framework.csv",
      originalFileName: "SPB Framework.csv",
      fileType: "CSV",
      mimeType: "text/csv",
      sizeBytes: csvContent.byteLength,
      checksumSha256: checksum,
      storageKey: "", // set below
      sourceCategory: "STRATEGIC_FRAMEWORK",
      title: "SPB Framework",
      description: "Kamal's strategic positioning and belief framework.",
      confidentiality: "CLIENT_CONFIDENTIAL",
      processingStatus: "READY_FOR_REVIEW",
      uploadedById: owner.id,
      currentVersionNumber: 1,
    },
  });

  const storageKey = join(client.id, source.id, "v1", "SPB-Framework.csv");
  await prisma.source.update({ where: { id: source.id }, data: { storageKey } });
  // Persist the original file where the LocalStorageProvider expects it.
  const filePath = join(STORAGE_ROOT, storageKey);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, csvContent);

  const version = await prisma.sourceVersion.create({
    data: {
      sourceId: source.id,
      versionNumber: 1,
      storageKey,
      checksumSha256: checksum,
      sizeBytes: csvContent.byteLength,
      uploadedById: owner.id,
    },
  });
  await prisma.sourceProcessingJob.create({
    data: {
      sourceId: source.id,
      sourceVersionId: version.id,
      status: "SUCCEEDED",
      startedAt: new Date(),
      finishedAt: new Date(),
      resultSummary: { blockCount: 12 },
    },
  });

  // --- Helper: create a block + extracted item, optionally approve into the brain ---
  type SeedItem = {
    row: number;
    text: string;
    informationType: InformationType;
    section: ClientBrainSectionKey | null;
    field: ClientBrainFieldKey | null;
    normalized: string;
    confidence: number;
    reasoning: string;
    tags: string[];
    approve?: boolean;
    conflictCandidate?: boolean;
  };

  const items: SeedItem[] = [
    {
      row: 2,
      text: "Positioning: Kamal is a Commercial Marketing Belief Reframer, not a performance marketing consultant.",
      informationType: "STRATEGIC_FACT",
      section: "POSITIONING",
      field: "CATEGORY",
      normalized: "Commercial Marketing Belief Reframer",
      confidence: 0.92,
      reasoning: "An explicit category statement written by the client.",
      tags: ["positioning"],
      approve: true,
    },
    {
      row: 3,
      text: "Positioning: We think our differentiation is that we connect marketing decisions directly to commercial outcomes.",
      informationType: "HYPOTHESIS",
      section: "POSITIONING",
      field: "DIFFERENTIATION",
      normalized: "Connects marketing decisions directly to commercial outcomes, not vanity metrics.",
      confidence: 0.61,
      reasoning: "Phrased as a 'we think' hypothesis rather than a settled fact.",
      tags: ["positioning", "differentiation"],
      // left pending on purpose — a hypothesis awaiting confirmation
    },
    {
      row: 4,
      text: "Cohort: Marketing managers blamed for weak sales conversion are our primary audience.",
      informationType: "STRATEGIC_FACT",
      section: "COHORTS",
      field: "COHORT_NAME",
      normalized: "Marketing managers blamed for weak sales conversion",
      confidence: 0.88,
      reasoning: "Names the primary target cohort.",
      tags: ["cohort"],
      approve: true,
    },
    {
      row: 6,
      text: "Belief: Wrong belief: High ROAS means marketing success.",
      informationType: "STRATEGIC_FACT",
      section: "BELIEFS",
      field: "WRONG_BELIEF",
      normalized: "High ROAS means marketing success.",
      confidence: 0.9,
      reasoning: "States the wrong belief the client reframes.",
      tags: ["belief"],
      approve: true,
    },
    {
      row: 7,
      text: "Belief: Better belief: Marketing efficiency must be evaluated inside the complete commercial model.",
      informationType: "STRATEGIC_FACT",
      section: "BELIEFS",
      field: "BETTER_BELIEF",
      normalized: "Marketing efficiency must be evaluated inside the complete commercial model.",
      confidence: 0.9,
      reasoning: "States the reframed better belief.",
      tags: ["belief"],
      approve: true,
    },
    {
      row: 9,
      text: "Voice: Kamal speaks Egyptian Arabic with a direct, calm authority and mixes in English business terminology.",
      informationType: "CLIENT_PREFERENCE",
      section: "VOICE",
      field: "TONE",
      normalized: "Direct, calm authority; Egyptian Arabic with natural English business terminology.",
      confidence: 0.85,
      reasoning: "Describes the client's preferred voice and tone.",
      tags: ["voice"],
      approve: true,
    },
    {
      row: 10,
      text: "Evidence: One client increased contribution profit by 22% after cutting a high-ROAS campaign with poor lead quality.",
      informationType: "EVIDENCE",
      section: "PROOF",
      field: "RESULT",
      normalized: "A client increased contribution profit by 22% after cutting a high-ROAS but poor-lead-quality campaign.",
      confidence: 0.8,
      reasoning: "A concrete, verifiable result — evidence rather than a claim.",
      tags: ["proof", "evidence"],
      approve: true,
    },
    {
      row: 11,
      text: "Customer Message: A marketing manager wrote: 'We keep scaling ROAS but the CEO says the company still isn't making more money.'",
      informationType: "AUDIENCE_SIGNAL",
      section: "COHORTS",
      field: "ACTIVE_PROBLEM",
      normalized: "Managers scale ROAS but the CEO still doesn't see the company making more money.",
      confidence: 0.72,
      reasoning: "Raw customer language — an audience signal, not the client's own voice.",
      tags: ["audience-signal"],
      // left pending — audience signal awaiting a reviewer's decision
    },
    {
      row: 12,
      text: "Note: https://example.com/case-study-kamal-ghamry",
      informationType: "EXTERNAL_SOURCE",
      section: null,
      field: null,
      normalized: "https://example.com/case-study-kamal-ghamry",
      confidence: 0.95,
      reasoning: "A URL — an external reference, not strategic content.",
      tags: ["link"],
      // left pending — external source
    },
  ];

  const now = new Date();

  for (const item of items) {
    const block = await prisma.sourceBlock.create({
      data: {
        sourceId: source.id,
        sourceVersionId: version.id,
        blockType: "TABLE_ROW",
        sequenceIndex: item.row - 2,
        rawText: item.text,
        locationLabel: `Row ${item.row}`,
        locationJson: { type: "csv_row", row: item.row, headers: ["section", "note"] },
        detectedLanguage: "en",
      },
    });

    const extracted = await prisma.extractedItem.create({
      data: {
        sourceBlockId: block.id,
        sourceId: source.id,
        informationType: item.informationType,
        proposedSectionKey: item.section,
        proposedFieldKey: item.field,
        normalizedValueText: item.normalized,
        confidence: item.confidence,
        detectedLanguage: "en",
        reasoningSummary: item.reasoning,
        suggestedTags: item.tags,
        isConflictCandidate: item.conflictCandidate ?? false,
        aiModel: "seed",
        validationStatus: item.confidence < 0.55 ? "VALID" : "VALID",
        validationNotes: item.confidence < 0.55 ? "Low confidence." : null,
      },
    });

    if (item.approve && item.section && item.field) {
      const brainItem = await prisma.clientBrainItem.create({
        data: {
          clientId: client.id,
          sectionKey: item.section,
          fieldKey: item.field,
          valueText: item.normalized,
          status: "ACTIVE",
          confidence: item.confidence,
          currentVersionNumber: 1,
          createdById: strategist.id,
        },
      });
      await prisma.clientBrainItemVersion.create({
        data: {
          clientBrainItemId: brainItem.id,
          versionNumber: 1,
          valueText: item.normalized,
          status: "ACTIVE",
          confidence: item.confidence,
          changeType: "ADDED",
          changedById: strategist.id,
        },
      });
      await prisma.clientBrainItemSource.create({
        data: {
          clientBrainItemId: brainItem.id,
          sourceId: source.id,
          sourceBlockId: block.id,
          extractedItemId: extracted.id,
          approvedById: strategist.id,
          approvedAt: now,
        },
      });
      await prisma.extractedItem.update({ where: { id: extracted.id }, data: { clientBrainItemId: brainItem.id } });
      await prisma.importReview.create({
        data: {
          extractedItemId: extracted.id,
          clientId: client.id,
          status: "RESOLVED",
          resolutionAction: "APPROVE",
          reviewerId: strategist.id,
          reviewedAt: now,
        },
      });
    } else {
      await prisma.importReview.create({
        data: { extractedItemId: extracted.id, clientId: client.id, status: "PENDING" },
      });
    }
  }

  // --- A few more approved brain items for a fuller demo ---
  const extras: { section: ClientBrainSectionKey; field: ClientBrainFieldKey; value: string }[] = [
    { section: "POSITIONING", field: "CORE_PROMISE", value: "Turn a wrong marketing belief into a better commercial decision." },
    { section: "POSITIONING", field: "POINT_OF_VIEW", value: "Marketing must be judged inside the complete commercial model, not by isolated metrics." },
    { section: "BELIEFS", field: "BETTER_DECISION", value: "Do not scale a campaign before reviewing contribution profit and conversion quality." },
    { section: "BELIEFS", field: "COMMERCIAL_CONSEQUENCE", value: "Scaling high-ROAS but low-quality campaigns erodes contribution profit." },
    { section: "COHORTS", field: "CURRENT_BELIEF", value: "If ROAS is high, marketing is working." },
    { section: "COHORTS", field: "DESIRED_OUTCOME", value: "Prove marketing's commercial impact to a skeptical CEO." },
    { section: "VOICE", field: "LANGUAGE", value: "Egyptian Arabic" },
    { section: "VOICE", field: "PROHIBITED_PHRASES", value: "No exaggerated creator language." },
    { section: "OFFERS", field: "OFFER_NAME", value: "CEO Marketing Decision Session" },
    { section: "OFFERS", field: "PROMISE", value: "A single session that reframes one marketing decision into a commercial one." },
    { section: "OFFERS", field: "CTA_ROUTE", value: "Book a CEO Marketing Decision Session." },
    { section: "COMMERCIAL_OBJECTIVES", field: "NORTH_STAR", value: "Contribution profit from marketing-influenced revenue." },
  ];
  for (const extra of extras) {
    const brainItem = await prisma.clientBrainItem.create({
      data: {
        clientId: client.id,
        sectionKey: extra.section,
        fieldKey: extra.field,
        valueText: extra.value,
        status: "ACTIVE",
        confidence: 1,
        currentVersionNumber: 1,
        createdById: strategist.id,
      },
    });
    await prisma.clientBrainItemVersion.create({
      data: {
        clientBrainItemId: brainItem.id,
        versionNumber: 1,
        valueText: extra.value,
        status: "ACTIVE",
        confidence: 1,
        changeType: "ADDED",
        changedById: strategist.id,
        changeNote: "Seeded",
      },
    });
  }

  // --- The demo conflict: an approved OFFERS/PRICE (45,000 EGP) disputed by a new 30,000 EGP proposal ---
  const priceItem = await prisma.clientBrainItem.create({
    data: {
      clientId: client.id,
      sectionKey: "OFFERS",
      fieldKey: "PRICE",
      valueText: "45,000 EGP",
      status: "DISPUTED",
      confidence: 0.9,
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.clientBrainItemVersion.create({
    data: {
      clientBrainItemId: priceItem.id,
      versionNumber: 1,
      valueText: "45,000 EGP",
      status: "ACTIVE",
      confidence: 0.9,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });

  const conflictBlock = await prisma.sourceBlock.create({
    data: {
      sourceId: source.id,
      sourceVersionId: version.id,
      blockType: "TABLE_ROW",
      sequenceIndex: 100,
      rawText: "Offer: CEO Marketing Decision Session priced at 30,000 EGP for a single session.",
      locationLabel: "Row 8",
      locationJson: { type: "csv_row", row: 8, headers: ["section", "note"] },
      detectedLanguage: "en",
    },
  });
  const conflictingExtracted = await prisma.extractedItem.create({
    data: {
      sourceBlockId: conflictBlock.id,
      sourceId: source.id,
      informationType: "STRATEGIC_FACT",
      proposedSectionKey: "OFFERS",
      proposedFieldKey: "PRICE",
      normalizedValueText: "30,000 EGP",
      confidence: 0.86,
      detectedLanguage: "en",
      reasoningSummary: "States an offer price that differs from the approved one.",
      suggestedTags: ["offer", "price"],
      isConflictCandidate: true,
      aiModel: "seed",
      validationStatus: "VALID",
    },
  });
  await prisma.importReview.create({
    data: {
      extractedItemId: conflictingExtracted.id,
      clientId: client.id,
      status: "PENDING",
      reviewNotes: "Approval opened a conflict — resolve it to proceed.",
    },
  });
  await prisma.conflict.create({
    data: {
      clientId: client.id,
      clientBrainItemId: priceItem.id,
      extractedItemId: conflictingExtracted.id,
      status: "OPEN",
      detectedReason: "Value changed from 45000 to 30000 (33% difference).",
      similarityScore: null,
    },
  });

  const pendingCount = await prisma.importReview.count({ where: { clientId: client.id, status: "PENDING" } });
  const brainCount = await prisma.clientBrainItem.count({ where: { clientId: client.id } });

  console.log("Seed complete:");
  console.log(`  Organization: ${org.slug}`);
  console.log(`  Users: owner@demo-agency.test / strategist@demo-agency.test / approver@demo-agency.test (all password123)`);
  console.log(`  Client: ${client.displayName} (${client.id})`);
  console.log(`  Client Brain items: ${brainCount}`);
  console.log(`  Pending reviews: ${pendingCount}`);
  console.log(`  Open conflicts: 1 (OFFERS/PRICE — 45,000 vs 30,000 EGP)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
