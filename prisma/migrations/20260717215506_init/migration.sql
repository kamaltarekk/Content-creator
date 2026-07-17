-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'STRATEGIST', 'EDITOR', 'VIEWER', 'CLIENT_APPROVER');

-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('OWNER', 'ADMIN', 'STRATEGIST', 'EDITOR', 'VIEWER', 'CLIENT_APPROVER');

-- CreateEnum
CREATE TYPE "BrandType" AS ENUM ('PERSONAL_BRAND', 'COMPANY_BRAND', 'HYBRID');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('INTERNAL', 'CLIENT_CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('STRATEGIC_FRAMEWORK', 'MARKET_RESEARCH', 'CUSTOMER_FEEDBACK', 'SALES_DATA', 'BRAND_GUIDELINES', 'PERFORMANCE_REPORT', 'MEETING_NOTES', 'COMPETITOR_INTEL', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceFileType" AS ENUM ('CSV', 'XLSX', 'PDF', 'DOCX', 'TXT', 'MARKDOWN', 'IMAGE', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "SourceProcessingStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'NEEDS_ATTENTION', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PROCESS_SOURCE');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('HEADING', 'PARAGRAPH', 'TABLE_ROW', 'LIST_ITEM', 'NOTE', 'LINK', 'QUOTE', 'MESSAGE');

-- CreateEnum
CREATE TYPE "InformationType" AS ENUM ('STRATEGIC_FACT', 'CLIENT_PREFERENCE', 'AUDIENCE_SIGNAL', 'EVIDENCE', 'HYPOTHESIS', 'EXAMPLE', 'PERFORMANCE_LEARNING', 'RAW_NOTE', 'EXTERNAL_SOURCE', 'CONFLICT', 'MISSING_INFORMATION');

-- CreateEnum
CREATE TYPE "ExtractedItemValidationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "ImportReviewStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ImportReviewAction" AS ENUM ('APPROVE', 'APPROVE_WITH_EDIT', 'REJECT', 'REMAP', 'KEEP_AS_RAW', 'MARK_HYPOTHESIS', 'MARK_AUDIENCE_SIGNAL', 'MARK_EVIDENCE', 'RESOLVE_CONFLICT');

-- CreateEnum
CREATE TYPE "ClientBrainSectionKey" AS ENUM ('BUSINESS', 'POSITIONING', 'MARKETS', 'COHORTS', 'BELIEFS', 'VOICE', 'OFFERS', 'PROOF', 'BRAND_ASSOCIATIONS', 'PRODUCTION', 'COMMERCIAL_OBJECTIVES', 'CONSTRAINTS', 'PROHIBITED_CLAIMS', 'LEARNINGS');

-- CreateEnum
CREATE TYPE "ClientBrainFieldKey" AS ENUM ('BUSINESS_MODEL', 'PRODUCTS_SERVICES', 'REVENUE_MODEL', 'BUYER', 'PAYER', 'SALES_PROCESS', 'CATEGORY', 'CORE_PROMISE', 'DIFFERENTIATION', 'POINT_OF_VIEW', 'BELIEFS_CHALLENGED', 'BELIEFS_REINFORCED', 'EXPERTISE_BOUNDARIES', 'NON_TARGET_WORK', 'MARKET_NAME', 'GEOGRAPHY', 'MARKET_PROBLEM', 'DEMAND', 'MARKET_PURCHASING_POWER', 'GROWTH', 'COMPETITION', 'COHORT_NAME', 'ROLE', 'COMMERCIAL_SITUATION', 'TRIGGER', 'ACTIVE_PROBLEM', 'CURRENT_BELIEF', 'DESIRED_OUTCOME', 'BUYING_ROLE', 'COHORT_PURCHASING_POWER', 'PLATFORM_PRESENCE', 'WRONG_BELIEF', 'BELIEF_EVIDENCE', 'BETTER_BELIEF', 'COMMERCIAL_CONSEQUENCE', 'BETTER_DECISION', 'RELEVANT_OFFER', 'LANGUAGE', 'DIALECT', 'TONE', 'VOCABULARY', 'SENTENCE_STYLE', 'HUMOR', 'PROHIBITED_PHRASES', 'TERMINOLOGY', 'OFFER_NAME', 'TARGET_COHORT', 'PROMISE', 'OUTCOME', 'DELIVERY', 'PRICE', 'OFFER_PROOF', 'GUARANTEE', 'FAST_WIN', 'CTA_ROUTE', 'CASE_STUDY', 'TESTIMONIAL', 'RESULT', 'ARTIFACT', 'CREDENTIAL', 'DEMONSTRATION', 'DESIRED_ASSOCIATION', 'CURRENT_ASSOCIATION', 'NEGATIVE_ASSOCIATION', 'DISTINCTIVE_ASSET', 'FORMATS', 'TEAM', 'LOCATIONS', 'EQUIPMENT', 'EDITING_CAPACITY', 'POSTING_CAPACITY', 'PRODUCTION_CONSTRAINTS', 'NORTH_STAR', 'LEADING_INDICATOR', 'LAGGING_INDICATOR', 'GUARDRAIL_METRIC', 'LEGAL', 'COMPLIANCE', 'OPERATIONAL', 'BRAND', 'ETHICAL', 'CLAIM', 'REASON', 'APPLICABLE_CONTEXT', 'LEARNING', 'LEARNING_CONTEXT', 'EVIDENCE_LEVEL', 'APPLICABLE_SCOPE', 'LEARNING_CONFIDENCE');

