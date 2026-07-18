import type {
  ClientBrainFieldKey,
  ClientBrainSectionKey,
  ExtractedItemValidationStatus,
  InformationType,
} from "@prisma/client";

/** Serializable review-queue item passed from the RSC page to the client queue. */
export type ReviewQueueItem = {
  reviewId: string;
  extractedItemId: string;
  informationType: InformationType;
  proposedSectionKey: ClientBrainSectionKey | null;
  proposedFieldKey: ClientBrainFieldKey | null;
  normalizedValueText: string | null;
  confidence: number;
  detectedLanguage: string | null;
  reasoningSummary: string | null;
  isConflictCandidate: boolean;
  validationStatus: ExtractedItemValidationStatus;
  validationNotes: string | null;
  suggestedTags: string[];
  originalText: string;
  blockType: string;
  sourceLocationLabel: string;
  sourceId: string;
  sourceFileName: string;
  detectedSection: string;
};
