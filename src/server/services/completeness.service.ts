import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

import {
  ALL_SECTION_KEYS,
  CRITICAL_FIELDS,
  ENTITY_SECTIONS,
  SECTION_LABELS,
  SECTION_WEIGHTS,
} from "@/server/domain/brain-schema";

/** Minimal item shape the pure calculation needs (keeps it unit-testable). */
export type CompletenessItem = {
  sectionKey: ClientBrainSectionKey;
  fieldKey: ClientBrainFieldKey;
  groupId: string;
  status: string;
  confidence: number | null;
};

export type SectionCompleteness = {
  sectionKey: ClientBrainSectionKey;
  label: string;
  weight: number | null;
  coverage: number; // 0..1 — fraction of critical fields present
  avgConfidence: number; // 0..1
  score: number; // coverage × avgConfidence, 0..1
  weightedContribution: number; // score × weight (points toward the 100-pt total)
  missingCriticalFields: ClientBrainFieldKey[];
  itemCount: number;
};

export type CompletenessResult = {
  /** Headline % across the 10 weighted sections. Labelled a setup-completeness indicator, not a quality score. */
  overall: number;
  sections: SectionCompleteness[];
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/** Manual items carry no AI confidence — treat them as fully confident. */
function itemConfidence(item: CompletenessItem): number {
  return item.confidence ?? 1;
}

function sectionCoverage(
  section: ClientBrainSectionKey,
  activeItems: CompletenessItem[],
): { coverage: number; missing: ClientBrainFieldKey[] } {
  const critical = CRITICAL_FIELDS[section];
  if (critical.length === 0) return { coverage: 0, missing: [] };

  if (ENTITY_SECTIONS.includes(section)) {
    // Best-populated group's fraction of critical fields present.
    const groups = new Map<string, Set<ClientBrainFieldKey>>();
    for (const item of activeItems) {
      const set = groups.get(item.groupId) ?? new Set<ClientBrainFieldKey>();
      set.add(item.fieldKey);
      groups.set(item.groupId, set);
    }
    let bestCoverage = 0;
    let bestMissing = critical.slice();
    for (const fields of groups.values()) {
      const present = critical.filter((field) => fields.has(field));
      const coverage = present.length / critical.length;
      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        bestMissing = critical.filter((field) => !fields.has(field));
      }
    }
    return { coverage: bestCoverage, missing: bestMissing };
  }

  // Flat section: fraction of critical fields with at least one active item.
  const presentFields = new Set(activeItems.map((item) => item.fieldKey));
  const present = critical.filter((field) => presentFields.has(field));
  return {
    coverage: present.length / critical.length,
    missing: critical.filter((field) => !presentFields.has(field)),
  };
}

/** Pure completeness computation (spec section 16). Confidence-weighted coverage per section, weighted sum overall. */
export function computeCompleteness(items: CompletenessItem[]): CompletenessResult {
  const active = items.filter((item) => item.status === "ACTIVE");

  const sections: SectionCompleteness[] = ALL_SECTION_KEYS.map((section) => {
    const sectionItems = active.filter((item) => item.sectionKey === section);
    const { coverage, missing } = sectionCoverage(section, sectionItems);
    const avgConfidence = avg(sectionItems.map(itemConfidence));
    const score = coverage * avgConfidence;
    const weight = SECTION_WEIGHTS[section] ?? null;
    return {
      sectionKey: section,
      label: SECTION_LABELS[section],
      weight,
      coverage,
      avgConfidence,
      score,
      weightedContribution: weight ? score * weight : 0,
      missingCriticalFields: missing,
      itemCount: sectionItems.length,
    };
  });

  const overall = Math.round(sections.reduce((sum, section) => sum + section.weightedContribution, 0));

  return { overall, sections };
}
