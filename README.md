# Commercial Attention OS — Module 1

**Multi-Client Workspace + Source Importer + Client Brain**

The first production module of a multi-client commercial strategy and content operating system. It establishes the foundational architecture so later modules (script generation, offer analysis, competitor analysis, analytics) can be added without refactoring the data model.

The core product rule: **the Source Library (everything uploaded) and the Client Brain (only reviewed and approved strategic knowledge) are structurally distinct.** Nothing AI-extracted is ever auto-trusted — every Client Brain item is human-approved and fully source-traceable.

---

## Product summary

- **Multi-client, isolated workspaces** under one organization, with role-based access enforced server-side.
- **Upload-first**: original files are stored unchanged; images/audio/video are accepted and flagged for (not-yet-built) multimodal processing rather than faked.
- **AI-structured, human-reviewed**: uploaded sources are parsed into location-preserving blocks, each classified by an AI provider into a proposed Client Brain destination, then queued for human review. Nothing reaches the Client Brain without approval.
- **Source-traceable & version-controlled**: every approved item links back to its exact source (file, block, approver, timestamp) and keeps full version history.
- **Conflict-safe**: a new value that materially differs from approved strategy opens a Conflict and is never silently overwritten.
- **Completeness & gaps**: a confidence-weighted setup-completeness indicator and a missing-data report with specific follow-up questions.

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
| AI | `AIProvider` interface + OpenAI implementation (structured JSON validated by Zod) |
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

## Permission model

Roles: `OWNER`, `ADMIN`, `STRATEGIST`, `EDITOR`, `VIEWER`, `CLIENT_APPROVER`.

- Org-wide roles (all but `CLIENT_APPROVER`) grant their actions across every client in the org.
- `CLIENT_APPROVER` gets **no** access from org membership alone — only through an explicit `ClientMember` row, so it can review/approve one assigned client and cannot see others.
- `EDITOR` can view the brain, edit drafts, and approve non-conflict items, but cannot approve conflicts or resolve them.

All authorization is enforced server-side (`server/auth/permissions.ts` → `requireAction` / `requireClientAccess`). Component-level role checks are UX only.

## Testing

```bash
pnpm test         # Vitest unit + integration (needs Postgres for the integration tests)
pnpm test:e2e     # Playwright e2e (builds + starts the app, re-seeds, drives the full journey)
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
```

Coverage highlights: classification schema validation, brain-schema integrity, conflict-detection rules, completeness calculation, permission matrix, source-location preservation, duplicate detection (unit); classification, review→approval→traceability, conflict resolution, duplicate detection (integration); and the full sign-in → create-client → upload → process → review → resolve-conflict → Client Brain → source-trace journey (e2e).

## Known limitations

- **AI is optional in this build**: without `OPENAI_API_KEY`, uploaded sources are parsed but not classified (they land in `NEEDS_ATTENTION`). The seeded demo ships pre-classified items so the full flow is explorable without a key.
- **Auth**: uses Credentials + JWT sessions rather than the Auth.js Prisma *adapter* (the adapter's DB sessions are incompatible with the Credentials provider). Auth is still Prisma-backed at the data layer.
- **Entity grouping**: cohorts/offers/beliefs/markets/proof are modeled as multiple field rows sharing a `groupId`; the review-approval flow creates one item per approved field, and richer grouping in the UI is a follow-up. The seed demonstrates grouped items directly.
- **Multimodal**: image/audio/video/scanned-PDF are stored and flagged only — no OCR/ASR yet (a `ProcessingAdapter` seam is in place).
- **Single organization per user** in v1; an org switcher is a future module.
- **XLSX** uses `exceljs` (not SheetJS/`xlsx`, whose npm distribution is frozen).
- **Search** uses Postgres `ILIKE` behind a `searchService` abstraction; a full-text/vector backend can replace it without changing callers.
- **Team management** is a read view (members + roles + assignments); invitations and role changes are a planned next step.

## Recommended next module

**Client Strategy & Offers** — build on the approved Client Brain to structure offers, cohorts, and positioning into a scored strategy, then layer script generation on top. The data model already separates Offers/Cohorts/Beliefs/Positioning as first-class sections, so this module consumes the Client Brain rather than re-deriving it.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — service boundaries, request/processing flows, provider abstractions.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — every model, enum, and the key relationships.
