# Architecture

## Layers

```
app/            Next.js App Router pages + route handlers (thin — no business logic)
components/     UI: shadcn primitives, layout, clients, sources, review, brain, search, dashboard
hooks/          TanStack Query mutation/query hooks (client)
server/
  actions/      "use server" entry points — auth check, then delegate to a service
  services/     ALL business logic lives here (framework-agnostic, unit/integration-testable)
  auth/         Auth.js config split (Edge-safe + Node) and the permission helpers
  jobs/         JobRunner interface + LocalJobRunner + handler registry
  extraction/   per-file-type extractors + dispatcher
  providers/    storage / ai / processing / security abstractions (each swappable)
  domain/       pure, dependency-free rules (brain schema, permission matrix, similarity)
  db/           Prisma client singleton
types/          shared serializable view types (review, brain) + next-auth augmentation
```

**Golden rule:** React components never contain business logic. A page (Server Component) or an action calls a service; the service is the only thing that touches Prisma, storage, or the AI provider. This is what makes the logic testable without the framework and keeps authorization in one place.

## Request lifecycle (a mutation)

```
Client component → hook (TanStack Query) → server action ("use server")
  → requireAction(...)  (server-side authorization — always)
  → service method       (business logic, Prisma, audit log)
  → revalidatePath / router.refresh
```

Every action begins with `requireAction` / `requireClientAccess` (`server/auth/permissions.ts`). These resolve the Auth.js session and check it against the static permission matrix (`server/domain/permission-matrix.ts`). The pure `can()` / `hasClientAccess()` functions live in the domain layer so they can be unit-tested without the auth chain.

## Source processing pipeline

```
uploadSource (service)
  ├─ validate size/type, sanitize filename, checksum, dedup, security-scan hook
  ├─ store original via StorageProvider (path-traversal-safe keys)
  └─ create Source + SourceVersion(1) + PENDING SourceProcessingJob

LocalJobRunner (polling loop, ~2s)
  ├─ claim one due PENDING job: raw SQL UPDATE ... FOR UPDATE SKIP LOCKED
  └─ run the handler for the job type

processSource handler
  ├─ extractAndPersistBlocks:  StorageProvider.read → dispatcher → SourceBlock rows
  │                            (each block carries locationLabel + locationJson)
  ├─ classifySourceBlocks:     AIProvider.classifyBlock per block (bounded concurrency)
  │                            → ExtractedItem + PENDING ImportReview
  ├─ validateSourceExtraction: enum re-check, exact-duplicate linking, low-confidence flags
  └─ set Source.processingStatus (READY_FOR_REVIEW | NEEDS_ATTENTION | FAILED)
```

**Source status machine:** `UPLOADED → QUEUED → PROCESSING → { READY_FOR_REVIEW | NEEDS_ATTENTION | FAILED } → COMPLETED` (COMPLETED is recomputed by `recalculateSourceCompletion` once every `ImportReview` for the source has left PENDING).

**Why the worker starts lazily:** `instrumentation.ts` is compiled for the Edge runtime too (middleware exists), and webpack can't bundle the storage provider's `node:` imports there. So the worker is started with `ensureJobRunnerStarted()` from Node-only contexts (the upload action and the status route) instead. Replacing `LocalJobRunner` with BullMQ/Inngest is a matter of implementing the same `JobRunner` interface and dropping the poll loop.

## Review → Client Brain (the trust boundary)

```
resolveReview (import.service)
  ├─ REJECT / KEEP_AS_RAW → resolve the review, never touch the brain
  ├─ MARK_* → reclassify the information type, then approve
  └─ APPROVE / APPROVE_WITH_EDIT / REMAP → applyApproval (clientBrain.service)
       ├─ find an existing ACTIVE item on the same client/section/field
       ├─ compareValues (conflict.service) per field value type
       │    ├─ conflict → open a Conflict, mark existing DISPUTED, DO NOT overwrite,
       │    │             leave the review PENDING until resolved
       │    └─ no conflict → new version + source link (or a fresh item)
       └─ always: ClientBrainItemVersion + ClientBrainItemSource + AuditLog
```

