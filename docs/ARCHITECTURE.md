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

## Module 3 — Guided Client Setup + Script Intelligence Compiler + First Reel Generator

Additive on top of everything above, with one architectural addition: a **question engine** (DB-backed, code-defined) sitting alongside the existing service layer, and a **compiler boundary** (`scriptContextCompiler`) that is the only thing standing between approved data and the AI generation layer. Expert Mode is the Module 1 Client Brain UI, moved to `/brain/expert` without a single line changed; Guided Mode is entirely new UI on top of the same tables.

### Service map

```
guidedSetup.service.ts           GuidedSetupSession lifecycle (start/resume/complete)
guidedQuestion.service.ts        syncQuestionCatalog() upserts QUESTION_CATALOG into
                                  GuidedSetupQuestionDefinition; listActiveQuestions/getQuestionByKey
guidedAnswer.service.ts          findTrustedAnswer (source-priority resolver), getNextQuestion,
                                  submitAnswer/skipQuestion, applyAnswerToDestination (writes onto
                                  the correct existing entity via WORKING_ENTITY_MARKER), getSetupSummary
uiPreference.service.ts          per-user brainModePreference (GUIDED/EXPERT)
guidedBrainOverview.service.ts   the Guided Mode status/summary, delegating readiness + next-best-action
                                  to the two services below
scriptReadiness.service.ts       getScriptReadiness — gathers approved-only facts, calls the pure
                                  computeScriptReadiness()
nextBestAction.service.ts        getNextBestAction — conflicts > setup progress > readiness gaps >
                                  pending AI reviews > create/continue a Reel
scriptContextCompiler.service.ts compileScriptContext — the trust boundary (see below)
scriptContextSnapshot.service.ts persists/retrieves immutable ScriptContextSnapshot rows
reelScriptGeneration.service.ts  generateReelScript — compiles, snapshots, calls AIProvider,
                                  runs all 8 gates, assembles + Zod-validates the ReelScriptPackage
reelScriptValidation.service.ts  validateReelScript wrapper + recordValidationOverride (audited)
reelScriptVersion.service.ts     createReelGeneration/createReelVersion — immutable ReelGeneration/
                                  ReelVersion persistence; a version is never edited in place
reelScriptEdit.service.ts        the 3 Improvement Actions (applyHookSelection, applyScriptEdit,
                                  regenerateReel), each re-validating through the same 8 gates
```

### The Script Impact rule and the question catalog

`server/domain/script-impact.ts` exports `validateQuestionScriptImpact({key, scriptImpacts})` — a question is valid only if `scriptImpacts.length > 0` or its key is in a small `SYSTEM_ONLY_ALLOWED_KEYS` set (client id/name/workspace owner/created date). `server/domain/guided-question-catalog.ts` defines every question as a typed `QuestionCatalogEntry` (id/key/section/user-facing question/helper/example/answer type/options/required level/conditional logic/script impacts/destination entity+field/plain-language + expert labels/display order) and a unit test asserts the entire `QUESTION_CATALOG` passes the rule, has no duplicate keys, and covers all 8 sections. `syncQuestionCatalog()` upserts this code-defined list into the `GuidedSetupQuestionDefinition` table — the UI reads from the database (satisfying "configurable, never hardcoded in React"), while the actual source of truth stays type-checked and versioned in code.

### The Guided Setup answer engine

```
getNextQuestion(sessionId, clientId)
  ├─ walk QUESTION_CATALOG in section/displayOrder, skipping already-answered
  │    keys and any question whose conditionalLogic isn't satisfied by prior answers
  ├─ for the next unanswered question, findTrustedAnswer():
  │    existing approved Client Brain item → existing approved strategy entity
  │    (resolved via WORKING_ENTITY_MARKER — which prior answer names *this*
  │    session's Cohort/CommercialSituation/BeliefMap/Offer/ProofItem) →
  │    a high-confidence reviewed answer from an earlier session → none
  └─ return {question, trusted} — the UI prefills but never silently commits
       a trusted value; the user still confirms it

submitAnswer → applyAnswerToDestination(): a switch on destinationEntity that
  fetches-and-merges the full existing entity (never a single-field patch — the
  same "always pass the complete field set" convention the Module 1/2 services
  already expect) before calling the entity's own update service, or writes to
  ClientBrainItem / ScriptIntelligenceField directly for facts with no
  normalized home yet.
```

`ScriptIntelligenceField` is explicitly a **read-optimized index, not a duplicate store of truth** — it exists only for script-relevant facts (content objective, voice technicality/examples, execution duration, safety avoid-topics) that have no existing normalized column anywhere else in the schema.

### `scriptContextCompiler` — the trust boundary

