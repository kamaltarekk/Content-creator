import "server-only";

import { Prisma, type GuidedSetupSection } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { validateQuestionScriptImpact } from "@/server/domain/script-impact";
import { QUESTION_CATALOG, type QuestionCatalogEntry } from "@/server/domain/guided-question-catalog";

/**
 * Syncs the code-defined question catalog into the DB-backed
 * GuidedSetupQuestionDefinition table — the catalog is configurable (an
 * admin could edit rows directly) but ships with a validated, versioned
 * default set. Every entry is re-validated here as a second, deterministic
 * gate in addition to the unit test.
 */
export async function syncQuestionCatalog(): Promise<{ synced: number }> {
  for (const question of QUESTION_CATALOG) {
    const validation = validateQuestionScriptImpact({ key: question.key, scriptImpacts: question.scriptImpacts });
    if (!validation.valid) {
      throw new Error(`Refusing to sync question "${question.key}": ${validation.reason}`);
    }
  }

  for (const question of QUESTION_CATALOG) {
    await prisma.guidedSetupQuestionDefinition.upsert({
      where: { key: question.key },
      update: toRow(question),
      create: { key: question.key, ...toRow(question) },
    });
  }

  return { synced: QUESTION_CATALOG.length };
}

function toRow(question: QuestionCatalogEntry) {
  return {
    section: question.section,
    userFacingQuestion: question.userFacingQuestion,
    helperText: question.helperText,
    example: question.example,
    answerType: question.answerType,
    options: (question.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    requiredLevel: question.requiredLevel,
    scriptImpacts: question.scriptImpacts,
    destinationEntity: question.destinationEntity,
    destinationField: question.destinationField,
    conditionalLogic: (question.conditionalLogic as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    plainLanguageLabel: question.plainLanguageLabel,
    expertLabel: question.expertLabel,
    displayOrder: question.displayOrder,
    isActive: true,
  };
}

export function listActiveQuestions(section?: GuidedSetupSection) {
  return prisma.guidedSetupQuestionDefinition.findMany({
    where: { isActive: true, ...(section ? { section } : {}) },
    orderBy: { displayOrder: "asc" },
  });
}

export function getQuestionByKey(key: string) {
  return prisma.guidedSetupQuestionDefinition.findUnique({ where: { key } });
}

export const SECTION_ORDER: GuidedSetupSection[] = [
  "BUSINESS",
  "AUDIENCE",
  "BELIEF_DECISION",
  "OFFER",
  "PROOF",
  "VOICE",
  "EXECUTION",
  "SAFETY",
];
