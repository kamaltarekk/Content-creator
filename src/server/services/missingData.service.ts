import "server-only";

import type { ClientBrainSectionKey } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { FIELD_FOLLOWUP_QUESTIONS, FIELD_LABELS, SECTION_LABELS } from "@/server/domain/brain-schema";
import { computeCompleteness, type CompletenessItem } from "@/server/services/completeness.service";

const STRONG_THRESHOLD = 0.8;

export type MissingDataReport = {
  strong: { sectionKey: ClientBrainSectionKey; label: string }[];
  partial: { sectionKey: ClientBrainSectionKey; label: string; coveragePercent: number }[];
  missing: { sectionKey: ClientBrainSectionKey; label: string }[];
  conflicting: { sectionKey: ClientBrainSectionKey; label: string; count: number }[];
  questions: { sectionLabel: string; fieldLabel: string; question: string }[];
};

/**
 * Generates the missing-data report (spec section H) from the live Client
 * Brain: strong / partial / missing coverage areas, sections with open
 * conflicts, and specific follow-up questions derived only from actual gaps
 * (missing critical fields).
 */
export async function generateMissingDataReport(clientId: string): Promise<MissingDataReport> {
  const [items, openConflicts] = await Promise.all([
    prisma.clientBrainItem.findMany({
      where: { clientId },
      select: { sectionKey: true, fieldKey: true, groupId: true, status: true, confidence: true },
    }),
    prisma.conflict.findMany({
      where: { clientId, status: "OPEN" },
      select: { clientBrainItem: { select: { sectionKey: true } } },
    }),
  ]);

  const completeness = computeCompleteness(items as CompletenessItem[]);

  const strong: MissingDataReport["strong"] = [];
  const partial: MissingDataReport["partial"] = [];
  const missing: MissingDataReport["missing"] = [];
  const questions: MissingDataReport["questions"] = [];

  for (const section of completeness.sections) {
    if (section.coverage >= STRONG_THRESHOLD) {
      strong.push({ sectionKey: section.sectionKey, label: section.label });
    } else if (section.coverage > 0) {
      partial.push({
        sectionKey: section.sectionKey,
        label: section.label,
        coveragePercent: Math.round(section.coverage * 100),
      });
    } else {
      missing.push({ sectionKey: section.sectionKey, label: section.label });
    }

    for (const field of section.missingCriticalFields) {
      const question = FIELD_FOLLOWUP_QUESTIONS[field];
      if (question) {
        questions.push({
          sectionLabel: section.label,
          fieldLabel: FIELD_LABELS[field],
          question,
        });
      }
    }
  }

  const conflictCounts = new Map<ClientBrainSectionKey, number>();
  for (const conflict of openConflicts) {
    const key = conflict.clientBrainItem.sectionKey;
    conflictCounts.set(key, (conflictCounts.get(key) ?? 0) + 1);
  }
  const conflicting = Array.from(conflictCounts.entries()).map(([sectionKey, count]) => ({
    sectionKey,
    label: SECTION_LABELS[sectionKey],
    count,
  }));

  return { strong, partial, missing, conflicting, questions };
}

export async function getCompletenessForClient(clientId: string) {
  const items = await prisma.clientBrainItem.findMany({
    where: { clientId },
    select: { sectionKey: true, fieldKey: true, groupId: true, status: true, confidence: true },
  });
  return computeCompleteness(items as CompletenessItem[]);
}
