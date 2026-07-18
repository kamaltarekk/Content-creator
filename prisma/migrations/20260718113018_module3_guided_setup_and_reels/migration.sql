-- CreateEnum
CREATE TYPE "ScriptImpact" AS ENUM ('AUDIENCE', 'HOOK', 'ANGLE', 'STORY', 'BODY', 'EXAMPLE', 'PROOF', 'REFRAME', 'VOICE', 'CTA', 'FORMAT', 'VISUAL', 'SAFETY', 'LEARNING', 'SYSTEM_ONLY');

-- CreateEnum
CREATE TYPE "GuidedSetupEntryMode" AS ENUM ('FULL_GUIDED', 'FAST_IMPORT');

-- CreateEnum
CREATE TYPE "GuidedSetupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GuidedSetupSection" AS ENUM ('BUSINESS', 'AUDIENCE', 'BELIEF_DECISION', 'OFFER', 'PROOF', 'VOICE', 'EXECUTION', 'SAFETY', 'FINAL_REVIEW');

-- CreateEnum
CREATE TYPE "GuidedAnswerType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'NUMBER', 'CURRENCY', 'DURATION', 'FILE', 'VOICE_INPUT_PLACEHOLDER', 'ENTITY_SELECT', 'AI_SUGGESTION_REVIEW');