Conflicts are created at **approval time** against the live brain (not at extraction time), because the brain can change between extraction and review. The AI's `is_conflict_candidate` is only a review-queue filter hint.

## Provider abstractions

Each provider is an interface with a swappable implementation, so infrastructure changes never reach the services:

| Interface | Impl (this build) | Swap target |
|---|---|---|
| `StorageProvider` | `LocalStorageProvider` (filesystem) | S3-compatible |
| `AIProvider` | `OpenAIProvider` (JSON-mode, Zod-validated) | any model provider |
| `ProcessingAdapter` | `StubProcessingAdapter` (reports "unsupported") | OCR / ASR |
| `SecurityScanner` | `NoopSecurityScanner` | antivirus / content scan |
| `JobRunner` | `LocalJobRunner` (table + poll) | BullMQ / Inngest / Trigger.dev |

## Deterministic domain rules (`server/domain/`)

Pure, dependency-free, and unit-tested:

- `brain-schema.ts` — `SECTION_FIELD_MAP`, labels, entity sections, field value types, section weights, critical fields, follow-up questions. The single source of truth reused by classification, conflicts, completeness, and the UI.
- `permission-matrix.ts` — role → actions, plus `can()` / `hasClientAccess()`.
- `similarity.ts` — Sørensen–Dice coefficient for conflict/entity matching.
- `source-schema.ts`, `client-schema.ts` — Zod schemas + file-type detection + filename sanitization.

## Conflict detection algorithm

`compareValues(field, existing, proposed)` picks a comparison by the field's value type:

- **percentage** (growth, demand, purchasing power): conflict if `|new − old| > max(2, |old| × 0.15)`.
- **numeric** (price): conflict if relative difference `> 10%`.
- **list** (formats, team, prohibited phrases, …): pure additions are a safe merge; conflict if `> 30%` of items are removed.
- **free text** (most fields): Dice similarity — `≥ 0.82` unchanged, `0.5–0.82` updated-but-conflicting, `< 0.5` strong conflict.

## Completeness score

`computeCompleteness(items)` (pure) — per weighted section: `coverage` = fraction of critical fields present (best-populated group for entity sections), `score` = `coverage × avgConfidence` (manual items count as fully confident), overall = weighted sum across the 10 scored sections. The other 4 sections are tracked but unweighted. Always presented as a "setup-completeness indicator", never an objective quality score.

## Module 2 — Cohort + Buying Decision + Belief Intelligence

Additive on top of everything above: new services, new domain rules, new routes under `(app)/c/[clientId]/strategy/`, reusing the same request lifecycle, permission wrappers, `AIProvider`/`getAIProvider()`/`pLimit` seam, and `$transaction` + version-row + traceability conventions. No Module 1 file was rewritten to build it.

### Service map

```
cohort.service.ts               Cohort + CohortVersion + CohortSourceReference; merge/split
commercialSituation.service.ts  CommercialSituation + CommercialSituationVersion
buyingDecision.service.ts       BuyingDecision + BuyingDecisionVersion
buyingCommittee.service.ts      BuyingRoleParticipant / Objection / DecisionCriterion (unversioned children)
belief.service.ts               BeliefMap + BeliefMapVersion
evidenceLink.service.ts         EvidenceLink (lightweight; full Evidence/Claims Vault is a later module)
strategicEntity.service.ts      upsert/remove the StrategicEntity reference row on entity create/rename/archive
strategicRelationship.service.ts StrategicRelationship; rejects cross-client relationships server-side
strategyConflict.service.ts     deterministic duplicate detection (Dice coefficient) against the live DB
strategySuggestion.service.ts   generateStrategySuggestion / resolveSuggestion / bulkApproveSuggestions
strategyReadiness.service.ts    computeStrategyReadiness (pure) + live aggregation + snapshot persistence
```

Every entity service that creates or renames a row also calls `upsertStrategicEntity()`, keeping the Strategic Relationship Graph's reference layer in sync without any batch job.

### Deterministic quality gates (`server/domain/`)

