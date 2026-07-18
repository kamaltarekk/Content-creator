import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import { isFieldInSection } from "@/server/domain/brain-schema";

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

/** Deterministic normalization used for duplicate detection: lowercase, strip punctuation, collapse whitespace. */
export function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(normalizeForComparison(value)).digest("hex");
}

export type ValidationSummary = {
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  lowConfidenceCount: number;
};

/**
 * Deterministic checks layered on top of AI classification (spec pipeline
 * step 5): re-validate the section/field pairing, flag low-confidence items,
 * and detect exact duplicates within the same source+field (linking the
 * later one to the earlier via duplicateOfItemId). Runs after classification;
 * the human review queue still gates everything.
 */
export async function validateSourceExtraction(sourceId: string): Promise<ValidationSummary> {
  const items = await prisma.extractedItem.findMany({
    where: { sourceId },
    orderBy: { createdAt: "asc" },
  });

  const seenByKey = new Map<string, string>(); // key -> first extractedItem id
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let lowConfidenceCount = 0;

  for (const item of items) {
    const notes: string[] = [];
    let isValid = true;

    // Defense-in-depth: the schema already enforces this, but re-check.
    if (item.proposedSectionKey && item.proposedFieldKey) {
      if (!isFieldInSection(item.proposedSectionKey, item.proposedFieldKey)) {
        isValid = false;
        notes.push("Proposed field does not belong to the proposed section.");
      }
    }

    if (item.confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidenceCount += 1;
      notes.push(`Low confidence (${item.confidence.toFixed(2)}).`);
    }

    // Exact-duplicate detection scoped to the same source + proposed field.
    let duplicateOfItemId: string | null = null;
    if (item.normalizedValueText) {
      const dedupeKey = `${item.proposedSectionKey ?? "-"}:${item.proposedFieldKey ?? "-"}:${fingerprint(
        item.normalizedValueText,
      )}`;
      const existing = seenByKey.get(dedupeKey);
      if (existing) {
        duplicateOfItemId = existing;
        duplicateCount += 1;
        notes.push("Exact duplicate of an earlier item in this source.");
      } else {
        seenByKey.set(dedupeKey, item.id);
      }
    }

    if (isValid) validCount += 1;
    else invalidCount += 1;

    await prisma.extractedItem.update({
      where: { id: item.id },
      data: {
        validationStatus: isValid ? "VALID" : "INVALID",
        validationNotes: notes.length ? notes.join(" ") : null,
        duplicateOfItemId,
      },
    });
  }

  return { validCount, invalidCount, duplicateCount, lowConfidenceCount };
}
