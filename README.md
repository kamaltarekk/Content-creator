# Commercial Attention OS — Modules 1 & 2

**Module 1: Multi-Client Workspace + Source Importer + Client Brain**
**Module 2: Cohort + Buying Decision + Belief Intelligence**

A multi-client commercial strategy and content operating system, built module by module without refactoring the data model. Module 1 establishes the foundational architecture (auth, permissions, source import, the Client Brain). Module 2 builds directly on top of it, turning the approved Client Brain into a **commercial reasoning system**: cohort → commercial situation → trigger → active problem → current workflow → current belief → behavior → commercial consequence → objection/risk → evidence → better belief → better commercial decision.

The core product rule carries through both modules: **nothing AI-extracted or AI-suggested is ever auto-trusted.** Every Client Brain item and every strategy entity (cohort, situation, decision, belief) is human-approved and fully source-traceable, with a version history that's never overwritten.

---

## Product summary

- **Multi-client, isolated workspaces** under one organization, with role-based access enforced server-side.
- **Upload-first**: original files are stored unchanged; images/audio/video are accepted and flagged for (not-yet-built) multimodal processing rather than faked.
- **AI-structured, human-reviewed**: uploaded sources are parsed into location-preserving blocks, each classified by an AI provider into a proposed Client Brain destination, then queued for human review. Nothing reaches the Client Brain without approval.
- **Source-traceable & version-controlled**: every approved item links back to its exact source (file, block, approver, timestamp) and keeps full version history.
- **Conflict-safe**: a new value that materially differs from approved strategy opens a Conflict and is never silently overwritten.
- **Completeness & gaps**: a confidence-weighted setup-completeness indicator and a missing-data report with specific follow-up questions.
- **Module 2 — a commercial reasoning system, not a persona generator**: cohorts are grounded in a real commercial situation (never a demographic label), buying decisions map who's actually involved and what they need to believe, and the Belief-to-Decision Engine forces every "wrong belief" through a materially-different reframe before it can be approved — never a trivial antonym swap.
- **AI strategy suggestions are reviewed, not applied**: every AI-suggested cohort/situation/decision/belief carries confidence, source references, missing evidence, and possible conflicts, and sits in a review queue until a human approves, edits, merges, or rejects it. Bulk approval only ever touches high-confidence, non-duplicate, conflict-free suggestions.
- **A thin reference layer, not a duplicate graph**: the Strategic Relationship Graph connects cohorts, situations, decisions, beliefs, and evidence without copying their data, and rejects cross-client relationships server-side regardless of what the UI sends.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript strict |
| Styling | Tailwind CSS v4, hand-authored shadcn/ui primitives, dark "strategy room" theme |
| Forms / data | React Hook Form + Zod, TanStack Query, Zustand (sparingly) |
| Auth | Auth.js v5 (Credentials provider, JWT sessions) + bcrypt |
| Database | PostgreSQL + Prisma ORM |
| Jobs | In-process `LocalJobRunner` backed by the `SourceProcessingJob` table (swap-ready for BullMQ/Inngest/Trigger.dev) |
| Storage | `StorageProvider` interface + local filesystem impl (swap-ready for S3) |
| AI | `AIProvider` interface + OpenAI implementation (structured JSON validated by Zod) — `classifyBlock` (Module 1) and `suggestStrategy` (Module 2) |
| Tests | Vitest (unit + integration), Playwright (e2e) |

---

## Local setup

### Prerequisites

- Node.js 20.9+ and **pnpm**
- PostgreSQL 14+ (a `docker-compose.yml` is provided; any local Postgres works too)

### 1. Install

```bash
pnpm install
```

### 2. Database

Start Postgres (Docker):

```bash
docker compose up -d
```

…or point `DATABASE_URL` at any existing Postgres instance.

### 3. Environment

```bash
cp .env.example .env
# then fill in AUTH_SECRET (openssl rand -base64 32) and, optionally, OPENAI_API_KEY
```

### 4. Migrate + seed

```bash
pnpm db:migrate      # apply migrations
pnpm db:seed         # create the demo org, users, and the Kamal Ghamry demo client
```

