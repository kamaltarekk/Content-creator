# Data Model

PostgreSQL via Prisma. Full schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

The defining design decision: **the Source Library and the Client Brain are separate object graphs.** Uploaded content lives in `Source → SourceVersion → SourceBlock → ExtractedItem`; approved strategy lives in `ClientBrainItem → ClientBrainItemVersion`. They are joined only through the review pipeline (`ExtractedItem → ImportReview`) and the traceability table (`ClientBrainItemSource`).

## Entity groups

### Auth & tenancy
- **User** — login identity (`email`, `passwordHash`).
- **Organization** — the top-level tenant.
- **OrganizationMember** — `User` ↔ `Organization` with an `OrgRole`.
- **Client** — an isolated workspace under an `Organization` (`brandType`, `status`, metadata). All client-scoped data hangs off this.
- **ClientMember** — `User` ↔ `Client` with a `ClientRole`. The **only** thing that grants a `CLIENT_APPROVER` access to a client.

### Source Library
- **Source** — an uploaded file (`fileType`, `mimeType`, `checksumSha256`, `storageKey`, `confidentiality`, `processingStatus`, `requiresMultimodal`, soft-delete via `isDeleted`/`deletedAt`). Original is never hard-deleted.
- **SourceVersion** — append-only versions of a source's file.
- **SourceProcessingJob** — the durable job queue row (`status`, `attempts`, `scheduledAt`, `resultSummary`). Drained by `LocalJobRunner`.
- **SourceBlock** — one segmented block with `blockType`, `rawText`, `locationLabel`, and `locationJson` (the exact origin: CSV row, XLSX sheet+row, PDF page, DOCX paragraph index, or TXT/MD line range). This is what makes every downstream item source-traceable.

### Extraction & review
- **ExtractedItem** — an AI classification of one block: `informationType`, `proposedSectionKey`/`proposedFieldKey`, `normalizedValueText`, `confidence`, `reasoningSummary`, `isConflictCandidate`, `validationStatus`, `duplicateOfItemId`. May later point at the `ClientBrainItem` it produced.
- **ImportReview** — the human-review gate for one extracted item (`status` PENDING/RESOLVED, `resolutionAction`, edit/remap overrides, reviewer, timestamp). **Nothing enters the Client Brain without one of these resolving to an approving action.**

### Client Brain
- **ClientBrainSection** — one row per client per section (14 sections), holds section-level notes / cached completeness.
- **ClientBrainItem** — **one row per section + field** (never a JSON blob). Repeatable entities (a cohort, offer, belief, market, proof) are multiple rows sharing a `groupId` + `subjectLabel`. Carries `valueText`, `status` (ACTIVE / ARCHIVED / DISPUTED / DRAFT), `confidence`, `currentVersionNumber`.
- **ClientBrainItemVersion** — append-only version history (`changeType` Added/Updated/Removed/Unchanged/Conflicting, author, note). History is never mutated.
- **ClientBrainItemSource** — the traceability link: item ↔ `sourceId` / `sourceBlockId` / `extractedItemId` / `approvedById` / `approvedAt`. Supports multiple corroborating sources per item.

### Conflicts
- **Conflict** — connects an existing `ClientBrainItem` with a proposed `ExtractedItem` (`status` OPEN/RESOLVED/IGNORED, `detectedReason`, `similarityScore`). Created at approval time; never auto-overwrites.
- **ConflictResolution** — the recorded outcome (`resolutionType` KeepExisting/Replace/Merge/StoreBoth/MarkUnresolved, resolved value, resolver).

### Supporting
- **MissingDataItem** — a tracked gap (section/field, `gapType`, `suggestedQuestion`). (The missing-data report is also computed live from the brain.)
- **Tag** — client-scoped label, joined to `Source` and `ExtractedItem`.
- **AuditLog** — every meaningful change (`action` CREATE/UPDATE/APPROVE/REJECT/MAP/ARCHIVE/SOFT_DELETE/CONFLICT_RESOLVE/…), with actor, entity, and metadata. Powers the Overview recent-activity feed.

## Key relationships

```
Organization 1─* Client 1─* Source 1─* SourceVersion
                              │           └─* SourceBlock 1─* ExtractedItem 1─1 ImportReview
                              └─* SourceProcessingJob

Client 1─* ClientBrainItem 1─* ClientBrainItemVersion
                            └─* ClientBrainItemSource ──→ Source / SourceBlock / ExtractedItem

Conflict ──→ ClientBrainItem (existing) + ExtractedItem (proposed)
         1─* ConflictResolution
```

## Enums (highlights)

