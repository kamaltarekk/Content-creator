-- CreateEnum
CREATE TYPE "StrategyEntityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StrategyApprovalStatus" AS ENUM ('AI_SUGGESTED', 'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CohortPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EvidenceStrength" AS ENUM ('ANECDOTAL', 'WEAK', 'MODERATE', 'STRONG', 'VERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('EVENT', 'PERFORMANCE_CHANGE', 'LIFE_STAGE', 'BUSINESS_STAGE', 'INTERNAL_PRESSURE', 'EXTERNAL_PRESSURE', 'DEADLINE', 'OPPORTUNITY', 'FAILURE', 'RISK', 'REGULATORY_CHANGE', 'MARKET_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('PROBLEM_RECOGNITION', 'CATEGORY_SELECTION', 'BRAND_SELECTION', 'OFFER_SELECTION', 'BUDGET_APPROVAL', 'INTERNAL_ALIGNMENT', 'VENDOR_REPLACEMENT', 'RENEWAL', 'EXPANSION', 'IMPLEMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "BuyingRole" AS ENUM ('USER', 'INITIATOR', 'INFLUENCER', 'CHAMPION', 'EVALUATOR', 'APPROVER', 'DECISION_MAKER', 'PAYER', 'BLOCKER', 'PROCUREMENT', 'LEGAL', 'TECHNICAL_REVIEWER', 'OTHER');

-- CreateEnum
CREATE TYPE "BeliefType" AS ENUM ('WRONG', 'INCOMPLETE', 'MISAPPLIED', 'OUTDATED', 'UNSUPPORTED', 'CONTEXT_DEPENDENT', 'LIMITING', 'CATEGORY_ASSUMPTION', 'PROCESS_ASSUMPTION', 'METRIC_ASSUMPTION', 'RISK_ASSUMPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "CohortSourceRelationshipType" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'INSPIRED_BY', 'VALIDATES', 'WEAK_SIGNAL', 'STRONG_SIGNAL', 'CONTEXT_ONLY');

-- CreateEnum
CREATE TYPE "StrategicEntityType" AS ENUM ('CLIENT_BRAIN_ITEM', 'COHORT', 'COMMERCIAL_SITUATION', 'BUYING_DECISION', 'BUYING_ROLE', 'BELIEF', 'OBJECTION', 'EVIDENCE', 'OFFER', 'PROOF', 'CONSTRAINT');

-- CreateEnum
CREATE TYPE "StrategicRelationshipType" AS ENUM ('EXPERIENCES', 'TRIGGERED_BY', 'BELIEVES', 'CAUSED_BY', 'CAUSES', 'BLOCKED_BY', 'REQUIRES', 'EVALUATES_BY', 'PARTICIPATES_IN', 'SUPPORTS', 'CONTRADICTS', 'REFRAMES', 'CHANGES_DECISION', 'SERVED_BY', 'RELEVANT_TO', 'VALIDATES', 'INVALIDATES');

-- CreateEnum
CREATE TYPE "StrategySuggestionType" AS ENUM ('COHORT', 'COMMERCIAL_SITUATION', 'BUYING_DECISION', 'BUYING_ROLE_PARTICIPANT', 'BELIEF_MAP', 'EVIDENCE_LINK', 'RELATIONSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "StrategySuggestionAction" AS ENUM ('APPROVE', 'EDIT_APPROVE', 'REJECT', 'KEEP_HYPOTHESIS', 'MERGE', 'ATTACH_COHORT', 'ATTACH_EVIDENCE', 'MARK_RESEARCH', 'DEFER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MERGE';
ALTER TYPE "AuditAction" ADD VALUE 'SPLIT';
ALTER TYPE "AuditAction" ADD VALUE 'SUGGEST';

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT,
    "priority" "CohortPriority" NOT NULL DEFAULT 'MEDIUM',
    "role" TEXT,
    "commercialContext" TEXT,
    "currentWorkflow" TEXT,
    "currentBelief" TEXT,
    "desiredOutcome" TEXT,
    "decisionRisk" TEXT,
    "emotionalDrivers" TEXT[],
    "platformPresence" TEXT[],
    "attentionNotes" TEXT,
    "status" "StrategyEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortVersion" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT,
    "priority" "CohortPriority" NOT NULL,
    "role" TEXT,
    "commercialContext" TEXT,
    "currentWorkflow" TEXT,
    "currentBelief" TEXT,
    "desiredOutcome" TEXT,
    "decisionRisk" TEXT,
    "emotionalDrivers" TEXT[],
    "platformPresence" TEXT[],
    "attentionNotes" TEXT,
    "status" "StrategyEntityStatus" NOT NULL,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSourceReference" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "relationshipType" "CohortSourceRelationshipType" NOT NULL,
    "clientBrainItemId" TEXT,
    "extractedItemId" TEXT,
    "sourceId" TEXT,
    "sourceBlockId" TEXT,
    "audienceSignalNote" TEXT,
    "note" TEXT,
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialSituation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triggerType" "TriggerType" NOT NULL,
    "triggerDescription" TEXT,
    "activeProblem" TEXT,
    "currentWorkflow" TEXT,
    "urgencyNote" TEXT,
    "status" "StrategyEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialSituation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialSituationVersion" (
    "id" TEXT NOT NULL,
    "commercialSituationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triggerType" "TriggerType" NOT NULL,
    "triggerDescription" TEXT,
    "activeProblem" TEXT,
    "currentWorkflow" TEXT,
    "urgencyNote" TEXT,
    "status" "StrategyEntityStatus" NOT NULL,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialSituationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingDecision" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "commercialSituationId" TEXT,
    "title" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "description" TEXT,
    "timeframe" TEXT,
    "status" "StrategyEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingDecisionVersion" (
    "id" TEXT NOT NULL,
    "buyingDecisionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "description" TEXT,
    "timeframe" TEXT,
    "status" "StrategyEntityStatus" NOT NULL,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyingDecisionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingRoleParticipant" (
    "id" TEXT NOT NULL,
    "buyingDecisionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "BuyingRole" NOT NULL,
    "label" TEXT NOT NULL,
    "influenceScore" INTEGER,
    "stance" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyingRoleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objection" (
    "id" TEXT NOT NULL,
    "buyingDecisionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "raisedByRole" "BuyingRole",
    "severity" "CohortPriority" NOT NULL DEFAULT 'MEDIUM',
    "resolutionNote" TEXT,
    "status" "StrategyEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCriterion" (
    "id" TEXT NOT NULL,
    "buyingDecisionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weightNote" TEXT,
    "importance" "CohortPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefMap" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "commercialSituationId" TEXT,
    "observedSituation" TEXT,
    "currentInterpretation" TEXT,
    "currentBeliefStatement" TEXT NOT NULL,
    "beliefType" "BeliefType" NOT NULL DEFAULT 'WRONG',
    "behaviorCaused" TEXT,
    "commercialConsequence" TEXT,
    "betterBeliefStatement" TEXT,
    "betterCommercialDecision" TEXT,
    "relevantOfferPlaceholder" TEXT,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeliefMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefMapVersion" (
    "id" TEXT NOT NULL,
    "beliefMapId" TEXT NOT NULL,
    "observedSituation" TEXT,
    "currentInterpretation" TEXT,
    "currentBeliefStatement" TEXT NOT NULL,
    "beliefType" "BeliefType" NOT NULL,
    "behaviorCaused" TEXT,
    "commercialConsequence" TEXT,
    "betterBeliefStatement" TEXT,
    "betterCommercialDecision" TEXT,
    "relevantOfferPlaceholder" TEXT,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeliefMapVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "targetEntityType" "StrategicEntityType" NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "beliefMapId" TEXT,
    "description" TEXT NOT NULL,
    "evidenceStrength" "EvidenceStrength" NOT NULL DEFAULT 'WEAK',
    "clientBrainItemId" TEXT,
    "sourceId" TEXT,
    "sourceBlockId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicEntity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entityType" "StrategicEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicRelationship" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationshipType" "StrategicRelationshipType" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategySuggestion" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "suggestionType" "StrategySuggestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "proposedFields" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoningSummary" TEXT NOT NULL,
    "missingEvidence" TEXT[],
    "possibleConflicts" JSONB,
    "suggestedRelationships" JSONB,
    "status" "StrategyApprovalStatus" NOT NULL DEFAULT 'AI_SUGGESTED',
    "isDuplicateCandidate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfEntityType" "StrategicEntityType",
    "duplicateOfEntityId" TEXT,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategySuggestionReview" (
    "id" TEXT NOT NULL,
    "strategySuggestionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "action" "StrategySuggestionAction",
    "resultingEntityType" "StrategicEntityType",
    "resultingEntityId" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategySuggestionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "sectionScores" JSONB NOT NULL,
    "followUpQuestions" TEXT[],
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cohort_clientId_status_idx" ON "Cohort"("clientId", "status");

-- CreateIndex
CREATE INDEX "Cohort_clientId_approvalStatus_idx" ON "Cohort"("clientId", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CohortVersion_cohortId_versionNumber_key" ON "CohortVersion"("cohortId", "versionNumber");

-- CreateIndex
CREATE INDEX "CohortSourceReference_cohortId_idx" ON "CohortSourceReference"("cohortId");

-- CreateIndex
CREATE INDEX "CommercialSituation_clientId_status_idx" ON "CommercialSituation"("clientId", "status");

-- CreateIndex
CREATE INDEX "CommercialSituation_cohortId_idx" ON "CommercialSituation"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialSituationVersion_commercialSituationId_versionNum_key" ON "CommercialSituationVersion"("commercialSituationId", "versionNumber");

-- CreateIndex
CREATE INDEX "BuyingDecision_clientId_status_idx" ON "BuyingDecision"("clientId", "status");

-- CreateIndex
CREATE INDEX "BuyingDecision_cohortId_idx" ON "BuyingDecision"("cohortId");

-- CreateIndex
CREATE INDEX "BuyingDecision_commercialSituationId_idx" ON "BuyingDecision"("commercialSituationId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyingDecisionVersion_buyingDecisionId_versionNumber_key" ON "BuyingDecisionVersion"("buyingDecisionId", "versionNumber");

-- CreateIndex
CREATE INDEX "BuyingRoleParticipant_buyingDecisionId_idx" ON "BuyingRoleParticipant"("buyingDecisionId");

-- CreateIndex
CREATE INDEX "BuyingRoleParticipant_clientId_idx" ON "BuyingRoleParticipant"("clientId");

-- CreateIndex
CREATE INDEX "Objection_buyingDecisionId_idx" ON "Objection"("buyingDecisionId");

-- CreateIndex
CREATE INDEX "Objection_clientId_idx" ON "Objection"("clientId");

-- CreateIndex
CREATE INDEX "DecisionCriterion_buyingDecisionId_idx" ON "DecisionCriterion"("buyingDecisionId");

-- CreateIndex
CREATE INDEX "DecisionCriterion_clientId_idx" ON "DecisionCriterion"("clientId");

-- CreateIndex
CREATE INDEX "BeliefMap_clientId_approvalStatus_idx" ON "BeliefMap"("clientId", "approvalStatus");

-- CreateIndex
CREATE INDEX "BeliefMap_cohortId_idx" ON "BeliefMap"("cohortId");

-- CreateIndex
CREATE INDEX "BeliefMap_commercialSituationId_idx" ON "BeliefMap"("commercialSituationId");

-- CreateIndex
CREATE UNIQUE INDEX "BeliefMapVersion_beliefMapId_versionNumber_key" ON "BeliefMapVersion"("beliefMapId", "versionNumber");

-- CreateIndex
CREATE INDEX "EvidenceLink_clientId_targetEntityType_targetEntityId_idx" ON "EvidenceLink"("clientId", "targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "EvidenceLink_beliefMapId_idx" ON "EvidenceLink"("beliefMapId");

-- CreateIndex
CREATE INDEX "StrategicEntity_clientId_idx" ON "StrategicEntity"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicEntity_clientId_entityType_entityId_key" ON "StrategicEntity"("clientId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "StrategicRelationship_clientId_idx" ON "StrategicRelationship"("clientId");

-- CreateIndex
CREATE INDEX "StrategicRelationship_fromEntityId_idx" ON "StrategicRelationship"("fromEntityId");

-- CreateIndex
CREATE INDEX "StrategicRelationship_toEntityId_idx" ON "StrategicRelationship"("toEntityId");

-- CreateIndex
CREATE INDEX "StrategySuggestion_clientId_status_idx" ON "StrategySuggestion"("clientId", "status");

-- CreateIndex
CREATE INDEX "StrategySuggestion_clientId_suggestionType_idx" ON "StrategySuggestion"("clientId", "suggestionType");

-- CreateIndex
CREATE UNIQUE INDEX "StrategySuggestionReview_strategySuggestionId_key" ON "StrategySuggestionReview"("strategySuggestionId");

-- CreateIndex
CREATE INDEX "StrategySuggestionReview_clientId_status_idx" ON "StrategySuggestionReview"("clientId", "status");

-- CreateIndex
CREATE INDEX "StrategyReadinessSnapshot_clientId_generatedAt_idx" ON "StrategyReadinessSnapshot"("clientId", "generatedAt");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortVersion" ADD CONSTRAINT "CohortVersion_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSourceReference" ADD CONSTRAINT "CohortSourceReference_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialSituation" ADD CONSTRAINT "CommercialSituation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialSituation" ADD CONSTRAINT "CommercialSituation_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialSituationVersion" ADD CONSTRAINT "CommercialSituationVersion_commercialSituationId_fkey" FOREIGN KEY ("commercialSituationId") REFERENCES "CommercialSituation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingDecision" ADD CONSTRAINT "BuyingDecision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingDecision" ADD CONSTRAINT "BuyingDecision_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingDecision" ADD CONSTRAINT "BuyingDecision_commercialSituationId_fkey" FOREIGN KEY ("commercialSituationId") REFERENCES "CommercialSituation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingDecisionVersion" ADD CONSTRAINT "BuyingDecisionVersion_buyingDecisionId_fkey" FOREIGN KEY ("buyingDecisionId") REFERENCES "BuyingDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingRoleParticipant" ADD CONSTRAINT "BuyingRoleParticipant_buyingDecisionId_fkey" FOREIGN KEY ("buyingDecisionId") REFERENCES "BuyingDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objection" ADD CONSTRAINT "Objection_buyingDecisionId_fkey" FOREIGN KEY ("buyingDecisionId") REFERENCES "BuyingDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionCriterion" ADD CONSTRAINT "DecisionCriterion_buyingDecisionId_fkey" FOREIGN KEY ("buyingDecisionId") REFERENCES "BuyingDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefMap" ADD CONSTRAINT "BeliefMap_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefMap" ADD CONSTRAINT "BeliefMap_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefMap" ADD CONSTRAINT "BeliefMap_commercialSituationId_fkey" FOREIGN KEY ("commercialSituationId") REFERENCES "CommercialSituation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefMapVersion" ADD CONSTRAINT "BeliefMapVersion_beliefMapId_fkey" FOREIGN KEY ("beliefMapId") REFERENCES "BeliefMap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_beliefMapId_fkey" FOREIGN KEY ("beliefMapId") REFERENCES "BeliefMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicEntity" ADD CONSTRAINT "StrategicEntity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicRelationship" ADD CONSTRAINT "StrategicRelationship_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicRelationship" ADD CONSTRAINT "StrategicRelationship_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "StrategicEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicRelationship" ADD CONSTRAINT "StrategicRelationship_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "StrategicEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategySuggestion" ADD CONSTRAINT "StrategySuggestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategySuggestionReview" ADD CONSTRAINT "StrategySuggestionReview_strategySuggestionId_fkey" FOREIGN KEY ("strategySuggestionId") REFERENCES "StrategySuggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyReadinessSnapshot" ADD CONSTRAINT "StrategyReadinessSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
