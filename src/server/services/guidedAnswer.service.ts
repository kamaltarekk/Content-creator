import "server-only";

import type { ClientBrainFieldKey, ClientBrainSectionKey, GuidedSetupQuestionDefinition, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { getAIProvider } from "@/server/providers/ai/openai.provider";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { createManualBrainItem, editBrainItem } from "@/server/services/clientBrain.service";
import { createCohort, updateCohort } from "@/server/services/cohort.service";
import { createCommercialSituation, updateCommercialSituation } from "@/server/services/commercialSituation.service";
import { createBeliefMap, updateBeliefMap } from "@/server/services/belief.service";
import { SECTION_ORDER, listActiveQuestions } from "@/server/services/guidedQuestion.service";
import type { ConditionalLogic } from "@/server/domain/guided-question-catalog";

export type AnswerValue = string | string[] | boolean | number;

function toDisplayString(value: AnswerValue): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function parseClientBrainDestination(destinationField: string): { section: ClientBrainSectionKey; field: ClientBrainFieldKey } {
  const [section, field] = destinationField.split(":");
  return { section: section as ClientBrainSectionKey, field: field as ClientBrainFieldKey };
}

/** The marker question whose sourceReference is the id of the entity this session is building for that destination. */
const WORKING_ENTITY_MARKER: Record<string, string> = {
  Cohort: "audience.who",
  CommercialSituation: "audience.active_problem",
  BeliefMap: "belief.current_belief",
  Offer: "offer.name",
  ProofItem: "proof.type",
};

async function resolveWorkingEntityId(sessionId: string, destinationEntity: string): Promise<string | null> {
  const markerKey = WORKING_ENTITY_MARKER[destinationEntity];
  if (!markerKey) return null;
  const marker = await prisma.guidedSetupAnswer.findUnique({
    where: { sessionId_questionKey: { sessionId, questionKey: markerKey } },
  });
  return marker?.sourceReference ?? null;
}

function conditionsSatisfied(logic: ConditionalLogic, answersByKey: Map<string, string | null>): boolean {
  if (!logic) return true;
  const raw = answersByKey.get(logic.dependsOnKey);
  if (raw === undefined) return false;
  if (logic.equals !== undefined) return raw === String(logic.equals);
  if (logic.notEquals !== undefined) return raw !== String(logic.notEquals);
  return true;
}

export type TrustedAnswer = {
  value: string;
  sourceType: "EXISTING_CLIENT_BRAIN_ITEM" | "EXISTING_STRATEGY_ENTITY";
  sourceReference: string;
  confidence: number | null;
};

/**
 * Source-priority hierarchy (spec section 8): an existing approved answer
 * always outranks asking the user. Never re-asks a question a trusted
 * source can already answer — only offers it for confirmation.
 */
export async function findTrustedAnswer(params: {
  clientId: string;
  sessionId: string;
  question: GuidedSetupQuestionDefinition;
}): Promise<TrustedAnswer | null> {
  const { clientId, sessionId, question } = params;

  if (question.destinationEntity === "Client") {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    const value = question.destinationField === "brandType" ? client.brandType : client.displayName;
    return value ? { value, sourceType: "EXISTING_STRATEGY_ENTITY", sourceReference: client.id, confidence: 1 } : null;
  }

  if (question.destinationEntity === "ClientBrainItem" && question.destinationField) {
    const { section, field } = parseClientBrainDestination(question.destinationField);
    const item = await prisma.clientBrainItem.findFirst({
      where: { clientId, sectionKey: section, fieldKey: field, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });
    if (item?.valueText) {
      return { value: item.valueText, sourceType: "EXISTING_CLIENT_BRAIN_ITEM", sourceReference: item.id, confidence: item.confidence };
    }
    return null;
  }

  if (question.destinationEntity === "ScriptIntelligenceField" && question.destinationField) {
    const field = await prisma.scriptIntelligenceField.findFirst({
      where: { clientId, fieldKey: question.destinationField, approvalStatus: "APPROVED" },
      orderBy: { updatedAt: "desc" },
    });
    return field ? { value: field.normalizedValue, sourceType: "EXISTING_STRATEGY_ENTITY", sourceReference: field.id, confidence: field.confidence } : null;
  }

  const workingId = await resolveWorkingEntityId(sessionId, question.destinationEntity ?? "");
  if (!workingId || !question.destinationField) return null;

  if (question.destinationEntity === "Cohort") {
    const cohort = await prisma.cohort.findUnique({ where: { id: workingId } });
    const value = cohort ? (cohort as unknown as Record<string, unknown>)[question.destinationField] : null;
    return formatEntityValue(value, workingId, cohort?.confidence ?? null);
  }
  if (question.destinationEntity === "CommercialSituation") {
    const situation = await prisma.commercialSituation.findUnique({ where: { id: workingId } });
    const value = situation ? (situation as unknown as Record<string, unknown>)[question.destinationField] : null;
    return formatEntityValue(value, workingId, situation?.confidence ?? null);
  }
  if (question.destinationEntity === "BeliefMap") {
    const belief = await prisma.beliefMap.findUnique({ where: { id: workingId } });
    const value = belief ? (belief as unknown as Record<string, unknown>)[question.destinationField] : null;
    return formatEntityValue(value, workingId, belief?.confidence ?? null);
  }
  if (question.destinationEntity === "Offer") {
    const offer = await prisma.offer.findUnique({ where: { id: workingId } });
    const value = offer ? (offer as unknown as Record<string, unknown>)[question.destinationField] : null;
    return formatEntityValue(value, workingId, null);
  }
  if (question.destinationEntity === "ProofItem") {
    const proof = await prisma.proofItem.findUnique({ where: { id: workingId } });
    const value = proof ? (proof as unknown as Record<string, unknown>)[question.destinationField] : null;
    return formatEntityValue(value, workingId, null);
  }

  return null;
}

function formatEntityValue(value: unknown, sourceReference: string, confidence: number | null): TrustedAnswer | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  if (!display.trim()) return null;
  return { value: display, sourceType: "EXISTING_STRATEGY_ENTITY", sourceReference, confidence };
}

/**
 * Finds the next eligible question: skips already-answered questions and
 * ones whose conditional logic isn't satisfied, walking sections in order.
 * Returns null once every section is exhausted (setup is ready for Final Review).
 */
export async function getNextQuestion(sessionId: string, clientId: string) {
  const [answers, allQuestions] = await Promise.all([
    prisma.guidedSetupAnswer.findMany({ where: { sessionId } }),
    listActiveQuestions(),
  ]);
  const answersByKey = new Map(answers.map((a) => [a.questionKey, a.normalizedValue]));
  const questionsBySection = new Map<string, GuidedSetupQuestionDefinition[]>();
  for (const q of allQuestions) {
    const list = questionsBySection.get(q.section) ?? [];
    list.push(q);
    questionsBySection.set(q.section, list);
  }

  for (const section of SECTION_ORDER) {
    const questions = questionsBySection.get(section) ?? [];
    for (const question of questions) {
      if (answersByKey.has(question.key)) continue;
      if (!conditionsSatisfied(question.conditionalLogic as ConditionalLogic, answersByKey)) continue;

      const trusted = await findTrustedAnswer({ clientId, sessionId, question });
      return { question, section, trusted };
    }
  }

  return null;
}

export type SubmitAnswerParams = {
  sessionId: string;
  clientId: string;
  organizationId: string;
  userId: string;
  questionKey: string;
  value: AnswerValue;
  sourceType?: "USER_INPUT" | "EXISTING_CLIENT_BRAIN_ITEM" | "EXISTING_STRATEGY_ENTITY" | "AI_SUGGESTION";
  confidence?: number;
};

export async function submitAnswer(params: SubmitAnswerParams) {
  const question = await prisma.guidedSetupQuestionDefinition.findUniqueOrThrow({ where: { key: params.questionKey } });
  const normalizedValue = toDisplayString(params.value);

  const sourceReference = await applyAnswerToDestination({
    clientId: params.clientId,
    organizationId: params.organizationId,
    userId: params.userId,
    sessionId: params.sessionId,
    question,
    value: params.value,
  });

  const answer = await prisma.guidedSetupAnswer.upsert({
    where: { sessionId_questionKey: { sessionId: params.sessionId, questionKey: params.questionKey } },
    create: {
      sessionId: params.sessionId,
      clientId: params.clientId,
      questionKey: params.questionKey,
      rawAnswer: normalizedValue,
      normalizedValue,
      sourceType: params.sourceType ?? "USER_INPUT",
      confidence: params.confidence ?? 1,
      approvalStatus: "APPROVED",
      sourceReference,
      reviewedById: params.userId,
      reviewedAt: new Date(),
    },
    update: {
      rawAnswer: normalizedValue,
      normalizedValue,
      sourceType: params.sourceType ?? "USER_INPUT",
      confidence: params.confidence ?? 1,
      approvalStatus: "APPROVED",
      sourceReference,
      reviewedById: params.userId,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.userId,
    action: "CREATE",
    entityType: "GuidedSetupAnswer",
    entityId: answer.id,
    metadata: { questionKey: params.questionKey },
  });

  return answer;
}

/** "I don't know" / "Not applicable" — resolves the question without writing anything to a destination entity. */
export async function skipQuestion(params: { sessionId: string; clientId: string; questionKey: string; reason: "DONT_KNOW" | "NOT_APPLICABLE" }) {
  return prisma.guidedSetupAnswer.upsert({
    where: { sessionId_questionKey: { sessionId: params.sessionId, questionKey: params.questionKey } },
    create: {
      sessionId: params.sessionId,
      clientId: params.clientId,
      questionKey: params.questionKey,
      rawAnswer: params.reason,
      sourceType: "USER_INPUT",
      approvalStatus: "DRAFT",
    },
    update: { rawAnswer: params.reason, approvalStatus: "DRAFT" },
  });
}

/** "Let AI suggest" — never auto-applied; the reviewer must confirm via submitAnswer before it's written anywhere. */
export async function requestAiSuggestion(params: { clientId: string; questionKey: string; providerOverride?: AIProvider }) {
  const [client, question] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: params.clientId } }),
    prisma.guidedSetupQuestionDefinition.findUniqueOrThrow({ where: { key: params.questionKey } }),
  ]);

  const brainDigest = await prisma.clientBrainItem.findMany({
    where: { clientId: params.clientId, status: "ACTIVE" },
    select: { sectionKey: true, valueText: true },
    take: 30,
  });

  const provider = params.providerOverride ?? getAIProvider();
  return provider.suggestGuidedAnswer({
    question: question.userFacingQuestion,
    helperText: question.helperText,
    example: question.example,
    clientContext: {
      clientName: client.displayName,
      brandType: client.brandType,
      existingBrainDigest: brainDigest.map((i) => `[${i.sectionKey}] ${i.valueText}`).join("\n"),
    },
  });
}

