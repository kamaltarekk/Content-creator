import type {
  ClientBrainFieldKey,
  ClientBrainItemStatus,
  ClientBrainSectionKey,
} from "@prisma/client";

/** Serializable Client Brain item passed from the RSC page to client views. */
export type BrainItemView = {
  id: string;
  sectionKey: ClientBrainSectionKey;
  fieldKey: ClientBrainFieldKey;
  groupId: string;
  subjectLabel: string | null;
  valueText: string | null;
  status: ClientBrainItemStatus;
  confidence: number | null;
  currentVersionNumber: number;
  hasSourceTrace: boolean;
  updatedAt: string;
};