- **OrgRole / ClientRole** — OWNER, ADMIN, STRATEGIST, EDITOR, VIEWER, CLIENT_APPROVER.
- **SourceProcessingStatus** — UPLOADED, QUEUED, PROCESSING, NEEDS_ATTENTION, READY_FOR_REVIEW, COMPLETED, FAILED.
- **InformationType** — STRATEGIC_FACT, CLIENT_PREFERENCE, AUDIENCE_SIGNAL, EVIDENCE, HYPOTHESIS, EXAMPLE, PERFORMANCE_LEARNING, RAW_NOTE, EXTERNAL_SOURCE, CONFLICT, MISSING_INFORMATION.
- **ImportReviewAction** — APPROVE, APPROVE_WITH_EDIT, REJECT, REMAP, KEEP_AS_RAW, MARK_HYPOTHESIS, MARK_AUDIENCE_SIGNAL, MARK_EVIDENCE, RESOLVE_CONFLICT.
- **ClientBrainSectionKey** — the 14 sections (Business, Positioning, Markets, Cohorts, Beliefs, Voice, Offers, Proof, Brand Associations, Production, Commercial Objectives, Constraints, Prohibited Claims, Learnings).
- **ClientBrainFieldKey** — ~80 fields across those sections. The two spec name collisions on `purchasing_power` are disambiguated as `MARKET_PURCHASING_POWER` / `COHORT_PURCHASING_POWER`; a few other fields are prefixed to stay globally unique in the flat enum (e.g. `BELIEF_EVIDENCE`, `OFFER_PROOF`, `PRODUCTION_CONSTRAINTS`, `LEARNING_CONTEXT`, `LEARNING_CONFIDENCE`).
- **ClientBrainItemStatus** — ACTIVE, ARCHIVED, DISPUTED, DRAFT.
- **ChangeType** — ADDED, UPDATED, REMOVED, UNCHANGED, CONFLICTING.
- **ConflictStatus / ConflictResolutionType**, **MissingDataGapType**, **AuditAction**, **ConfidentialityLevel** (INTERNAL / CLIENT_CONFIDENTIAL / RESTRICTED), **BrandType**, **BlockType**, **JobStatus / JobType**.

## Module 2 — Cohort + Buying Decision + Belief Intelligence

Purely additive: 18 new models, all client-scoped, none of them a `ClientBrainFieldKey`. Existing Client Brain COHORTS/BELIEFS/PROOF/MARKETS items are referenced as sources, never duplicated.

### Entity groups

- **Cohort / CohortVersion / CohortSourceReference** — the grounded commercial-situation unit (never a demographic label). `Cohort` carries identity, commercial context, current state, and psychological/attention fields as real columns (`emotionalDrivers`/`platformPresence` are the only `String[]` list columns). Versioned like `ClientBrainItem`: `currentVersionNumber` + a `CohortVersion` child mirroring every mutable field. `CohortSourceReference` links a cohort to a Client Brain item, an extracted item, a raw source/block, or a manual audience-signal note, tagged with a `CohortSourceRelationshipType` (SUPPORTS/CONTRADICTS/INSPIRED_BY/VALIDATES/WEAK_SIGNAL/STRONG_SIGNAL/CONTEXT_ONLY).
- **CommercialSituation / CommercialSituationVersion** — belongs to a `Cohort`; carries a `TriggerType`, trigger description, active problem, and current workflow.
- **BuyingDecision / BuyingDecisionVersion** — belongs to a `Cohort`, optionally references a `CommercialSituation`; carries a `DecisionType`.
- **BuyingRoleParticipant / Objection / DecisionCriterion** — lightweight, unversioned children of a `BuyingDecision` (no version history — these are additive facts about a committee, not evolving strategic statements). `BuyingRoleParticipant.role` is a `BuyingRole` (USER/INITIATOR/INFLUENCER/CHAMPION/EVALUATOR/APPROVER/DECISION_MAKER/PAYER/BLOCKER/PROCUREMENT/LEGAL/TECHNICAL_REVIEWER/OTHER). `Objection` resolves via a `resolutionNote` + `ARCHIVED` status rather than deletion.
- **BeliefMap / BeliefMapVersion** — the central 11-part reasoning tool: `observedSituation → currentInterpretation → currentBeliefStatement (+ BeliefType) → behaviorCaused → commercialConsequence → betterBeliefStatement → betterCommercialDecision`, plus `relevantOfferPlaceholder` (free text until the Offer + Proof + Claims module exists). Belongs to a `Cohort`, optionally a `CommercialSituation`.
- **EvidenceLink** — lightweight (a full Evidence/Claims Vault is a later module): `targetEntityType` + `targetEntityId` (relation-less, since it can point at any strategy entity), `beliefMapId` populated as a convenience relation when the target is a belief, `evidenceStrength` (ANECDOTAL/WEAK/MODERATE/STRONG/VERIFIED/DISPUTED), optional trace to a Client Brain item.
- **StrategicEntity / StrategicRelationship** — the reference layer for the Strategic Relationship Graph. `StrategicEntity` denormalizes `entityType` + `entityId` + `title` + `status` (never the real fields); upserted whenever a strategy entity is created or renamed. `StrategicRelationship` connects two `StrategicEntity` rows via two named Prisma relations (`RelationshipFrom`/`RelationshipTo`) with a `StrategicRelationshipType` (EXPERIENCES/TRIGGERED_BY/BELIEVES/CAUSED_BY/CAUSES/BLOCKED_BY/REQUIRES/EVALUATES_BY/PARTICIPATES_IN/SUPPORTS/CONTRADICTS/REFRAMES/CHANGES_DECISION/SERVED_BY/RELEVANT_TO/VALIDATES/INVALIDATES); cross-client relationships are rejected server-side.
- **StrategySuggestion / StrategySuggestionReview** — mirrors `ExtractedItem`/`ImportReview`: an AI-proposed entity (`StrategySuggestionType`) with `proposedFields`/`sourceReferences`/`possibleConflicts`/`suggestedRelationships` as `Json` (their shape genuinely varies by type), `confidence`, `reasoningSummary`, `missingEvidence`, and duplicate-detection fields (`isDuplicateCandidate`, `duplicateOfEntityType`, `duplicateOfEntityId`). `StrategySuggestionReview` is the human-review gate (`ImportReviewStatus` reused: PENDING/RESOLVED), recording which of the 9 `StrategySuggestionAction`s (APPROVE/EDIT_APPROVE/REJECT/KEEP_HYPOTHESIS/MERGE/ATTACH_COHORT/ATTACH_EVIDENCE/MARK_RESEARCH/DEFER) was taken and the resulting entity, if any.
- **StrategyReadinessSnapshot** — a point-in-time save of the Strategy Setup Readiness score (`overallScore`, `sectionScores` Json, `followUpQuestions` list). Generated on demand, never automatically.