-- CreateEnum
CREATE TYPE "GuidedRequiredLevel" AS ENUM ('REQUIRED_FOR_ANY_REEL', 'REQUIRED_FOR_COMMERCIAL_REEL', 'RECOMMENDED', 'OPTIONAL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "GuidedAnswerSourceType" AS ENUM ('EXISTING_CLIENT_BRAIN_ITEM', 'EXISTING_STRATEGY_ENTITY', 'AI_SUGGESTION', 'USER_INPUT', 'DEFAULT_VALUE');

-- CreateEnum
CREATE TYPE "OfferPricePresentation" AS ENUM ('NOT_SELLING_YET', 'DO_NOT_MENTION_PRICE', 'CUSTOM_QUOTATION', 'STARTING_FROM', 'EXACT_PRICE', 'PRICE_RANGE', 'FREE');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('CASE_STUDY', 'RESULT', 'TESTIMONIAL', 'EXPERIENCE', 'CREDENTIAL', 'FRAMEWORK', 'PROCESS', 'DEMONSTRATION', 'SCREENSHOT', 'ARTIFACT', 'CUSTOMER_EXAMPLE');

-- CreateEnum
CREATE TYPE "PublicUseStatus" AS ENUM ('PUBLIC', 'PUBLIC_ANONYMOUS', 'INTERNAL_ONLY', 'REQUIRES_APPROVAL', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "ReelPlatform" AS ENUM ('INSTAGRAM_REELS');

-- CreateEnum
CREATE TYPE "ContentObjective" AS ENUM ('AWARENESS', 'EDUCATION', 'BELIEF_CHANGE', 'TRUST', 'OBJECTION_HANDLING', 'OFFER_PROMOTION');

-- CreateEnum
CREATE TYPE "ReelFormat" AS ENUM ('TALKING_HEAD', 'VOICEOVER', 'INTERVIEW', 'CASE_BREAKDOWN', 'SCREEN_RECORDING', 'VLOG', 'SKIT', 'REACTION', 'GREEN_SCREEN');

-- CreateEnum
CREATE TYPE "PromotionalIntensity" AS ENUM ('NONE', 'LIGHT', 'MODERATE', 'DIRECT');

-- CreateEnum
CREATE TYPE "RequestedStyle" AS ENUM ('DIRECT', 'STORY', 'CASE', 'MYTH_BUSTING', 'COMPARISON', 'AUTHORITY', 'EDUCATIONAL');

-- CreateEnum
CREATE TYPE "ReelTechnicality" AS ENUM ('VERY_SIMPLE', 'SIMPLE_WITH_BUSINESS_TERMS', 'PROFESSIONAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ProductionEditingLevel" AS ENUM ('SIMPLE', 'MODERATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "HookType" AS ENUM ('EDUCATIONAL', 'STORY', 'AUTHORITY', 'MYTH_BUSTING', 'COMPARISON', 'DAY_IN_THE_LIFE', 'CONTRARIAN', 'INVESTIGATOR', 'EXPERIMENTER', 'TEACHER');

-- CreateEnum
CREATE TYPE "ScriptSegmentType" AS ENUM ('HOOK', 'LEAD', 'BODY', 'REHOOK', 'PAYOFF', 'CTA', 'VALUE_EXTENSION');

-- CreateEnum
CREATE TYPE "PortfolioRole" AS ENUM ('VALUE', 'BRIDGE', 'COMMERCIAL_ASK');

-- CreateEnum
CREATE TYPE "CtaType" AS ENUM ('NONE', 'SAVE', 'SHARE', 'FOLLOW', 'COMMENT', 'DM', 'DOWNLOAD', 'BOOK', 'APPLY', 'PURCHASE', 'WATCH_NEXT');

-- CreateEnum
CREATE TYPE "ReelClaimStatus" AS ENUM ('APPROVED', 'RESTRICTED', 'POSITIONING_ONLY');

-- CreateEnum
CREATE TYPE "AuditGateStatus" AS ENUM ('PASS', 'WARNING', 'FAIL');

-- CreateEnum
CREATE TYPE "ReelGenerationStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateTable
CREATE TABLE "GuidedSetupSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryMode" "GuidedSetupEntryMode" NOT NULL DEFAULT 'FULL_GUIDED',
    "status" "GuidedSetupStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentSection" "GuidedSetupSection",
    "currentQuestionKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedSetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedSetupQuestionDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" "GuidedSetupSection" NOT NULL,
    "userFacingQuestion" TEXT NOT NULL,
    "helperText" TEXT,
    "example" TEXT,
    "answerType" "GuidedAnswerType" NOT NULL,
    "options" JSONB,
    "requiredLevel" "GuidedRequiredLevel" NOT NULL,
    "scriptImpacts" "ScriptImpact"[],
    "destinationEntity" TEXT,
    "destinationField" TEXT,
    "conditionalLogic" JSONB,
    "plainLanguageLabel" TEXT,
    "expertLabel" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedSetupQuestionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedSetupAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "rawAnswer" TEXT,
    "normalizedValue" TEXT,
    "sourceType" "GuidedAnswerSourceType" NOT NULL,
    "sourceReference" TEXT,
    "confidence" DOUBLE PRECISION,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedSetupAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptIntelligenceField" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "scriptImpacts" "ScriptImpact"[],
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptIntelligenceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptContextSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cohortId" TEXT,
    "generationPurpose" TEXT NOT NULL,
    "compiledContext" JSONB NOT NULL,
    "sourceManifest" JSONB NOT NULL,
    "readiness" JSONB,
    "warnings" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "forWhom" TEXT,
    "problemAddressed" TEXT,
    "corePromise" TEXT,
    "intendedOutcome" TEXT,
    "mechanism" TEXT,
    "deliverables" TEXT[],
    "pricePresentation" "OfferPricePresentation" NOT NULL DEFAULT 'NOT_SELLING_YET',
    "priceText" TEXT,
    "excludedOutcomes" TEXT[],
    "guarantee" TEXT,
    "ctaRoute" TEXT,
    "status" "StrategyEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferVersion" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "forWhom" TEXT,
    "problemAddressed" TEXT,
    "corePromise" TEXT,
    "intendedOutcome" TEXT,
    "mechanism" TEXT,
    "deliverables" TEXT[],
    "pricePresentation" "OfferPricePresentation" NOT NULL,
    "priceText" TEXT,
    "excludedOutcomes" TEXT[],
    "guarantee" TEXT,
    "ctaRoute" TEXT,
    "status" "StrategyEntityStatus" NOT NULL,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "offerId" TEXT,
    "proofType" "ProofType" NOT NULL,
    "whatHappened" TEXT,
    "whoForWhom" TEXT,
    "startingPoint" TEXT,
    "whatChanged" TEXT,
    "overPeriod" TEXT,
    "contributingFactors" TEXT,
    "limitations" TEXT[],
    "publicUseStatus" "PublicUseStatus" NOT NULL DEFAULT 'REQUIRES_APPROVAL',
    "evidenceStrength" "EvidenceStrength" NOT NULL DEFAULT 'WEAK',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProofItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelGeneration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "contextSnapshotId" TEXT NOT NULL,
    "status" "ReelGenerationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReelGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelVersion" (
    "id" TEXT NOT NULL,
    "reelGenerationId" TEXT NOT NULL,
    "packageJson" JSONB NOT NULL,
    "selectedHookIndex" INTEGER NOT NULL DEFAULT 0,
    "validationJson" JSONB NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuidedSetupSession_clientId_status_idx" ON "GuidedSetupSession"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GuidedSetupQuestionDefinition_key_key" ON "GuidedSetupQuestionDefinition"("key");

-- CreateIndex
CREATE INDEX "GuidedSetupQuestionDefinition_section_displayOrder_idx" ON "GuidedSetupQuestionDefinition"("section", "displayOrder");

-- CreateIndex
CREATE INDEX "GuidedSetupAnswer_clientId_questionKey_idx" ON "GuidedSetupAnswer"("clientId", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "GuidedSetupAnswer_sessionId_questionKey_key" ON "GuidedSetupAnswer"("sessionId", "questionKey");

-- CreateIndex
CREATE INDEX "ScriptIntelligenceField_clientId_fieldKey_idx" ON "ScriptIntelligenceField"("clientId", "fieldKey");

-- CreateIndex
CREATE INDEX "ScriptIntelligenceField_clientId_sourceEntityType_sourceEnt_idx" ON "ScriptIntelligenceField"("clientId", "sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "ScriptContextSnapshot_clientId_createdAt_idx" ON "ScriptContextSnapshot"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_clientId_status_idx" ON "Offer"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OfferVersion_offerId_versionNumber_key" ON "OfferVersion"("offerId", "versionNumber");

-- CreateIndex
CREATE INDEX "ProofItem_clientId_approvalStatus_idx" ON "ProofItem"("clientId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ProofItem_offerId_idx" ON "ProofItem"("offerId");

-- CreateIndex
CREATE INDEX "ReelGeneration_clientId_createdAt_idx" ON "ReelGeneration"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelGeneration_cohortId_idx" ON "ReelGeneration"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "ReelVersion_reelGenerationId_versionNumber_key" ON "ReelVersion"("reelGenerationId", "versionNumber");

-- AddForeignKey
ALTER TABLE "GuidedSetupSession" ADD CONSTRAINT "GuidedSetupSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedSetupAnswer" ADD CONSTRAINT "GuidedSetupAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuidedSetupSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedSetupAnswer" ADD CONSTRAINT "GuidedSetupAnswer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptIntelligenceField" ADD CONSTRAINT "ScriptIntelligenceField_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptContextSnapshot" ADD CONSTRAINT "ScriptContextSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferVersion" ADD CONSTRAINT "OfferVersion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofItem" ADD CONSTRAINT "ProofItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofItem" ADD CONSTRAINT "ProofItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelGeneration" ADD CONSTRAINT "ReelGeneration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelVersion" ADD CONSTRAINT "ReelVersion_reelGenerationId_fkey" FOREIGN KEY ("reelGenerationId") REFERENCES "ReelGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
