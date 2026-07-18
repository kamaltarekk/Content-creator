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

## Notes on JSON columns

JSON is used only where the structure is genuinely variable:
- `SourceBlock.locationJson` — the file-type-specific location payload.
- `ExtractedItem.normalizedValueJson`, `ClientBrainItem.valueJson`, `ClientBrainItemVersion.valueJson` — reserved for structured values; the current UI uses `valueText`.
- `SourceProcessingJob.resultSummary`, `AuditLog.metadata` — free-form diagnostics.

The Client Brain itself is **not** a JSON blob — each field is a real, queryable row, which is what makes per-field conflict detection, versioning, and completeness scoring possible.