### Key relationships

```
Client 1─* Cohort 1─* CohortVersion
              │      └─* CohortSourceReference ──→ ClientBrainItem / ExtractedItem / Source / SourceBlock
              ├─* CommercialSituation 1─* CommercialSituationVersion
              ├─* BuyingDecision 1─* BuyingDecisionVersion
              │        ├─* BuyingRoleParticipant
              │        ├─* Objection
              │        └─* DecisionCriterion
              └─* BeliefMap 1─* BeliefMapVersion
                       └─* EvidenceLink ──→ ClientBrainItem (optional trace)

Client 1─* StrategicEntity 1─* StrategicRelationship (fromEntity)
                          └─* StrategicRelationship (toEntity)

Client 1─* StrategySuggestion 1─1 StrategySuggestionReview
Client 1─* StrategyReadinessSnapshot
```

### Enums (highlights)

- **StrategyEntityStatus** — DRAFT, ACTIVE, ARCHIVED. **StrategyApprovalStatus** — AI_SUGGESTED, DRAFT, UNDER_REVIEW, APPROVED, REJECTED, DISPUTED (the same trust-boundary shape as `ClientBrainItemStatus`, but distinct — Module 2 entities are never marked `ACTIVE`/`APPROVED` except through an explicit human action).
- **CohortPriority / EvidenceStrength / TriggerType / DecisionType / BuyingRole / BeliefType** — see `server/domain/strategy-schema.ts` for the full label maps.
- **AuditAction** gained `MERGE`, `SPLIT`, `SUGGEST` (additive — Module 1's existing values are untouched).

## Notes on JSON columns

JSON is used only where the structure is genuinely variable:
- `SourceBlock.locationJson` — the file-type-specific location payload.
- `ExtractedItem.normalizedValueJson`, `ClientBrainItem.valueJson`, `ClientBrainItemVersion.valueJson` — reserved for structured values; the current UI uses `valueText`.
- `SourceProcessingJob.resultSummary`, `AuditLog.metadata` — free-form diagnostics.
- `StrategySuggestion.proposedFields/sourceReferences/possibleConflicts/suggestedRelationships` — the AI's proposed fields, source references, and possible conflicts genuinely vary in shape by `suggestionType` (a cohort's fields aren't a belief's fields); each shape is still Zod-validated (`StrategySuggestionSchema`) before it's ever persisted.
- `StrategyReadinessSnapshot.sectionScores` — a per-category breakdown snapshot; the live score is always recomputed from real rows, this is just a point-in-time save.

The Client Brain itself is **not** a JSON blob — each field is a real, queryable row, which is what makes per-field conflict detection, versioning, and completeness scoring possible. The same discipline holds in Module 2: every cohort/situation/decision/belief field that's structurally fixed is a real column; `Json` only appears where the shape is inherently variable (the AI suggestion payload) or is an intentional point-in-time snapshot.