async function applyAnswerToDestination(params: {
  clientId: string;
  organizationId: string;
  userId: string;
  sessionId: string;
  question: GuidedSetupQuestionDefinition;
  value: AnswerValue;
}): Promise<string | null> {
  const { clientId, organizationId, userId, sessionId, question, value } = params;

  switch (question.destinationEntity) {
    case "Client": {
      const data: Prisma.ClientUpdateInput =
        question.destinationField === "brandType" ? { brandType: value as never } : { displayName: String(value) };
      const client = await prisma.client.update({ where: { id: clientId }, data });
      return client.id;
    }

    case "ClientBrainItem": {
      if (!question.destinationField) return null;
      const { section, field } = parseClientBrainDestination(question.destinationField);
      const existing = await prisma.clientBrainItem.findFirst({ where: { clientId, sectionKey: section, fieldKey: field, status: "ACTIVE" } });
      if (existing) {
        const updated = await editBrainItem({ itemId: existing.id, organizationId, userId, valueText: toDisplayString(value) });
        return updated.id;
      }
      const created = await createManualBrainItem({
        clientId,
        organizationId,
        userId,
        sectionKey: section,
        fieldKey: field,
        valueText: toDisplayString(value),
      });
      return created.id;
    }

    case "ScriptIntelligenceField": {
      if (!question.destinationField) return null;
      const field = await prisma.scriptIntelligenceField.upsert({
        where: { clientId_fieldKey: { clientId, fieldKey: question.destinationField } },
        create: {
          clientId,
          sourceEntityType: "GuidedSetupAnswer",
          sourceEntityId: sessionId,
          fieldKey: question.destinationField,
          normalizedValue: toDisplayString(value),
          scriptImpacts: question.scriptImpacts,
          approvalStatus: "APPROVED",
          confidence: 1,
        },
        update: { normalizedValue: toDisplayString(value), approvalStatus: "APPROVED" },
      });
      return field.id;
    }

    case "Cohort": {
      const existingId = await resolveWorkingEntityId(sessionId, "Cohort");
      const fieldPatch = cohortFieldPatch(question.destinationField, value);
      if (existingId) {
        const existing = await prisma.cohort.findUniqueOrThrow({ where: { id: existingId } });
        const updated = await updateCohort({
          cohortId: existingId,
          organizationId,
          actorUserId: userId,
          input: {
            name: existing.name,
            definition: existing.definition,
            priority: existing.priority,
            role: existing.role,
            commercialContext: existing.commercialContext,
            currentWorkflow: existing.currentWorkflow,
            currentBelief: existing.currentBelief,
            desiredOutcome: existing.desiredOutcome,
            decisionRisk: existing.decisionRisk,
            emotionalDrivers: existing.emotionalDrivers,
            platformPresence: existing.platformPresence,
            attentionNotes: existing.attentionNotes,
            ...fieldPatch,
          },
        });
        return updated.id;
      }
      const created = await createCohort({
        clientId,
        organizationId,
        actorUserId: userId,
        input: { name: String(value), ...fieldPatch },
      });
      return created.id;
    }

    case "CommercialSituation": {
      const cohortId = await resolveWorkingEntityId(sessionId, "Cohort");
      if (!cohortId) return null;
      const existingId = await resolveWorkingEntityId(sessionId, "CommercialSituation");
      const fieldPatch = situationFieldPatch(question.destinationField, value);
      if (existingId) {
        const existing = await prisma.commercialSituation.findUniqueOrThrow({ where: { id: existingId } });
        const updated = await updateCommercialSituation({
          situationId: existingId,
          organizationId,
          actorUserId: userId,
          input: {
            title: existing.title,
            triggerType: existing.triggerType,
            triggerDescription: existing.triggerDescription,
            activeProblem: existing.activeProblem,
            currentWorkflow: existing.currentWorkflow,
            urgencyNote: existing.urgencyNote,
            ...fieldPatch,
          },
        });
        return updated.id;
      }
      const created = await createCommercialSituation({
        clientId,
        cohortId,
        organizationId,
        actorUserId: userId,
        input: { title: String(value), triggerType: "OTHER", ...fieldPatch },
      });
      return created.id;
    }

    case "BeliefMap": {
      const cohortId = await resolveWorkingEntityId(sessionId, "Cohort");
      if (!cohortId) return null;
      const existingId = await resolveWorkingEntityId(sessionId, "BeliefMap");
      const fieldPatch = beliefFieldPatch(question.destinationField, value);
      if (existingId) {
        const existing = await prisma.beliefMap.findUniqueOrThrow({ where: { id: existingId } });
        const updated = await updateBeliefMap({
          beliefMapId: existingId,
          organizationId,
          actorUserId: userId,
          input: {
            observedSituation: existing.observedSituation,
            currentInterpretation: existing.currentInterpretation,
            currentBeliefStatement: existing.currentBeliefStatement,
            beliefType: existing.beliefType,
            behaviorCaused: existing.behaviorCaused,
            commercialConsequence: existing.commercialConsequence,
            betterBeliefStatement: existing.betterBeliefStatement,
            betterCommercialDecision: existing.betterCommercialDecision,
            relevantOfferPlaceholder: existing.relevantOfferPlaceholder,
            ...fieldPatch,
          },
        });
        return updated.id;
      }
      const created = await createBeliefMap({
        clientId,
        cohortId,
        organizationId,
        actorUserId: userId,
        input: { currentBeliefStatement: String(value), ...fieldPatch },
      });
      return created.id;
    }

    case "Offer": {
      const existingId = await resolveWorkingEntityId(sessionId, "Offer");
      const patch = offerFieldPatch(question.destinationField, value);
      if (existingId) {
        const updated = await prisma.offer.update({ where: { id: existingId }, data: patch as Prisma.OfferUpdateInput });
        return updated.id;
      }
      const created = await prisma.offer.create({
        data: { clientId, name: String(value), createdById: userId, ...patch } as Prisma.OfferUncheckedCreateInput,
      });
      return created.id;
    }

    case "ProofItem": {
      const existingId = await resolveWorkingEntityId(sessionId, "ProofItem");
      const patch = proofFieldPatch(question.destinationField, value);
      if (existingId) {
        const updated = await prisma.proofItem.update({ where: { id: existingId }, data: patch as Prisma.ProofItemUpdateInput });
        return updated.id;
      }
      const offerId = await resolveWorkingEntityId(sessionId, "Offer");
      const created = await prisma.proofItem.create({
        data: { clientId, offerId, proofType: "EXPERIENCE", createdById: userId, ...patch } as Prisma.ProofItemUncheckedCreateInput,
      });
      return created.id;
    }

    default:
      return null;
  }
}