### 5. Run

```bash
pnpm dev
```

Open http://localhost:3000 and sign in with a seeded account:

| Email | Password | Role |
|---|---|---|
| `owner@demo-agency.test` | `password123` | OWNER |
| `strategist@demo-agency.test` | `password123` | STRATEGIST |
| `approver@demo-agency.test` | `password123` | CLIENT_APPROVER (scoped to the demo client only) |

---

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Auth.js JWT secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Base URL for Auth.js callbacks (`http://localhost:3000`) |
| `OPENAI_API_KEY` | Enables AI classification. **Optional** — without it, uploads are parsed and stored but classification is skipped (sources land in `NEEDS_ATTENTION`); it never fabricates results. |
| `OPENAI_MODEL` | Model id (default `gpt-4.1-mini`) |
| `STORAGE_LOCAL_ROOT` | Where original files are stored (default `.data/uploads`) |
| `NEXT_PUBLIC_APP_URL` | App base URL for the client |

---

## File-processing flow

```
Upload → store original (checksum, dedup, sanitize, size/type validate, security-scan hook)
       → create Source + SourceVersion(1) + PENDING SourceProcessingJob
       → LocalJobRunner claims the job (FOR UPDATE SKIP LOCKED)
       → extract into location-preserving SourceBlocks (per file type)
       → classify each block → ExtractedItem + PENDING ImportReview
       → deterministic validation (enum re-check, duplicates, low-confidence flags)
       → Source status: READY_FOR_REVIEW (or NEEDS_ATTENTION / FAILED)
```

Fully parsed formats: **CSV, XLSX, TXT, Markdown, DOCX, text-based PDF.** Each extractor preserves the exact origin of every block (CSV row, XLSX sheet+row, TXT/Markdown line ranges, DOCX paragraph index, PDF page). Image / audio / video / scanned PDF are accepted and stored but routed to a `ProcessingAdapter` stub that reports "unsupported" — it never invents extraction results.

The worker starts lazily (`ensureJobRunnerStarted()`) from Node-only server contexts (the upload action and status route), not from `instrumentation.ts`, because instrumentation is also compiled for the Edge runtime where the storage provider's Node imports can't be bundled.

## AI classification flow

Each block is sent to the `AIProvider` (`server/providers/ai/`). The OpenAI implementation requests strict JSON validated against `ClassificationSchema` (Zod): `information_type`, `proposed_destination`, `proposed_field`, `normalized_value`, `confidence`, `detected_language`, `is_conflict_candidate`, a short user-safe `reasoning_summary` (never chain-of-thought), and `suggested_tags`. The schema's `superRefine` enforces that the proposed field belongs to the proposed section and that strategic types carry a destination. A deterministic pass then re-validates, flags low-confidence items, and links exact duplicates. **Every result becomes a PENDING review — nothing is written to the Client Brain automatically.**

On approval, `clientBrainService.applyApproval` writes the item with a version row and a source-traceability link — unless the value materially conflicts with an existing approved item, in which case it opens a `Conflict` (marking the existing item `DISPUTED`) and refuses to overwrite until the conflict is explicitly resolved.

## Module 2 — Cohort + Buying Decision + Belief Intelligence

Builds a normalized reasoning layer on top of the Client Brain — new models, not new `ClientBrainFieldKey`s. Existing Client Brain COHORTS/BELIEFS/PROOF items are referenced as sources (`CohortSourceReference`, `EvidenceLink`), never duplicated or overwritten.

**Tools:**