- `cohort-quality.ts` — `validateCohortQuality()`: flags a cohort that reads as a demographic label (short name, no situational markers, no grounded definition) and flags missing links to a commercial situation, trigger, or buying decision. Never rewrites — only reports `{score, level, issues[]}`.
- `belief-quality.ts` — `validateBeliefQuality()`: the 6-part completeness check (current belief, behavior, consequence, evidence-or-flagged-gap, materially-different better belief, actionable better decision). A trivial reframe is caught two ways: a Dice-coefficient similarity above threshold between current and better belief, or a small hard-coded antonym-pair list (difficult/easy, hard/easy, ...) — either flags `isTrivialReframe`.
- `evidence.ts` — `evidenceState()`: pure classification into missing/weak/exists/contradictory. Deliberately kept out of any `"server-only"` file so `EvidenceBadge` (a client component) can import it directly.
- `strategy-conflict.ts` — `findMostSimilar()` (Dice coefficient, same primitive as Module 1's `similarity.ts`) for duplicate detection, and `isBulkApprovable()` (confidence ≥ 0.75, not a duplicate candidate, zero possible conflicts) — the single source of truth the review-queue UI and the bulk-approve server action share.

### AI Strategy Suggestion pipeline

```
generateStrategySuggestion (strategySuggestion.service)
  ├─ build authorized, client-scoped context (Client Brain digest, existing
  │  cohort/belief digest with ids, selected audience signals)
  ├─ AIProvider.suggestStrategy()  — JSON-mode, Zod-validated (StrategySuggestionSchema)
  ├─ detectSuggestionDuplicate (strategyConflict.service) — independent, deterministic
  │  check against the live DB, regardless of what the AI itself reported
  └─ persist StrategySuggestion(AI_SUGGESTED) + StrategySuggestionReview(PENDING)

resolveSuggestion (strategySuggestion.service) — the single dispatcher for every
human action: APPROVE / EDIT_APPROVE / REJECT / KEEP_HYPOTHESIS / MERGE /
ATTACH_COHORT / ATTACH_EVIDENCE / MARK_RESEARCH / DEFER. Only the first four
(and the two ATTACH_* actions) ever create or attach data; every action
resolves the review and is audited (a new `SUGGEST` AuditAction records
generation, `APPROVE`/`REJECT` record the resolution).

bulkApproveSuggestions — loops the requested ids, applies isBulkApprovable()
per suggestion, and only calls resolveSuggestion(..., "APPROVE") for the ones
that pass; everything else is skipped, never forced.
```

`proposed_fields` is a `Record<string, string|string[]|number|null>` because its shape genuinely varies by `suggestion_type` (documented in the OpenAI system prompt); `applySuggestionAsEntity()` reads known keys per type (`asStr`/`asNum` helpers) and falls back to a reviewer-supplied target id (`targetCohortId`/`targetDecisionId`/`targetEntityId`) when the AI didn't — or couldn't — supply one.

### Strategic Relationship Graph

`StrategicEntity` is a thin, denormalized reference row (`entityType` + `entityId` + `title` + `status`) — never a copy of the real entity's fields. `StrategicRelationship` connects two `StrategicEntity` rows via real Prisma relations (two named relations to the same model, `RelationshipFrom`/`RelationshipTo`), which is what makes cross-client prevention a simple, server-side equality check: both endpoints' `clientId` must equal the relationship's `clientId`, or `createStrategicRelationship` throws `CrossClientRelationshipError` before anything is written.

### Strategy Setup Readiness

`computeStrategyReadiness(stats)` mirrors `computeCompleteness`'s shape exactly, but the unit of analysis is the **cohort**, not a Client Brain field: each of the 8 weighted categories (cohort definition 20, situations 15, triggers 10, decisions 15, committee 10, beliefs 15, evidence 10, better decisions 5) is the fraction of cohorts for which that part of the chain is populated. `getPerCohortReadiness()` reuses the same underlying query to produce a per-cohort gap list, and `getSpecificFollowUpQuestions()` pairs the generic per-category question with the actual cohort missing it — never a context-free prompt. `createReadinessSnapshot()` persists a point-in-time `StrategyReadinessSnapshot` on demand; nothing is snapshotted automatically.
