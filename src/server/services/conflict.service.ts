import "server-only";

import type { ChangeType, ClientBrainFieldKey, ClientBrainItem } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { fieldValueType } from "@/server/domain/brain-schema";
import { diceCoefficient } from "@/server/domain/similarity";

/** Similarity at or above this means "the same entity instance" when grouping repeatable items. */
export const ENTITY_MATCH_THRESHOLD = 0.75;
/** Free-text similarity at or above this is treated as effectively unchanged (no conflict). */
export const TEXT_UNCHANGED_THRESHOLD = 0.82;
/** Below this, a free-text change is a strong (materially different) conflict. */
export const TEXT_STRONG_CONFLICT_THRESHOLD = 0.5;

export type ComparisonResult = {
  changeType: ChangeType;
  isConflict: boolean;
  similarity: number | null;
  reason: string;
};

function parseNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function toSet(value: string): Set<string> {
  return new Set(
    value
      .split(/[,\n;]/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decides whether a proposed value materially differs from the existing one,
 * comparing per the field's value type (spec section 15):
 *  - percentage/ratio fields tolerate max(2 points, 15%) drift
 *  - numeric price tolerates 10% relative difference
 *  - list fields tolerate pure additions (suggest MERGE); flag >30% removals
 *  - free text uses Dice similarity thresholds
 */
export function compareValues(
  field: ClientBrainFieldKey,
  existingValue: string,
  proposedValue: string,
): ComparisonResult {
  if (existingValue.trim() === proposedValue.trim()) {
    return { changeType: "UNCHANGED", isConflict: false, similarity: 1, reason: "Identical value." };
  }

  const valueType = fieldValueType(field);

  if (valueType === "percentage") {
    const oldNum = parseNumber(existingValue);
    const newNum = parseNumber(proposedValue);
    if (oldNum !== null && newNum !== null) {
      const tolerance = Math.max(2, Math.abs(oldNum) * 0.15);
      const conflict = Math.abs(newNum - oldNum) > tolerance;
      return {
        changeType: conflict ? "CONFLICTING" : "UPDATED",
        isConflict: conflict,
        similarity: null,
        reason: conflict
          ? `Percentage changed from ${oldNum} to ${newNum} (beyond ${tolerance.toFixed(1)} tolerance).`
          : "Percentage changed within tolerance.",
      };
    }
  }

  if (valueType === "numeric") {
    const oldNum = parseNumber(existingValue);
    const newNum = parseNumber(proposedValue);
    if (oldNum !== null && newNum !== null && oldNum !== 0) {
      const relative = Math.abs(newNum - oldNum) / Math.abs(oldNum);
      const conflict = relative > 0.1;
      return {
        changeType: conflict ? "CONFLICTING" : "UPDATED",
        isConflict: conflict,
        similarity: null,
        reason: conflict
          ? `Value changed from ${oldNum} to ${newNum} (${(relative * 100).toFixed(0)}% difference).`
          : "Value changed within 10% tolerance.",
      };
    }
  }

  if (valueType === "list") {
    const oldSet = toSet(existingValue);
    const newSet = toSet(proposedValue);
    const removed = [...oldSet].filter((item) => !newSet.has(item));
    const added = [...newSet].filter((item) => !oldSet.has(item));
    const removalRatio = oldSet.size > 0 ? removed.length / oldSet.size : 0;
    if (removed.length === 0) {
      return {
        changeType: "UPDATED",
        isConflict: false,
        similarity: null,
        reason: added.length ? `Adds ${added.length} item(s); no removals (merge safe).` : "No changes.",
      };
    }
    const conflict = removalRatio > 0.3;
    return {
      changeType: conflict ? "CONFLICTING" : "UPDATED",
      isConflict: conflict,
      similarity: null,
      reason: `Removes ${removed.length} of ${oldSet.size} listed item(s).`,
    };
  }

  // Free text
  const similarity = diceCoefficient(existingValue, proposedValue);
  if (similarity >= TEXT_UNCHANGED_THRESHOLD) {
    return { changeType: "UNCHANGED", isConflict: false, similarity, reason: "Effectively the same wording." };
  }
  if (similarity >= TEXT_STRONG_CONFLICT_THRESHOLD) {
    return {
      changeType: "UPDATED",
      isConflict: true,
      similarity,
      reason: `Reworded but materially different (similarity ${similarity.toFixed(2)}).`,
    };
  }
  return {
    changeType: "CONFLICTING",
    isConflict: true,
    similarity,
    reason: `Substantially different value (similarity ${similarity.toFixed(2)}).`,
  };
}

/**
 * Finds the existing ACTIVE Client Brain item a proposed value would land on:
 * same client + section + field, and — for entity sections — the same group
 * (matched by fuzzy name similarity ≥ ENTITY_MATCH_THRESHOLD via groupId).
 */
export async function findExistingBrainItem(params: {
  clientId: string;
  fieldKey: ClientBrainFieldKey;
  sectionKey: ClientBrainItem["sectionKey"];
  groupId?: string | null;
}): Promise<ClientBrainItem | null> {
  return prisma.clientBrainItem.findFirst({
    where: {
      clientId: params.clientId,
      sectionKey: params.sectionKey,
      fieldKey: params.fieldKey,
      status: "ACTIVE",
      ...(params.groupId ? { groupId: params.groupId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function listConflictsForClient(clientId: string) {
  return prisma.conflict.findMany({
    where: { clientId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      clientBrainItem: true,
      extractedItem: { include: { sourceBlock: true, source: true } },
    },
  });
}

export function getConflictById(conflictId: string) {
  return prisma.conflict.findUnique({
    where: { id: conflictId },
    include: {
      clientBrainItem: { include: { sourceLinks: true } },
      extractedItem: { include: { sourceBlock: true, source: true } },
      resolutions: true,
    },
  });
}
