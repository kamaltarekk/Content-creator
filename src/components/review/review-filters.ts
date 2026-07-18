import type { InformationType } from "@prisma/client";

import type { ReviewQueueItem } from "@/types/review";

export type ReviewFilterKey =
  | "ALL"
  | "HIGH_CONFIDENCE"
  | "LOW_CONFIDENCE"
  | "CONFLICTS"
  | "STRATEGIC_FACTS"
  | "AUDIENCE_SIGNALS"
  | "EVIDENCE"
  | "HYPOTHESES"
  | "RAW_NOTES"
  | "EXTERNAL_SOURCES";

export const REVIEW_FILTERS: { key: ReviewFilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "HIGH_CONFIDENCE", label: "High confidence" },
  { key: "LOW_CONFIDENCE", label: "Low confidence" },
  { key: "CONFLICTS", label: "Conflicts" },
  { key: "STRATEGIC_FACTS", label: "Strategic facts" },
  { key: "AUDIENCE_SIGNALS", label: "Audience signals" },
  { key: "EVIDENCE", label: "Evidence" },
  { key: "HYPOTHESES", label: "Hypotheses" },
  { key: "RAW_NOTES", label: "Raw notes" },
  { key: "EXTERNAL_SOURCES", label: "External sources" },
];

const TYPE_FILTER: Partial<Record<ReviewFilterKey, InformationType>> = {
  STRATEGIC_FACTS: "STRATEGIC_FACT",
  AUDIENCE_SIGNALS: "AUDIENCE_SIGNAL",
  EVIDENCE: "EVIDENCE",
  HYPOTHESES: "HYPOTHESIS",
  RAW_NOTES: "RAW_NOTE",
  EXTERNAL_SOURCES: "EXTERNAL_SOURCE",
};

const LOW_CONFIDENCE = 0.55;

export function matchesFilter(item: ReviewQueueItem, filter: ReviewFilterKey): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "HIGH_CONFIDENCE":
      return item.confidence >= 0.75;
    case "LOW_CONFIDENCE":
      return item.confidence < LOW_CONFIDENCE;
    case "CONFLICTS":
      return item.isConflictCandidate;
    default: {
      const type = TYPE_FILTER[filter];
      return type ? item.informationType === type : true;
    }
  }
}