| Tool | Route | Purpose |
|---|---|---|
| Strategy Intelligence Overview | `/c/[clientId]/strategy` | Entity counts, Strategy Setup Readiness, pending suggestions, recent cohorts |
| Cohort Lab + Cohort Detail | `/strategy/cohorts` | Create/edit/approve/merge/split cohorts; quality validator; source traceability |
| Buying Decision Map + Committee Mapper | `/strategy/decisions` | Every buying decision across cohorts; a lightweight visual (no graph library) always paired with an accessible, editable table for the buying committee, objections, and decision criteria |
| Belief-to-Decision Engine | `/strategy/beliefs` | The central 11-part reasoning chain; 3-pane detail (reasoning chain / evidence / validation) |
| Strategic Relationship Graph | `/strategy/relationships` | A thin reference layer (`StrategicEntity` + `StrategicRelationship`) connecting cohorts/situations/decisions/beliefs/evidence without duplicating their data |
| AI Suggestion Review Queue | `/strategy/reviews` | Every AI-proposed entity, with confidence/source/reasoning/missing-evidence/conflicts, resolved by an explicit human action |
| Strategy Setup Readiness | `/strategy/readiness` | Weighted setup-completeness score, per-cohort gap breakdown, specific follow-up questions, saved snapshots |

**The reasoning chain:** Cohort → Commercial Situation → Trigger → Active Problem → Current Workflow → Current Belief → Behavior → Commercial Consequence → Objection/Risk → Evidence → Better Belief → Better Commercial Decision.

**Quality gates (deterministic, never auto-rewrite):**
- `cohort-quality.ts` flags cohorts that read as a demographic label ("Women 25–45") instead of a grounded commercial situation, and cohorts missing a linked situation, trigger, or buying decision.
- `belief-quality.ts` flags trivial reframes — a "better belief" that's a one-word antonym swap (e.g. "Marketing is difficult" → "Marketing can be easy") or too similar (Dice coefficient) to the current belief — and requires an actionable, developed better commercial decision.
- `evidence.ts` classifies a belief's evidence as **missing / weak / exists / contradictory** (a single `DISPUTED` link always wins, even next to strong evidence), and the UI always shows which state applies.

**AI Strategy Suggestion pipeline:** `AIProvider.suggestStrategy()` proposes one entity (cohort/situation/decision/committee member/belief/evidence link/relationship) from authorized, client-scoped context only — never inventing facts. Every suggestion is Zod-validated (`StrategySuggestionSchema`), persisted as `AI_SUGGESTED` with a `PENDING` `StrategySuggestionReview`, and independently checked against the live database for duplicates (Dice-coefficient name/statement matching) regardless of what the AI itself reports. Nothing is ever auto-approved. A human resolves each suggestion with one of nine actions — approve, edit & approve, reject, keep as hypothesis, merge (into a detected duplicate), attach to an existing cohort, attach as evidence, mark for research, or defer — and every resolution is audited. Bulk approval only ever applies to suggestions that are simultaneously high-confidence, non-duplicate, and conflict-free; anything else is skipped, never forced.

**Client isolation is absolute at the graph layer too:** `strategicRelationship.service.ts` rejects a relationship whose two `StrategicEntity` endpoints belong to different clients, server-side, regardless of what the UI sends.

## Permission model

Roles: `OWNER`, `ADMIN`, `STRATEGIST`, `EDITOR`, `VIEWER`, `CLIENT_APPROVER`.

- Org-wide roles (all but `CLIENT_APPROVER`) grant their actions across every client in the org.
- `CLIENT_APPROVER` gets **no** access from org membership alone — only through an explicit `ClientMember` row, so it can review/approve one assigned client and cannot see others.
- `EDITOR` can view the brain, edit drafts, and approve non-conflict items, but cannot approve conflicts or resolve them. The same split applies to Module 2 (`strategy.edit` vs. `strategy.approve` / `strategy.approve.conflict`) — `EDITOR` can draft cohorts/beliefs/etc. but cannot approve them, approve a conflict, or resolve a dispute.
- `strategy.suggest` (triggering AI generation) is granted to the same roles as `strategy.approve` (`OWNER`/`ADMIN`/`STRATEGIST`).

All authorization is enforced server-side (`server/auth/permissions.ts` → `requireAction` / `requireClientAccess`). Component-level role checks are UX only.

## Testing

```bash
pnpm test         # Vitest unit + integration (needs Postgres for the integration tests)
pnpm test:e2e     # Playwright e2e (builds + starts the app, re-seeds, drives the full journey)
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
```