-- CreateEnum
CREATE TYPE "ClientBrainItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISPUTED', 'DRAFT');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'UPDATED', 'REMOVED', 'UNCHANGED', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ConflictResolutionType" AS ENUM ('KEEP_EXISTING', 'REPLACE', 'MERGE', 'STORE_BOTH', 'MARK_UNRESOLVED');

-- CreateEnum
CREATE TYPE "MissingDataGapType" AS ENUM ('MISSING', 'PARTIAL', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'MAP', 'ARCHIVE', 'SOFT_DELETE', 'CONFLICT_RESOLVE', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "brandType" "BrandType" NOT NULL,
    "primaryMarket" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "shortDescription" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMember" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClientRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileType" "SourceFileType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceCategory" "SourceCategory" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "processingStatus" "SourceProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "processingInstructions" TEXT,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "requiresMultimodal" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVersion" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceProcessingJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT,
    "jobType" "JobType" NOT NULL DEFAULT 'PROCESS_SOURCE',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceBlock" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "blockType" "BlockType" NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "locationJson" JSONB NOT NULL,
    "detectedLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedItem" (
    "id" TEXT NOT NULL,
    "sourceBlockId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "informationType" "InformationType" NOT NULL,
    "proposedSectionKey" "ClientBrainSectionKey",
    "proposedFieldKey" "ClientBrainFieldKey",
    "proposedGroupHint" TEXT,
    "normalizedValueText" TEXT,
    "normalizedValueJson" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "detectedLanguage" TEXT,
    "reasoningSummary" TEXT,
    "suggestedTags" TEXT[],
    "isConflictCandidate" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "validationStatus" "ExtractedItemValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationNotes" TEXT,
    "duplicateOfItemId" TEXT,
    "clientBrainItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportReview" (
    "id" TEXT NOT NULL,
    "extractedItemId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionAction" "ImportReviewAction",
    "editedValueText" TEXT,
    "editedValueJson" JSONB,
    "editedSectionKey" "ClientBrainSectionKey",
    "editedFieldKey" "ClientBrainFieldKey",
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrainSection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sectionKey" "ClientBrainSectionKey" NOT NULL,
    "notes" TEXT,
    "cachedCompletenessPercent" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrainSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrainItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sectionKey" "ClientBrainSectionKey" NOT NULL,
    "fieldKey" "ClientBrainFieldKey" NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectLabel" TEXT,
    "valueText" TEXT,
    "valueJson" JSONB,
    "status" "ClientBrainItemStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrainItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrainItemVersion" (
    "id" TEXT NOT NULL,
    "clientBrainItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "valueText" TEXT,
    "valueJson" JSONB,
    "status" "ClientBrainItemStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "changeType" "ChangeType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientBrainItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrainItemSource" (
    "id" TEXT NOT NULL,
    "clientBrainItemId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceBlockId" TEXT,
    "extractedItemId" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ClientBrainItemSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientBrainItemId" TEXT NOT NULL,
    "extractedItemId" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "detectedReason" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictResolution" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "resolutionType" "ConflictResolutionType" NOT NULL,
    "resolvedValueText" TEXT,
    "resolvedValueJson" JSONB,
    "resolvedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ConflictResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissingDataItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sectionKey" "ClientBrainSectionKey" NOT NULL,
    "fieldKey" "ClientBrainFieldKey",
    "gapType" "MissingDataGapType" NOT NULL,
    "suggestedQuestion" TEXT,
    "priority" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MissingDataItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SourceToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SourceToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExtractedItemToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExtractedItemToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Client_organizationId_status_idx" ON "Client"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_name_key" ON "Client"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ClientMember_userId_idx" ON "ClientMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMember_clientId_userId_key" ON "ClientMember"("clientId", "userId");

-- CreateIndex
CREATE INDEX "Source_clientId_processingStatus_idx" ON "Source"("clientId", "processingStatus");

-- CreateIndex
CREATE INDEX "Source_clientId_checksumSha256_idx" ON "Source"("clientId", "checksumSha256");

-- CreateIndex
CREATE INDEX "Source_clientId_isDeleted_idx" ON "Source"("clientId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersion_sourceId_versionNumber_key" ON "SourceVersion"("sourceId", "versionNumber");

-- CreateIndex
CREATE INDEX "SourceProcessingJob_status_scheduledAt_idx" ON "SourceProcessingJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SourceProcessingJob_sourceId_idx" ON "SourceProcessingJob"("sourceId");

-- CreateIndex
CREATE INDEX "SourceBlock_sourceId_sequenceIndex_idx" ON "SourceBlock"("sourceId", "sequenceIndex");

-- CreateIndex
CREATE INDEX "ExtractedItem_sourceId_idx" ON "ExtractedItem"("sourceId");

-- CreateIndex
CREATE INDEX "ExtractedItem_sourceId_informationType_idx" ON "ExtractedItem"("sourceId", "informationType");

-- CreateIndex
CREATE INDEX "ExtractedItem_proposedSectionKey_proposedFieldKey_idx" ON "ExtractedItem"("proposedSectionKey", "proposedFieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImportReview_extractedItemId_key" ON "ImportReview"("extractedItemId");

-- CreateIndex
CREATE INDEX "ImportReview_clientId_status_idx" ON "ImportReview"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrainSection_clientId_sectionKey_key" ON "ClientBrainSection"("clientId", "sectionKey");

-- CreateIndex
CREATE INDEX "ClientBrainItem_clientId_sectionKey_idx" ON "ClientBrainItem"("clientId", "sectionKey");

-- CreateIndex
CREATE INDEX "ClientBrainItem_clientId_sectionKey_fieldKey_idx" ON "ClientBrainItem"("clientId", "sectionKey", "fieldKey");

-- CreateIndex
CREATE INDEX "ClientBrainItem_clientId_groupId_idx" ON "ClientBrainItem"("clientId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrainItemVersion_clientBrainItemId_versionNumber_key" ON "ClientBrainItemVersion"("clientBrainItemId", "versionNumber");

-- CreateIndex
CREATE INDEX "ClientBrainItemSource_clientBrainItemId_idx" ON "ClientBrainItemSource"("clientBrainItemId");

-- CreateIndex
CREATE INDEX "ClientBrainItemSource_sourceId_idx" ON "ClientBrainItemSource"("sourceId");

-- CreateIndex
CREATE INDEX "Conflict_clientId_status_idx" ON "Conflict"("clientId", "status");

-- CreateIndex
CREATE INDEX "ConflictResolution_conflictId_idx" ON "ConflictResolution"("conflictId");

-- CreateIndex
CREATE INDEX "MissingDataItem_clientId_sectionKey_idx" ON "MissingDataItem"("clientId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_clientId_label_key" ON "Tag"("clientId", "label");

-- CreateIndex
CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "_SourceToTag_B_index" ON "_SourceToTag"("B");

-- CreateIndex
CREATE INDEX "_ExtractedItemToTag_B_index" ON "_ExtractedItemToTag"("B");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceProcessingJob" ADD CONSTRAINT "SourceProcessingJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceBlock" ADD CONSTRAINT "SourceBlock_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceBlock" ADD CONSTRAINT "SourceBlock_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedItem" ADD CONSTRAINT "ExtractedItem_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "SourceBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedItem" ADD CONSTRAINT "ExtractedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportReview" ADD CONSTRAINT "ImportReview_extractedItemId_fkey" FOREIGN KEY ("extractedItemId") REFERENCES "ExtractedItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrainSection" ADD CONSTRAINT "ClientBrainSection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrainItem" ADD CONSTRAINT "ClientBrainItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrainItemVersion" ADD CONSTRAINT "ClientBrainItemVersion_clientBrainItemId_fkey" FOREIGN KEY ("clientBrainItemId") REFERENCES "ClientBrainItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrainItemSource" ADD CONSTRAINT "ClientBrainItemSource_clientBrainItemId_fkey" FOREIGN KEY ("clientBrainItemId") REFERENCES "ClientBrainItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_clientBrainItemId_fkey" FOREIGN KEY ("clientBrainItemId") REFERENCES "ClientBrainItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_extractedItemId_fkey" FOREIGN KEY ("extractedItemId") REFERENCES "ExtractedItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingDataItem" ADD CONSTRAINT "MissingDataItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceToTag" ADD CONSTRAINT "_SourceToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceToTag" ADD CONSTRAINT "_SourceToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractedItemToTag" ADD CONSTRAINT "_ExtractedItemToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "ExtractedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractedItemToTag" ADD CONSTRAINT "_ExtractedItemToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
