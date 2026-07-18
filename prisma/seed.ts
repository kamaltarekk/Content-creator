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

// Pure domain modules only (no "server-only" services) — safe to import into a plain tsx script.
import { ScriptGenerationContextSchema, type ScriptGenerationContext } from "../src/server/domain/script-generation-context";
import { ReelScriptPackageSchema, type ReelScriptPackage } from "../src/server/domain/reel-script-package";
import { computeReelValidation, isReadyToMarkReady, summarizeGatesForPackage } from "../src/server/domain/reel-validation";

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

    // --- Module 2: strategy layer (FK-safe order) ---
    await prisma.strategyReadinessSnapshot.deleteMany({ where: { clientId } });
    await prisma.strategySuggestionReview.deleteMany({ where: { clientId } });
    await prisma.strategySuggestion.deleteMany({ where: { clientId } });
    await prisma.strategicRelationship.deleteMany({ where: { clientId } });
    await prisma.strategicEntity.deleteMany({ where: { clientId } });
    await prisma.evidenceLink.deleteMany({ where: { clientId } });
    await prisma.beliefMapVersion.deleteMany({ where: { beliefMap: { clientId } } });
    await prisma.beliefMap.deleteMany({ where: { clientId } });
    await prisma.decisionCriterion.deleteMany({ where: { clientId } });
    await prisma.objection.deleteMany({ where: { clientId } });
    await prisma.buyingRoleParticipant.deleteMany({ where: { clientId } });
    await prisma.buyingDecisionVersion.deleteMany({ where: { buyingDecision: { clientId } } });
    await prisma.buyingDecision.deleteMany({ where: { clientId } });
    await prisma.commercialSituationVersion.deleteMany({ where: { commercialSituation: { clientId } } });
    await prisma.commercialSituation.deleteMany({ where: { clientId } });
    await prisma.cohortSourceReference.deleteMany({ where: { cohort: { clientId } } });
    await prisma.cohortVersion.deleteMany({ where: { cohort: { clientId } } });
    await prisma.cohort.deleteMany({ where: { clientId } });

    // --- Module 3: guided setup, offer/proof, script intelligence, and Reels (FK-safe order) ---
    await prisma.reelVersion.deleteMany({ where: { reelGeneration: { clientId } } });
    await prisma.reelGeneration.deleteMany({ where: { clientId } });
    await prisma.scriptContextSnapshot.deleteMany({ where: { clientId } });
    await prisma.guidedSetupAnswer.deleteMany({ where: { clientId } });
    await prisma.guidedSetupSession.deleteMany({ where: { clientId } });
    await prisma.scriptIntelligenceField.deleteMany({ where: { clientId } });
    await prisma.proofItem.deleteMany({ where: { clientId } });
    await prisma.offerVersion.deleteMany({ where: { offer: { clientId } } });
    await prisma.offer.deleteMany({ where: { clientId } });

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

  // =========================================================================
  // MODULE 2 — Cohort + Buying Decision + Belief Intelligence
  // =========================================================================

  // --- The primary cohort, fully worked through the reasoning chain ---
  const mainCohort = await prisma.cohort.create({
    data: {
      clientId: client.id,
      name: "Marketing managers blamed for weak sales conversion",
      definition:
        "Mid-size B2B marketing managers who get blamed by the CEO when sales conversion drops, even though the funnel gap is downstream of marketing's control.",
      priority: "HIGH",
      role: "Marketing Manager",
      commercialContext: "Under pressure to prove marketing's commercial impact after a weak quarter.",
      currentWorkflow: "Runs paid campaigns and reports MQLs and ROAS monthly to the CEO.",
      currentBelief: "If ROAS is high, marketing is working.",
      desiredOutcome: "Prove marketing's commercial impact to a skeptical CEO.",
      decisionRisk: "Budget could be cut if next quarter doesn't show commercial results, not just marketing metrics.",
      emotionalDrivers: ["fear of blame", "desire for credibility"],
      platformPresence: ["LinkedIn", "Email"],
      attentionNotes: "Reads LinkedIn thought-leadership content from CFOs and revenue leaders.",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.cohortVersion.create({
    data: {
      cohortId: mainCohort.id,
      name: mainCohort.name,
      definition: mainCohort.definition,
      priority: mainCohort.priority,
      role: mainCohort.role,
      commercialContext: mainCohort.commercialContext,
      currentWorkflow: mainCohort.currentWorkflow,
      currentBelief: mainCohort.currentBelief,
      desiredOutcome: mainCohort.desiredOutcome,
      decisionRisk: mainCohort.decisionRisk,
      emotionalDrivers: mainCohort.emotionalDrivers,
      platformPresence: mainCohort.platformPresence,
      attentionNotes: mainCohort.attentionNotes,
      status: mainCohort.status,
      approvalStatus: mainCohort.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });
  await prisma.cohortSourceReference.create({
    data: {
      cohortId: mainCohort.id,
      relationshipType: "STRONG_SIGNAL",
      audienceSignalNote: "Managers scale ROAS but the CEO still doesn't see the company making more money.",
      note: "Grounded in the customer message audience signal from the SPB framework upload.",
      linkedById: strategist.id,
    },
  });

  const mainSituation = await prisma.commercialSituation.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      title: "CEO blames marketing after a weak sales quarter",
      triggerType: "PERFORMANCE_CHANGE",
      triggerDescription: "Sales conversion dropped 15% quarter-on-quarter despite marketing hitting its lead targets.",
      activeProblem: "Marketing is blamed for weak sales conversion even though the gap is in the sales handoff.",
      currentWorkflow: "Marketing keeps increasing ad spend on top-of-funnel campaigns instead of auditing the handoff.",
      urgencyNote: "Must show a different commercial story before the next board meeting.",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.commercialSituationVersion.create({
    data: {
      commercialSituationId: mainSituation.id,
      title: mainSituation.title,
      triggerType: mainSituation.triggerType,
      triggerDescription: mainSituation.triggerDescription,
      activeProblem: mainSituation.activeProblem,
      currentWorkflow: mainSituation.currentWorkflow,
      urgencyNote: mainSituation.urgencyNote,
      status: mainSituation.status,
      approvalStatus: mainSituation.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });

  const mainDecision = await prisma.buyingDecision.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      commercialSituationId: mainSituation.id,
      title: "Approve a new marketing measurement and accountability approach",
      decisionType: "INTERNAL_ALIGNMENT",
      description: "Whether to change how marketing's contribution is measured and reported to leadership.",
      timeframe: "This quarter",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.buyingDecisionVersion.create({
    data: {
      buyingDecisionId: mainDecision.id,
      title: mainDecision.title,
      decisionType: mainDecision.decisionType,
      description: mainDecision.description,
      timeframe: mainDecision.timeframe,
      status: mainDecision.status,
      approvalStatus: mainDecision.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });

  const ceoParticipant = await prisma.buyingRoleParticipant.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      role: "DECISION_MAKER",
      label: "CEO",
      influenceScore: 5,
      stance: "supportive of change if it's proven commercially",
      createdById: strategist.id,
    },
  });
  await prisma.buyingRoleParticipant.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      role: "CHAMPION",
      label: "Marketing Manager",
      influenceScore: 3,
      stance: "champion and primary user of the new approach",
      createdById: strategist.id,
    },
  });
  await prisma.buyingRoleParticipant.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      role: "INFLUENCER",
      label: "Sales Manager",
      influenceScore: 4,
      stance: "possible blocker — defensive about the handoff issue",
      createdById: strategist.id,
    },
  });
  await prisma.buyingRoleParticipant.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      role: "EVALUATOR",
      label: "Finance Manager",
      influenceScore: 3,
      stance: "payer influence — evaluates budget impact",
      createdById: strategist.id,
    },
  });

  await prisma.decisionCriterion.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      label: "Shows commercial impact, not just marketing metrics",
      importance: "CRITICAL",
      createdById: strategist.id,
    },
  });
  await prisma.decisionCriterion.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      label: "Can be implemented without new tooling",
      importance: "MEDIUM",
      createdById: strategist.id,
    },
  });
  await prisma.decisionCriterion.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      label: "Sales team buy-in",
      importance: "HIGH",
      createdById: strategist.id,
    },
  });

  await prisma.objection.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      title: "Sales will resist being measured on handoff speed",
      raisedByRole: "INFLUENCER",
      severity: "HIGH",
      createdById: strategist.id,
    },
  });
  await prisma.objection.create({
    data: {
      buyingDecisionId: mainDecision.id,
      clientId: client.id,
      title: "Finance is worried about attribution complexity",
      raisedByRole: "EVALUATOR",
      severity: "MEDIUM",
      resolutionNote: "Addressed with a simplified quarterly review instead of full multi-touch attribution.",
      status: "ARCHIVED",
      createdById: strategist.id,
    },
  });

  // --- The approved belief map, with strong evidence ---
  const approvedBelief = await prisma.beliefMap.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      commercialSituationId: mainSituation.id,
      observedSituation: "Sales conversion dropped while marketing hit its lead targets.",
      currentInterpretation: "Leadership assumes marketing failed because the topline conversion number is down.",
      currentBeliefStatement: "High ROAS means marketing success.",
      beliefType: "WRONG",
      behaviorCaused: "Marketing keeps increasing ad spend on top-of-funnel campaigns instead of fixing the sales handoff.",
      commercialConsequence: "CAC keeps rising while conversion stays flat, and marketing takes the blame for a sales-side problem.",
      betterBeliefStatement:
        "Marketing efficiency must be evaluated inside the complete commercial model, including what happens after the lead is handed to sales.",
      betterCommercialDecision:
        "Redirect part of the ad budget into a lead-handoff audit and a joint marketing/sales conversion review.",
      relevantOfferPlaceholder: "CEO Marketing Decision Session",
      approvalStatus: "APPROVED",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.beliefMapVersion.create({
    data: {
      beliefMapId: approvedBelief.id,
      observedSituation: approvedBelief.observedSituation,
      currentInterpretation: approvedBelief.currentInterpretation,
      currentBeliefStatement: approvedBelief.currentBeliefStatement,
      beliefType: approvedBelief.beliefType,
      behaviorCaused: approvedBelief.behaviorCaused,
      commercialConsequence: approvedBelief.commercialConsequence,
      betterBeliefStatement: approvedBelief.betterBeliefStatement,
      betterCommercialDecision: approvedBelief.betterCommercialDecision,
      relevantOfferPlaceholder: approvedBelief.relevantOfferPlaceholder,
      approvalStatus: approvedBelief.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });
  await prisma.evidenceLink.create({
    data: {
      clientId: client.id,
      targetEntityType: "BELIEF",
      targetEntityId: approvedBelief.id,
      beliefMapId: approvedBelief.id,
      description: "A client increased contribution profit by 22% after cutting a high-ROAS but poor-lead-quality campaign.",
      evidenceStrength: "STRONG",
      note: "See the PROOF/RESULT item in the Client Brain for the same result.",
      createdById: strategist.id,
    },
  });

  // --- A weak belief map: a trivial antonym-swap reframe, no evidence, still a draft ---
  const weakBelief = await prisma.beliefMap.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      currentBeliefStatement: "Marketing is difficult.",
      beliefType: "LIMITING",
      betterBeliefStatement: "Marketing can be easy.",
      approvalStatus: "DRAFT",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.beliefMapVersion.create({
    data: {
      beliefMapId: weakBelief.id,
      currentBeliefStatement: weakBelief.currentBeliefStatement,
      beliefType: weakBelief.beliefType,
      betterBeliefStatement: weakBelief.betterBeliefStatement,
      approvalStatus: weakBelief.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
      changeNote: "Seeded as a deliberately weak example — a trivial antonym swap, not a real reframe.",
    },
  });

  // --- A belief with missing evidence: well-developed, but nothing links it to proof yet ---
  const missingEvidenceBelief = await prisma.beliefMap.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      currentBeliefStatement: "More leads will fix our weak sales conversion rate.",
      beliefType: "INCOMPLETE",
      behaviorCaused: "Keeps increasing top-of-funnel ad spend instead of investigating the handoff.",
      commercialConsequence: "CAC rises without a proportional revenue gain.",
      betterBeliefStatement: "The conversion problem lives in the sales handoff, not in lead volume.",
      betterCommercialDecision: "Redirect budget from lead generation into a handoff-speed pilot program.",
      approvalStatus: "UNDER_REVIEW",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.beliefMapVersion.create({
    data: {
      beliefMapId: missingEvidenceBelief.id,
      currentBeliefStatement: missingEvidenceBelief.currentBeliefStatement,
      beliefType: missingEvidenceBelief.beliefType,
      behaviorCaused: missingEvidenceBelief.behaviorCaused,
      commercialConsequence: missingEvidenceBelief.commercialConsequence,
      betterBeliefStatement: missingEvidenceBelief.betterBeliefStatement,
      betterCommercialDecision: missingEvidenceBelief.betterCommercialDecision,
      approvalStatus: missingEvidenceBelief.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
      changeNote: "Seeded to demonstrate the 'missing evidence' state — otherwise well-developed.",
    },
  });

  // --- Strategic Relationship Graph reference rows + a couple of connections ---
  const cohortEntity = await prisma.strategicEntity.create({
    data: { clientId: client.id, entityType: "COHORT", entityId: mainCohort.id, title: mainCohort.name, status: mainCohort.approvalStatus },
  });
  const situationEntity = await prisma.strategicEntity.create({
    data: {
      clientId: client.id,
      entityType: "COMMERCIAL_SITUATION",
      entityId: mainSituation.id,
      title: mainSituation.title,
      status: mainSituation.approvalStatus,
    },
  });
  const decisionEntity = await prisma.strategicEntity.create({
    data: {
      clientId: client.id,
      entityType: "BUYING_DECISION",
      entityId: mainDecision.id,
      title: mainDecision.title,
      status: mainDecision.approvalStatus,
    },
  });
  const beliefEntity = await prisma.strategicEntity.create({
    data: {
      clientId: client.id,
      entityType: "BELIEF",
      entityId: approvedBelief.id,
      title: approvedBelief.currentBeliefStatement,
      status: approvedBelief.approvalStatus,
    },
  });
  await prisma.strategicRelationship.create({
    data: {
      clientId: client.id,
      fromEntityId: cohortEntity.id,
      toEntityId: situationEntity.id,
      relationshipType: "EXPERIENCES",
      createdById: strategist.id,
    },
  });
  await prisma.strategicRelationship.create({
    data: {
      clientId: client.id,
      fromEntityId: beliefEntity.id,
      toEntityId: decisionEntity.id,
      relationshipType: "CHANGES_DECISION",
      note: "Reframing this belief is what unlocks the buying decision.",
      createdById: strategist.id,
    },
  });

  // --- AI Suggestion Review Queue examples ---

  // 1. A plausible, well-grounded AI-suggested cohort.
  const aiSuggestedCohort = await prisma.strategySuggestion.create({
    data: {
      clientId: client.id,
      suggestionType: "COHORT",
      title: "Solo consultants overwhelmed by inconsistent lead flow",
      proposedFields: {
        name: "Solo consultants overwhelmed by inconsistent lead flow",
        priority: "MEDIUM",
        definition: "Independent consultants whose pipeline swings between feast and famine, making revenue hard to plan.",
      },
      sourceReferences: [{ source_type: "AUDIENCE_SIGNAL", reference_id: "audience-signal-lead-flow" }],
      confidence: 0.68,
      reasoningSummary: "Grounded in a recurring audience-signal pattern about inconsistent lead flow.",
      missingEvidence: ["A quantified example of the lead-flow inconsistency"],
      possibleConflicts: [],
      suggestedRelationships: [],
      status: "AI_SUGGESTED",
      isDuplicateCandidate: false,
      aiModel: "seed",
    },
  });
  await prisma.strategySuggestionReview.create({
    data: { strategySuggestionId: aiSuggestedCohort.id, clientId: client.id, status: "PENDING" },
  });

  // 2. A duplicate cohort candidate — very similar to the main cohort.
  const duplicateCohortSuggestion = await prisma.strategySuggestion.create({
    data: {
      clientId: client.id,
      suggestionType: "COHORT",
      title: "Marketing managers blamed for poor sales results",
      proposedFields: {
        name: "Marketing managers blamed for poor sales results",
        priority: "HIGH",
        definition: "Marketing managers under pressure when sales results are weak.",
      },
      sourceReferences: [{ source_type: "CLIENT_BRAIN_ITEM", reference_id: "cohort-name-item" }],
      confidence: 0.75,
      reasoningSummary: "Grounded in the same positioning material as the existing cohort.",
      missingEvidence: [],
      possibleConflicts: [
        {
          existing_entity_type: "COHORT",
          existing_entity_id: mainCohort.id,
          reason: "Very similar cohort name and situation already exists in the Cohort Lab.",
        },
      ],
      suggestedRelationships: [],
      status: "AI_SUGGESTED",
      isDuplicateCandidate: true,
      duplicateOfEntityType: "COHORT",
      duplicateOfEntityId: mainCohort.id,
      aiModel: "seed",
    },
  });
  await prisma.strategySuggestionReview.create({
    data: { strategySuggestionId: duplicateCohortSuggestion.id, clientId: client.id, status: "PENDING" },
  });

  // 3. A conflicting buying-role suggestion — proposes a second decision-maker where one is already recorded.
  const conflictingRoleSuggestion = await prisma.strategySuggestion.create({
    data: {
      clientId: client.id,
      suggestionType: "BUYING_ROLE_PARTICIPANT",
      title: "Add Sales Manager as a decision maker on the measurement approach",
      proposedFields: {
        buyingDecisionId: mainDecision.id,
        role: "DECISION_MAKER",
        label: "Sales Manager",
        influenceScore: 4,
      },
      sourceReferences: [{ source_type: "MANUAL", reference_id: "manual-note-1", note: "Inferred from a meeting note" }],
      confidence: 0.55,
      reasoningSummary: "The Sales Manager's pushback suggests they may hold real decision authority here.",
      missingEvidence: ["Direct confirmation the Sales Manager can veto or approve this decision"],
      possibleConflicts: [
        {
          existing_entity_type: "BUYING_ROLE",
          existing_entity_id: ceoParticipant.id,
          reason: "The CEO is already recorded as the sole decision maker for this buying decision.",
        },
      ],
      suggestedRelationships: [],
      status: "AI_SUGGESTED",
      isDuplicateCandidate: true,
      aiModel: "seed",
    },
  });
  await prisma.strategySuggestionReview.create({
    data: { strategySuggestionId: conflictingRoleSuggestion.id, clientId: client.id, status: "PENDING" },
  });

  // =========================================================================
  // MODULE 3 — Guided Client Setup + Script Intelligence Compiler + First Reel
  // =========================================================================

  // --- Two more approved Client Brain items Module 3 needs (business + a real prohibited claim) ---
  const whatTheySellItem = await prisma.clientBrainItem.create({
    data: {
      clientId: client.id,
      sectionKey: "BUSINESS",
      fieldKey: "PRODUCTS_SERVICES",
      valueText: "A single paid marketing-decision consulting session for CEOs and marketing leaders — not ongoing agency services.",
      status: "ACTIVE",
      confidence: 1,
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.clientBrainItemVersion.create({
    data: {
      clientBrainItemId: whatTheySellItem.id,
      versionNumber: 1,
      valueText: whatTheySellItem.valueText,
      status: "ACTIVE",
      confidence: 1,
      changeType: "ADDED",
      changedById: strategist.id,
      changeNote: "Seeded",
    },
  });

  const prohibitedClaimItem = await prisma.clientBrainItem.create({
    data: {
      clientId: client.id,
      sectionKey: "PROHIBITED_CLAIMS",
      fieldKey: "CLAIM",
      valueText: "Guaranteed revenue growth",
      status: "ACTIVE",
      confidence: 1,
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.clientBrainItemVersion.create({
    data: {
      clientBrainItemId: prohibitedClaimItem.id,
      versionNumber: 1,
      valueText: prohibitedClaimItem.valueText,
      status: "ACTIVE",
      confidence: 1,
      changeType: "ADDED",
      changedById: strategist.id,
      changeNote: "Seeded",
    },
  });
  const prohibitedClaimReasonItem = await prisma.clientBrainItem.create({
    data: {
      clientId: client.id,
      sectionKey: "PROHIBITED_CLAIMS",
      fieldKey: "REASON",
      valueText: "Kamal's offer is a decision-making session, not a performance guarantee — no result can be promised in advance.",
      status: "ACTIVE",
      confidence: 1,
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.clientBrainItemVersion.create({
    data: {
      clientBrainItemId: prohibitedClaimReasonItem.id,
      versionNumber: 1,
      valueText: prohibitedClaimReasonItem.valueText,
      status: "ACTIVE",
      confidence: 1,
      changeType: "ADDED",
      changedById: strategist.id,
      changeNote: "Seeded",
    },
  });

  // --- The Offer + Proof precursor entities (spec section 34) ---
  const offer = await prisma.offer.create({
    data: {
      clientId: client.id,
      name: "CEO Marketing Decision Session",
      forWhom: mainCohort.name,
      problemAddressed: mainSituation.activeProblem,
      corePromise: "A single session that reframes one marketing decision into a commercial one.",
      intendedOutcome: "A clear, board-ready commercial decision instead of another ROAS report.",
      mechanism: "A structured 90-minute session walking through the belief-to-decision chain with evidence.",
      deliverables: ["A recorded session", "A one-page commercial decision brief"],
      pricePresentation: "EXACT_PRICE",
      priceText: "30,000 EGP",
      guarantee: null,
      ctaRoute: "Book a CEO Marketing Decision Session.",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.offerVersion.create({
    data: {
      offerId: offer.id,
      name: offer.name,
      forWhom: offer.forWhom,
      problemAddressed: offer.problemAddressed,
      corePromise: offer.corePromise,
      intendedOutcome: offer.intendedOutcome,
      mechanism: offer.mechanism,
      deliverables: offer.deliverables,
      pricePresentation: offer.pricePresentation,
      priceText: offer.priceText,
      excludedOutcomes: offer.excludedOutcomes,
      guarantee: offer.guarantee,
      ctaRoute: offer.ctaRoute,
      status: offer.status,
      approvalStatus: offer.approvalStatus,
      versionNumber: 1,
      changeType: "ADDED",
      changedById: strategist.id,
    },
  });

  const proofItem = await prisma.proofItem.create({
    data: {
      clientId: client.id,
      offerId: offer.id,
      proofType: "RESULT",
      whatHappened: "A client increased contribution profit by 22% after cutting a high-ROAS but poor-lead-quality campaign.",
      whoForWhom: "A marketing manager at a mid-size B2B company",
      startingPoint: "Scaling a high-ROAS campaign with poor lead quality",
      whatChanged: "Contribution profit",
      overPeriod: "One quarter",
      contributingFactors: "Cutting the campaign and reallocating budget toward a lead-quality and handoff review",
      limitations: ["A single client result, not independently audited"],
      publicUseStatus: "PUBLIC",
      evidenceStrength: "STRONG",
      needsReview: false,
      approvalStatus: "APPROVED",
      createdById: strategist.id,
    },
  });

  // --- Script Intelligence Fields: facts with no existing normalized home ---
  const contentObjectiveField = await prisma.scriptIntelligenceField.create({
    data: {
      clientId: client.id,
      sourceEntityType: "GuidedSetupAnswer",
      sourceEntityId: "seed",
      fieldKey: "content_objective",
      normalizedValue: "BELIEF_CHANGE",
      scriptImpacts: ["ANGLE", "CTA", "BODY"],
      approvalStatus: "APPROVED",
      confidence: 0.95,
    },
  });
  const voiceTechnicalityField = await prisma.scriptIntelligenceField.create({
    data: {
      clientId: client.id,
      sourceEntityType: "GuidedSetupAnswer",
      sourceEntityId: "seed",
      fieldKey: "voice_technicality",
      normalizedValue: "SIMPLE_WITH_BUSINESS_TERMS",
      scriptImpacts: ["VOICE"],
      approvalStatus: "APPROVED",
      confidence: 0.9,
    },
  });
  const voiceGoodExampleField = await prisma.scriptIntelligenceField.create({
    data: {
      clientId: client.id,
      sourceEntityType: "GuidedSetupAnswer",
      sourceEntityId: "seed",
      fieldKey: "voice_good_example",
      normalizedValue: "مش المهم الـ ROAS عالي، المهم الشركة فعلاً بتكسب فلوس أكتر.",
      scriptImpacts: ["VOICE"],
      approvalStatus: "APPROVED",
      confidence: 0.9,
    },
  });
  const voiceBadExampleField = await prisma.scriptIntelligenceField.create({
    data: {
      clientId: client.id,
      sourceEntityType: "GuidedSetupAnswer",
      sourceEntityId: "seed",
      fieldKey: "voice_bad_example",
      normalizedValue: "احنا هنفجر مبيعاتك في أسبوع واحد بس! 🚀🔥",
      scriptImpacts: ["VOICE"],
      approvalStatus: "APPROVED",
      confidence: 0.9,
    },
  });

  // --- A completed Guided Setup session, with every answer traced back to the existing approved data it reused ---
  const guidedSession = await prisma.guidedSetupSession.create({
    data: {
      clientId: client.id,
      userId: strategist.id,
      entryMode: "FULL_GUIDED",
      status: "COMPLETED",
      completedAt: now,
    },
  });

  const guidedAnswers: {
    questionKey: string;
    rawAnswer: string;
    sourceReference: string;
  }[] = [
    { questionKey: "business.client_name", rawAnswer: client.displayName, sourceReference: client.id },
    { questionKey: "business.what_they_sell", rawAnswer: whatTheySellItem.valueText!, sourceReference: whatTheySellItem.id },
    { questionKey: "business.content_objective", rawAnswer: "BELIEF_CHANGE", sourceReference: contentObjectiveField.id },
    { questionKey: "audience.who", rawAnswer: mainCohort.name, sourceReference: mainCohort.id },
    { questionKey: "audience.active_problem", rawAnswer: mainSituation.activeProblem!, sourceReference: mainSituation.id },
    { questionKey: "audience.trigger", rawAnswer: mainSituation.triggerDescription!, sourceReference: mainSituation.id },
    { questionKey: "belief.observed_situation", rawAnswer: approvedBelief.observedSituation!, sourceReference: approvedBelief.id },
    { questionKey: "belief.current_belief", rawAnswer: approvedBelief.currentBeliefStatement, sourceReference: approvedBelief.id },
    { questionKey: "belief.behavior_caused", rawAnswer: approvedBelief.behaviorCaused!, sourceReference: approvedBelief.id },
    { questionKey: "belief.commercial_consequence", rawAnswer: approvedBelief.commercialConsequence!, sourceReference: approvedBelief.id },
    { questionKey: "belief.better_belief", rawAnswer: approvedBelief.betterBeliefStatement!, sourceReference: approvedBelief.id },
    { questionKey: "belief.better_decision", rawAnswer: approvedBelief.betterCommercialDecision!, sourceReference: approvedBelief.id },
    { questionKey: "offer.has_offer", rawAnswer: "true", sourceReference: offer.id },
    { questionKey: "offer.name", rawAnswer: offer.name, sourceReference: offer.id },
    { questionKey: "offer.cta_route", rawAnswer: offer.ctaRoute!, sourceReference: offer.id },
    { questionKey: "voice.good_example", rawAnswer: voiceGoodExampleField.normalizedValue, sourceReference: voiceGoodExampleField.id },
    { questionKey: "voice.bad_example", rawAnswer: voiceBadExampleField.normalizedValue, sourceReference: voiceBadExampleField.id },
    { questionKey: "safety.never_claim", rawAnswer: prohibitedClaimItem.valueText!, sourceReference: prohibitedClaimItem.id },
  ];

  for (const answer of guidedAnswers) {
    await prisma.guidedSetupAnswer.create({
      data: {
        sessionId: guidedSession.id,
        clientId: client.id,
        questionKey: answer.questionKey,
        rawAnswer: answer.rawAnswer,
        normalizedValue: answer.rawAnswer,
        sourceType: "EXISTING_CLIENT_BRAIN_ITEM",
        sourceReference: answer.sourceReference,
        confidence: 0.9,
        approvalStatus: "APPROVED",
        reviewedById: strategist.id,
        reviewedAt: now,
      },
    });
  }

  // --- Compile the authorized ScriptGenerationContext by hand (mirrors scriptContextCompiler's output shape) ---
  const seededContext: ScriptGenerationContext = {
    meta: {
      contextId: `ctx_seed_${mainCohort.id}`,
      clientId: client.id,
      cohortId: mainCohort.id,
      generatedAt: now.toISOString(),
      version: 1,
    },
    request: {
      cohortId: mainCohort.id,
      contentObjective: "BELIEF_CHANGE",
      platform: "INSTAGRAM_REELS",
      offerId: offer.id,
      beliefMapId: approvedBelief.id,
      commercialSituationId: mainSituation.id,
      ctaRoute: offer.ctaRoute,
      format: "TALKING_HEAD",
      durationSeconds: 50,
    },
    business: {
      whatTheySell: whatTheySellItem.valueText,
      businessModel: null,
      category: "Commercial Marketing Belief Reframer",
    },
    audience: {
      cohortName: mainCohort.name,
      role: mainCohort.role,
      activeProblem: mainSituation.activeProblem,
      triggerDescription: mainSituation.triggerDescription,
      currentWorkflow: mainCohort.currentWorkflow,
      desiredOutcome: mainCohort.desiredOutcome,
      decisionRisk: mainCohort.decisionRisk,
      platformPresence: mainCohort.platformPresence,
    },
    beliefChain: {
      observedSituation: approvedBelief.observedSituation,
      currentInterpretation: approvedBelief.currentInterpretation,
      currentBeliefStatement: approvedBelief.currentBeliefStatement,
      behaviorCaused: approvedBelief.behaviorCaused,
      commercialConsequence: approvedBelief.commercialConsequence,
      betterBeliefStatement: approvedBelief.betterBeliefStatement,
      betterCommercialDecision: approvedBelief.betterCommercialDecision,
    },
    offer: {
      name: offer.name,
      forWhom: offer.forWhom,
      corePromise: offer.corePromise,
      intendedOutcome: offer.intendedOutcome,
      mechanism: offer.mechanism,
      deliverables: offer.deliverables,
      pricePresentation: offer.pricePresentation,
      priceText: offer.priceText,
      guarantee: offer.guarantee,
      ctaRoute: offer.ctaRoute,
    },
    proof: [
      {
        proofType: proofItem.proofType,
        whatHappened: proofItem.whatHappened,
        whoForWhom: proofItem.whoForWhom,
        startingPoint: proofItem.startingPoint,
        whatChanged: proofItem.whatChanged,
        overPeriod: proofItem.overPeriod,
        limitations: proofItem.limitations,
        evidenceStrength: proofItem.evidenceStrength,
        publicUseStatus: proofItem.publicUseStatus,
      },
    ],
    voice: {
      language: "Egyptian Arabic",
      dialect: null,
      tones: ["Direct, calm authority; Egyptian Arabic with natural English business terminology."],
      vocabulary: [],
      prohibitedPhrases: ["No exaggerated creator language."],
      technicality: voiceTechnicalityField.normalizedValue,
      goodExample: voiceGoodExampleField.normalizedValue,
      badExample: voiceBadExampleField.normalizedValue,
      languageMixing: "Egyptian Arabic with natural English business terminology mixed in.",
    },
    execution: {
      platform: "INSTAGRAM_REELS",
      format: "TALKING_HEAD",
      durationSeconds: 50,
      speaker: "Kamal (client)",
      editingLevel: "MODERATE",
      cannotShow: [],
    },
    safety: {
      neverClaim: [prohibitedClaimItem.valueText!],
      legalRestrictions: [],
      avoidTopics: [],
      testimonialsPublic: true,
      requiresApproval: false,
      expiredClaims: [],
    },
    grounding: {
      sourceReferences: [
        { entityType: "Cohort", entityId: mainCohort.id, field: "name", approvalStatus: "APPROVED", approvedAt: now.toISOString() },
        { entityType: "CommercialSituation", entityId: mainSituation.id, field: "activeProblem", approvalStatus: "APPROVED", approvedAt: now.toISOString() },
        { entityType: "BeliefMap", entityId: approvedBelief.id, field: "currentBeliefStatement", approvalStatus: "APPROVED", approvedAt: now.toISOString() },
        { entityType: "Offer", entityId: offer.id, field: "corePromise", approvalStatus: "APPROVED", approvedAt: now.toISOString() },
        { entityType: "ProofItem", entityId: proofItem.id, field: "whatHappened", approvalStatus: "APPROVED", approvedAt: now.toISOString() },
        { entityType: "ClientBrainItem", entityId: whatTheySellItem.id, field: "PRODUCTS_SERVICES", approvalStatus: "ACTIVE", approvedAt: now.toISOString() },
        { entityType: "ClientBrainItem", entityId: prohibitedClaimItem.id, field: "CLAIM", approvalStatus: "ACTIVE", approvedAt: now.toISOString() },
      ],
      missingCriticalInputWarnings: [],
    },
  };
  ScriptGenerationContextSchema.parse(seededContext);

  const contextSnapshot = await prisma.scriptContextSnapshot.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      generationPurpose: "reel:BELIEF_CHANGE",
      compiledContext: seededContext,
      sourceManifest: seededContext.grounding.sourceReferences,
      readiness: { warnings: [] },
      warnings: [],
      createdById: strategist.id,
    },
  });

  // --- The seeded first Reel: a belief-changing script built from the chain above ---
  const scriptFullText = [
    "You're not failing at marketing. You're measuring the wrong thing.",
    "Managers keep hitting their lead targets, then the CEO says the company still isn't making more money.",
    "Sales conversion dropped 15% this quarter even though marketing hit every lead target.",
    "So the instinct is: keep the ROAS high, and marketing did its job.",
    "But high ROAS on the wrong leads just moves the blame downstream — sales still can't close them.",
    "One client proved this: cutting a high-ROAS, poor-lead-quality campaign raised contribution profit by 22 percent.",
    "Marketing efficiency has to be judged inside the whole commercial model, not by one isolated number. That means auditing the handoff before you scale spend.",
    "Book a CEO Marketing Decision Session to walk through your own numbers.",
  ].join(" ");
  const seededWordCount = scriptFullText.split(/\s+/).filter(Boolean).length;
  const arabicWordsPerMinute = 130;
  const seededDurationSeconds = Math.round((seededWordCount / arabicWordsPerMinute) * 60);

  const draftPackage: ReelScriptPackage = {
    meta: {
      packageId: `pkg_seed_${contextSnapshot.id}`,
      clientId: client.id,
      cohortId: mainCohort.id,
      contextSnapshotId: contextSnapshot.id,
      generatedAt: now.toISOString(),
      contentObjective: "BELIEF_CHANGE",
      platform: "INSTAGRAM_REELS",
    },
    strategy: {
      funnelStage: "Mid funnel — reframing a belief",
      cognitiveObjective: "Replace a wrong belief with a better one",
      coreTakeaway: "Marketing efficiency must be judged inside the whole commercial model, not by ROAS alone.",
      beliefShiftFrom: approvedBelief.currentBeliefStatement,
      beliefShiftTo: approvedBelief.betterBeliefStatement,
      rationale: "Grounded in the approved belief chain and the 22% contribution-profit case for this cohort.",
    },
    hookOptions: [
      { hookType: "EDUCATIONAL", text: "You're not failing at marketing. You're measuring the wrong thing.", rationale: "States the reframe directly." },
      { hookType: "CONTRARIAN", text: "High ROAS is not proof your marketing is working.", rationale: "Directly contradicts the common belief." },
      {
        hookType: "STORY",
        text: "A marketing manager told me: 'We keep scaling ROAS, but the CEO says we're still not making more money.'",
        rationale: "Opens with a relatable, specific quote.",
      },
    ],
    selectedHookIndex: 0,
    script: {
      segments: [
        { type: "HOOK", text: "You're not failing at marketing. You're measuring the wrong thing.", visualDirection: "Direct to camera, calm delivery.", estimatedSeconds: 4 },
        {
          type: "LEAD",
          text: "Managers keep hitting their lead targets, then the CEO says the company still isn't making more money.",
          visualDirection: null,
          estimatedSeconds: 6,
        },
        {
          type: "BODY",
          text: "Sales conversion dropped 15% this quarter even though marketing hit every lead target.",
          visualDirection: null,
          estimatedSeconds: 5,
        },
        { type: "REHOOK", text: "So the instinct is: keep the ROAS high, and marketing did its job.", visualDirection: null, estimatedSeconds: 4 },
        {
          type: "BODY",
          text: "But high ROAS on the wrong leads just moves the blame downstream — sales still can't close them.",
          visualDirection: null,
          estimatedSeconds: 6,
        },
        {
          type: "REHOOK",
          text: "One client proved this: cutting a high-ROAS, poor-lead-quality campaign raised contribution profit by 22 percent.",
          visualDirection: "Cut to a simple on-screen stat card showing the 22% result.",
          estimatedSeconds: 7,
        },
        {
          type: "PAYOFF",
          text: "Marketing efficiency has to be judged inside the whole commercial model, not by one isolated number. That means auditing the handoff before you scale spend.",
          visualDirection: null,
          estimatedSeconds: 8,
        },
        { type: "CTA", text: "Book a CEO Marketing Decision Session to walk through your own numbers.", visualDirection: null, estimatedSeconds: 4 },
      ],
      fullText: scriptFullText,
      estimatedDurationSeconds: seededDurationSeconds,
      wordCount: seededWordCount,
    },
    production: {
      format: "TALKING_HEAD",
      speaker: "Kamal (client)",
      editingLevel: "MODERATE",
      visualPlan: ["Direct to camera, calm and direct delivery throughout.", "Cut to a simple on-screen stat card for the 22% contribution-profit result."],
      resources: ["Phone or camera, no special equipment"],
    },
    commercial: {
      portfolioRole: "COMMERCIAL_ASK",
      ctaType: "BOOK",
      ctaText: "Book a CEO Marketing Decision Session to walk through your own numbers.",
      promotionalIntensity: "LIGHT",
      claimStatus: "APPROVED",
    },
    audits: {
      strategicGrounding: { status: "PASS", note: "pending" },
      voiceAlignment: { status: "PASS", note: "pending" },
      claimSafety: { status: "PASS", note: "pending" },
      comprehension: { status: "PASS", note: "pending" },
      platformFit: { status: "PASS", note: "pending" },
      productionFeasibility: { status: "PASS", note: "pending" },
    },
    sources: seededContext.grounding.sourceReferences.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId, field: ref.field })),
    warnings: [],
    optionalAlternatives: [{ type: "HOOK", label: "Myth-busting angle", description: "Lead with a direct 'ROAS is a myth' framing instead of the plain statement." }],
  };

  const seededGates = computeReelValidation(seededContext, draftPackage);
  const seededValidation = { gates: seededGates, readyToMarkReady: isReadyToMarkReady(seededGates, []), overrides: [] };
  const finalPackage: ReelScriptPackage = { ...draftPackage, audits: summarizeGatesForPackage(seededGates) };
  ReelScriptPackageSchema.parse(finalPackage);

  const reelGeneration = await prisma.reelGeneration.create({
    data: {
      clientId: client.id,
      cohortId: mainCohort.id,
      contextSnapshotId: contextSnapshot.id,
      status: seededValidation.readyToMarkReady ? "READY" : "DRAFT",
      currentVersionNumber: 1,
      createdById: strategist.id,
    },
  });
  await prisma.reelVersion.create({
    data: {
      reelGenerationId: reelGeneration.id,
      packageJson: finalPackage,
      selectedHookIndex: finalPackage.selectedHookIndex,
      validationJson: seededValidation,
      versionNumber: 1,
      createdById: strategist.id,
    },
  });

  const pendingCount = await prisma.importReview.count({ where: { clientId: client.id, status: "PENDING" } });
  const brainCount = await prisma.clientBrainItem.count({ where: { clientId: client.id } });
  const cohortCount = await prisma.cohort.count({ where: { clientId: client.id } });
  const beliefCount = await prisma.beliefMap.count({ where: { clientId: client.id } });
  const suggestionCount = await prisma.strategySuggestion.count({ where: { clientId: client.id, status: "AI_SUGGESTED" } });

  console.log("Seed complete:");
  console.log(`  Organization: ${org.slug}`);
  console.log(`  Users: owner@demo-agency.test / strategist@demo-agency.test / approver@demo-agency.test (all password123)`);
  console.log(`  Client: ${client.displayName} (${client.id})`);
  console.log(`  Client Brain items: ${brainCount}`);
  console.log(`  Pending reviews: ${pendingCount}`);
  console.log(`  Open conflicts: 1 (OFFERS/PRICE — 45,000 vs 30,000 EGP)`);
  console.log(`  Strategy cohorts: ${cohortCount}`);
  console.log(`  Belief maps: ${beliefCount}`);
  console.log(`  Pending AI strategy suggestions: ${suggestionCount}`);
  console.log(`  Guided setup session: completed, ${guidedAnswers.length} answers traced to existing approved data`);
  console.log(`  Seeded first Reel: ${reelGeneration.id} (status: ${reelGeneration.status})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