```
compileScriptContext({clientId, cohortId, contentObjective, platform, offerId?, ...})
  ├─ load the Cohort; warn (never throw) if it isn't approved
  ├─ load CommercialSituation / BeliefMap for that cohort (explicit id or the
  │    most-recently-approved one) — same pattern for both
  ├─ Offer: only auto-inferred when contentObjective === OFFER_PROMOTION
  │    (an explicit offerId always wins) — never attaches a commercial ask
  │    to content the user didn't ask to sell in
  ├─ ProofItem[]: only APPROVED, needsReview=false, PUBLIC/PUBLIC_ANONYMOUS —
  │    internal-only or unreviewed proof never reaches the AI
  ├─ Client Brain voice/business/safety fields + ScriptIntelligenceField rows,
  │    each recorded as a grounding.sourceReferences entry
  ├─ open Conflict detection on the relevant sections → warnings
  ├─ computeScriptReadiness() → grounding.missingCriticalInputWarnings
  └─ ScriptGenerationContextSchema.parse(context) — the compiler validates its
       own output before returning it; nothing ungoverned can leak through
```

Every object in `ScriptGenerationContextSchema` is `.strict()`, so an unexpected field fails loudly rather than silently reaching the AI prompt. `createScriptContextSnapshot()` persists the compiled context as an immutable `ScriptContextSnapshot` — a new compile never edits an old one, so any past Reel can be traced back to exactly what it was grounded in via `contextSnapshotId`.

### AI generation pipeline

```
generateReelScript
  ├─ compileScriptContext + createScriptContextSnapshot
  ├─ AIProvider.generateReelScript(context, {requestedStyle?})
  │    — context is the ONLY authorized information passed in; requestedStyle
  │      (from the Create First Reel wizard's "what style?" step) is appended
  │      to the prompt as a non-authoritative bias, never a fact source
  ├─ ReelScriptDraftSchema.safeParse (OpenAIProvider) — malformed output is
  │    rejected outright, never coerced
  ├─ computeReelValidation(context, draftPackage) — all 8 gates (below)
  ├─ summarizeGatesForPackage() — condenses the 8 gates into the package's
  │    6-key audits summary (e.g. claimSafety = worse of Factual Grounding
  │    and Claim Safety; platformFit = worse of Duration and CTA Fit)
  └─ ReelScriptPackageSchema.parse(finalPackage) — the assembled package is
       re-validated before it's ever returned or persisted
```

### The 8 validation gates (`server/domain/reel-validation.ts`)

`computeReelValidation(context, package)` is pure and returns one `{key, status, note}` per gate — **Strategic Grounding** (source references exist; a belief-change objective needs an approved belief chain), **Factual Grounding** (an "approved" claim status requires approved proof), **Voice** (no prohibited phrase in the script text; language data exists), **CTA Fit** (a requested CTA needs text and an approved route), **Production Feasibility** (requested editing level doesn't exceed the client's known capacity), **Duration** (word count vs. declared seconds, checked against a **configurable words-per-minute-by-language** table — `WORDS_PER_MINUTE_BY_LANGUAGE`), **Comprehension** (long-sentence and jargon-vs-technicality heuristics), **Claim Safety** (blocks prohibited claims, expired claims, invented guarantees/scarcity, and non-public proof — all via substring/regex checks against the client's own `safety.neverClaim`/`safety.expiredClaims` lists, never a hardcoded denylist alone).

`isReadyToMarkReady(gates, overrides)` — Ready only if every gate is `PASS` or explicitly overridden. `recordValidationOverride()` (`reelScriptValidation.service.ts`) requires a `reason`, writes a permanent `AuditLog` row (`action: APPROVE`, `entityType: ReelValidationGate`), and returns an override record — the gate's own computed status is never rewritten; only whether it blocks readiness changes.

### Reel versioning + Improvement Actions

`reelScriptVersion.service.ts` persists `ReelGeneration` (denormalized `currentVersionNumber` + `status`) and an append-only `ReelVersion` per change — mirroring the `CohortVersion`/`BeliefMapVersion` convention exactly. `reelScriptEdit.service.ts` implements the 3 Improvement Actions, each re-fetching the exact authorized context via `getReelGenerationWithContext()` (which re-parses the persisted `ScriptContextSnapshot`, never trusts a stale in-memory copy), re-running `computeReelValidation`, and calling `createReelVersion` — a version is never edited in place:

- **Change the hook** — deterministic, no AI call: swaps the chosen `hookOptions[i]` text into the script's opening HOOK segment.
- **Edit the script** — a manual user edit to the segments; word count and duration are recomputed from the edited text, not trusted from the client.
- **Regenerate** — reruns the whole AI pipeline from the same client/cohort/objective/platform, producing a fresh draft and a fresh version.

### Create First Reel + Reel Result UI

The wizard (`/reels/new`) never asks for funnel stage, cognitive objective, or any strategy jargon — `inferStrategicDirection()` (`server/domain/strategic-direction.ts`) derives a plain-language funnel stage and cognitive objective purely from the content objective the user picked, for the wizard's final preview screen only (the AI's own `strategy.funnelStage`/`cognitiveObjective` in the generated package is independent and can differ). The Reel Result page (`/reels/[generationId]`) renders the package as structured UI sections — never raw JSON — with the 8 gates and source list tucked into a collapsed-by-default "Safety and Sources" panel.