function cohortFieldPatch(field: string | null, value: AnswerValue) {
  if (!field) return {};
  if (field === "platformPresence" || field === "emotionalDrivers") return { [field]: Array.isArray(value) ? value : [String(value)] };
  return { [field]: String(value) };
}

function situationFieldPatch(field: string | null, value: AnswerValue) {
  if (!field) return {};
  return { [field]: String(value) };
}

function beliefFieldPatch(field: string | null, value: AnswerValue) {
  if (!field) return {};
  return { [field]: String(value) };
}

function offerFieldPatch(field: string | null, value: AnswerValue): Record<string, unknown> {
  if (!field) return {};
  if (field === "deliverables" || field === "excludedOutcomes") {
    const list = Array.isArray(value) ? value : String(value).split("\n").map((s) => s.trim()).filter(Boolean);
    return { [field]: list };
  }
  if (field === "pricePresentation") return { pricePresentation: value };
  return { [field]: String(value) };
}

export type SetupSummary = {
  clientName: string;
  audience: string | null;
  whatIsHappening: string | null;
  beliefToChallenge: string | null;
  betterUnderstanding: string | null;
  betterDecision: string | null;
  offerName: string | null;
  ctaRoute: string | null;
  voice: string | null;
  allAnswers: { section: string; label: string; value: string }[];
};

