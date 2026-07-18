import type {
  BeliefType,
  BuyingRole,
  CohortPriority,
  DecisionType,
  EvidenceStrength,
  StrategicEntityType,
  StrategicRelationshipType,
  StrategyApprovalStatus,
  StrategyEntityStatus,
  TriggerType,
} from "@prisma/client";
import type { CohortQualityResult } from "@/server/domain/cohort-quality";
import type { BeliefQualityResult } from "@/server/domain/belief-quality";

/** Serializable Cohort Lab list-row view. */
export type CohortListItemView = {
  id: string;
  name: string;
  definition: string | null;
  priority: CohortPriority;
  status: StrategyEntityStatus;
  approvalStatus: StrategyApprovalStatus;
  situationCount: number;
  decisionCount: number;
  beliefCount: number;
  sourceReferenceCount: number;
  quality: CohortQualityResult;
  updatedAt: string;
};

export type CommercialSituationView = {
  id: string;
  title: string;
  triggerType: TriggerType;
  triggerDescription: string | null;
  activeProblem: string | null;
  currentWorkflow: string | null;
  urgencyNote: string | null;
  status: StrategyEntityStatus;
  approvalStatus: StrategyApprovalStatus;
};

export type BuyingRoleParticipantView = {
  id: string;
  role: BuyingRole;
  label: string;
  influenceScore: number | null;
  stance: string | null;
  notes: string | null;
};

export type ObjectionView = {
  id: string;
  title: string;
  description: string | null;
  raisedByRole: BuyingRole | null;
  severity: CohortPriority;
  resolutionNote: string | null;
};

export type DecisionCriterionView = {
  id: string;
  label: string;
  weightNote: string | null;
  importance: CohortPriority;
};

export type BuyingDecisionView = {
  id: string;
  title: string;
  decisionType: DecisionType;
  description: string | null;
  timeframe: string | null;
  status: StrategyEntityStatus;
  approvalStatus: StrategyApprovalStatus;
  commercialSituationId: string | null;
  participants: BuyingRoleParticipantView[];
  objections: ObjectionView[];
  criteria: DecisionCriterionView[];
};

export type BuyingDecisionListItemView = {
  id: string;
  title: string;
  decisionType: DecisionType;
  status: StrategyEntityStatus;
  approvalStatus: StrategyApprovalStatus;
  cohort: { id: string; name: string };
  commercialSituationTitle: string | null;
  participantCount: number;
  objectionCount: number;
  criterionCount: number;
};

/** Full Buying Decision detail view (the Buying Committee Mapper). */
export type BuyingDecisionDetailView = BuyingDecisionView & {
  cohort: { id: string; name: string };
  commercialSituationTitle: string | null;
};

export type EvidenceLinkView = {
  id: string;
  description: string;
  evidenceStrength: EvidenceStrength;
  clientBrainItemId: string | null;
  sourceId: string | null;
  note: string | null;
};

export type BeliefMapView = {
  id: string;
  observedSituation: string | null;
  currentInterpretation: string | null;
  currentBeliefStatement: string;
  beliefType: BeliefType;
  behaviorCaused: string | null;
  commercialConsequence: string | null;
  betterBeliefStatement: string | null;
  betterCommercialDecision: string | null;
  relevantOfferPlaceholder: string | null;
  approvalStatus: StrategyApprovalStatus;
  commercialSituationId: string | null;
  evidenceLinks: EvidenceLinkView[];
  quality: BeliefQualityResult;
};

export type CohortSourceReferenceView = {
  id: string;
  relationshipType: string;
  clientBrainItemId: string | null;
  extractedItemId: string | null;
  sourceId: string | null;
  sourceBlockId: string | null;
  audienceSignalNote: string | null;
  note: string | null;
  linkedAt: string;
};

export type StrategicEntityView = {
  id: string;
  entityType: StrategicEntityType;
  entityId: string;
  title: string;
  status: string | null;
};

export type StrategicRelationshipView = {
  id: string;
  relationshipType: StrategicRelationshipType;
  note: string | null;
  fromEntity: StrategicEntityView;
  toEntity: StrategicEntityView;
};

export type CohortVersionView = {
  versionNumber: number;
  changeType: string;
  changeNote: string | null;
  changedById: string;
  createdAt: string;
};

/** Full Cohort Detail Workspace view. */
export type CohortDetailView = {
  id: string;
  name: string;
  definition: string | null;
  priority: CohortPriority;
  role: string | null;
  commercialContext: string | null;
  currentWorkflow: string | null;
  currentBelief: string | null;
  desiredOutcome: string | null;
  decisionRisk: string | null;
  emotionalDrivers: string[];
  platformPresence: string[];
  attentionNotes: string | null;
  status: StrategyEntityStatus;
  approvalStatus: StrategyApprovalStatus;
  currentVersionNumber: number;
  quality: CohortQualityResult;
  commercialSituations: CommercialSituationView[];
  buyingDecisions: BuyingDecisionView[];
  beliefMaps: BeliefMapView[];
  sourceReferences: CohortSourceReferenceView[];
  versions: CohortVersionView[];
  updatedAt: string;
};