Coverage highlights — **Module 1**: classification schema validation, brain-schema integrity, conflict-detection rules, completeness calculation, permission matrix, source-location preservation, duplicate detection (unit); classification, review→approval→traceability, conflict resolution, duplicate detection (integration); and the full sign-in → create-client → upload → process → review → resolve-conflict → Client Brain → source-trace journey (e2e).

Coverage highlights — **Module 2**: cohort quality, belief quality (trivial-reframe detection), strategy permission matrix, evidence-state classification, duplicate matching + bulk-approvability, readiness calculation, AI strategy-suggestion schema validation (unit); cross-client relationship prevention, cohort version preservation, the AI suggestion pipeline (generate → pending review → approve creates the entity / reject creates nothing → duplicate detection → bulk-approve skips low-confidence), and the full chain — create cohort → link source → add situation → add decision → add buying-role participant → create belief map → link evidence → approve an AI suggestion → detect a duplicate → readiness moves off zero → every step audited (integration); and the full cohort → committee → belief → AI review → relationships → readiness journey against the seeded client (e2e).

## Known limitations

- **AI is optional in this build**: without `OPENAI_API_KEY`, uploaded sources are parsed but not classified (they land in `NEEDS_ATTENTION`). The seeded demo ships pre-classified items so the full flow is explorable without a key.
- **Auth**: uses Credentials + JWT sessions rather than the Auth.js Prisma *adapter* (the adapter's DB sessions are incompatible with the Credentials provider). Auth is still Prisma-backed at the data layer.
- **Entity grouping**: cohorts/offers/beliefs/markets/proof are modeled as multiple field rows sharing a `groupId`; the review-approval flow creates one item per approved field, and richer grouping in the UI is a follow-up. The seed demonstrates grouped items directly.
- **Multimodal**: image/audio/video/scanned-PDF are stored and flagged only — no OCR/ASR yet (a `ProcessingAdapter` seam is in place).
- **Single organization per user** in v1; an org switcher is a future module.
- **XLSX** uses `exceljs` (not SheetJS/`xlsx`, whose npm distribution is frozen).
- **Search** uses Postgres `ILIKE` behind a `searchService` abstraction; a full-text/vector backend can replace it without changing callers.
- **Team management** is a read view (members + roles + assignments); invitations and role changes are a planned next step.
- **Module 2 AI suggestions** are optional in the same way classification is: without `OPENAI_API_KEY`, `suggestStrategy()` throws rather than fabricating a suggestion; the seeded demo ships three pre-made suggestions (an AI-suggested cohort, a duplicate candidate, a conflicting buying-role suggestion) so the review queue is explorable keyless.
- **Auto-appliable suggestion types**: the review queue can directly create a `Cohort`, `CommercialSituation`, `BuyingDecision`, `BuyingRoleParticipant`, `BeliefMap`, `EvidenceLink`, or `StrategicRelationship` from an approved suggestion. Types needing a parent (a situation/decision/belief needs a target cohort; a committee member needs a target decision) let the reviewer pick or override the target before approving.
- **Buying Committee visualization** is a lightweight, self-contained influence-axis layout (no external graph library) — always paired with an accessible table, which is the actual editable surface. The Strategic Relationship Graph uses the same pattern.
- **Evidence linking** in Module 2 is intentionally lightweight (a description + strength + optional trace to an existing Client Brain PROOF/LEARNINGS item); a full Evidence/Claims Vault with structured claims and citations is a later module.

## Recommended next module

**Offer + Proof + Claims Architecture** — build on the approved Client Brain and the Module 2 reasoning layer (cohorts, buying decisions, beliefs, `relevantOfferPlaceholder`) to structure offers, proof assets, and claims into a governed, evidence-backed library, replacing the current free-text placeholders and lightweight `EvidenceLink` rows with first-class, versioned entities. That data — a cohort's better belief and better commercial decision, paired with a specific offer and its proof — is what later script-generation modules will consume directly.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — service boundaries, request/processing flows, provider abstractions.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — every model, enum, and the key relationships.