/** The Final Review screen's plain-language summary (spec section 18) — never raw JSON, never technical field names. */
export async function getSetupSummary(clientId: string): Promise<SetupSummary> {
  const [client, cohort, offer, latestSession] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.cohort.findFirst({ where: { clientId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" } }),
    prisma.offer.findFirst({ where: { clientId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" } }),
    prisma.guidedSetupSession.findFirst({ where: { clientId }, orderBy: { startedAt: "desc" } }),
  ]);

  const [situation, belief] = cohort
    ? await Promise.all([
        prisma.commercialSituation.findFirst({ where: { cohortId: cohort.id }, orderBy: { updatedAt: "desc" } }),
        prisma.beliefMap.findFirst({ where: { cohortId: cohort.id, archivedAt: null }, orderBy: { updatedAt: "desc" } }),
      ])
    : [null, null];

  const answers = latestSession
    ? await prisma.guidedSetupAnswer.findMany({ where: { sessionId: latestSession.id, approvalStatus: "APPROVED" } })
    : [];
  const questions = await prisma.guidedSetupQuestionDefinition.findMany({ where: { key: { in: answers.map((a) => a.questionKey) } } });
  const questionByKey = new Map(questions.map((q) => [q.key, q]));

  const allAnswers = answers
    .filter((a) => a.normalizedValue)
    .map((a) => {
      const q = questionByKey.get(a.questionKey);
      return { section: q?.section ?? "BUSINESS", label: q?.plainLanguageLabel ?? a.questionKey, value: a.normalizedValue! };
    });

  const voiceKeys = new Set(["voice.language", "voice.dialect", "voice.tones"]);
  const voiceParts = answers.filter((a) => voiceKeys.has(a.questionKey) && a.normalizedValue).map((a) => a.normalizedValue!);

  return {
    clientName: client.displayName,
    audience: cohort?.name ?? null,
    whatIsHappening: situation?.activeProblem ?? null,
    beliefToChallenge: belief?.currentBeliefStatement ?? null,
    betterUnderstanding: belief?.betterBeliefStatement ?? null,
    betterDecision: belief?.betterCommercialDecision ?? null,
    offerName: offer?.name ?? null,
    ctaRoute: offer?.ctaRoute ?? null,
    voice: voiceParts.length > 0 ? voiceParts.join(", ") : null,
    allAnswers,
  };
}

function proofFieldPatch(field: string | null, value: AnswerValue): Record<string, unknown> {
  if (!field) return {};
  if (field === "limitations") {
    const list = Array.isArray(value) ? value : String(value).split("\n").map((s) => s.trim()).filter(Boolean);
    return { limitations: list };
  }
  if (field === "proofType") return { proofType: value };
  if (field === "publicUseStatus") return { publicUseStatus: value };
  return { [field]: String(value) };
}
