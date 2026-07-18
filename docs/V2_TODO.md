# The Garden — Version 2 TODO

## Scope rule

This checklist implements the frozen Version 2 scope.

Do not add new product features while executing these phases.

Allowed during implementation:

- resolve technical conflicts;
- improve security;
- correct accessibility;
- fix migration defects;
- clarify an already-approved feature;
- reduce scope when required for stability.

Not allowed without a new approval:

- new Region;
- public user accounts;
- comments or community features;
- AI auto-publishing;
- AI semantic search;
- page builder;
- new backend service;
- features listed as non-goals in `V2_MASTER_SPEC.md`.

---

# Phase 0 — Version 2 documentation and audit

- [ ] Read `AGENTS.md`
- [ ] Read Version 1 `MASTER_SPEC.md`
- [ ] Read Version 1 `CONTENT.md`
- [ ] Read Version 1 `TODO.md`
- [ ] Read `README.md`
- [ ] Read `docs/V2_MASTER_SPEC.md`
- [ ] Read `docs/V2_CONTENT.md`
- [ ] Read `docs/V2_MIGRATION.md`
- [ ] Audit the actual `main` implementation
- [ ] Confirm all eight main routes
- [ ] Confirm all four detail-route families
- [ ] Confirm all 19 V1 content items
- [ ] Confirm `/index` rewrite behavior
- [ ] Confirm `/search` behavior
- [ ] Confirm `/api/seed-gardener`
- [ ] Record V1 document/implementation differences
- [ ] Record current test commands
- [ ] Record current deployment configuration
- [ ] Do not modify page behavior before audit completion

Acceptance:

- [ ] V1 baseline report completed
- [ ] migration inventory completed
- [ ] no V1 document overwritten

---

# Phase 1 — Preview environment and Supabase foundation

## 1A. Branch and deployment

- [ ] Create or confirm a dedicated V2 development branch
- [ ] Configure Vercel Preview deployment
- [ ] Keep `main` as Production
- [ ] Confirm Preview URL
- [ ] Confirm Production remains unchanged

## 1B. Separate data environments

- [ ] Create Supabase Preview project
- [ ] Create Supabase Production project
- [ ] Configure separate environment variables
- [ ] Verify Preview cannot write Production
- [ ] Verify Production does not read Preview

## 1C. Supabase client foundation

- [ ] Add minimum Supabase dependencies
- [ ] Create server-side Supabase client
- [ ] Create browser client only where required
- [ ] Keep service-role credentials server-only
- [ ] Add environment validation
- [ ] Add safe missing-configuration errors

Acceptance:

- [ ] Preview deploy succeeds
- [ ] separate Supabase projects verified
- [ ] lint passes
- [ ] typecheck passes
- [ ] build passes

---

# Phase 2 — Database schema and security

## 2A. Core tables

- [x] Create `contents`
- [x] Create `content_versions`
- [x] Create `growth_notes`
- [x] Create `content_relations`
- [x] Create `tags`
- [x] Create `content_tags`
- [x] Create `home_curation`
- [x] Create `site_copy`
- [x] Create `ai_settings`
- [x] Create `visitor_notes`
- [x] Create analytics storage or aggregate tables
- [x] Create redirect/migration table
- [x] Create preview-token table or secure equivalent

## 2B. Storage

- [x] Create cover-image bucket
- [x] Limit upload formats
- [x] Limit upload size
- [x] Define public-read behavior for Published covers
- [x] Restrict upload, replace, and delete to Garden Keeper

## 2C. Constraints

- [x] Region enum/validation
- [x] Content Type enum/validation
- [x] Growth Stage enum/validation
- [x] lifecycle enum/validation
- [x] unique Region + slug constraint
- [x] relation self-reference prevention
- [x] duplicate relation prevention
- [x] maximum one cover image per item
- [x] required alt text before publication

## 2D. RLS and permissions

- [x] Public reads only approved Published content
- [x] Draft and Review are not publicly queryable
- [x] Archived content body is not publicly queryable by collection endpoints
- [ ] Visitor note insert is allowed safely
- [x] Visitor note list/read is admin-only
- [x] Admin writes require authenticated Garden Keeper
- [x] Analytics read is admin-only
- [x] Storage writes are admin-only

Acceptance:

- [x] database migrations reproducible
- [x] RLS tests pass
- [x] Storage policy tests pass
- [ ] no secret exposed client-side
- [ ] Preview database reset procedure documented

---

# Phase 3 — Content service and V1 migration tooling

## 3A. Shared domain types

- [x] Extend Version 1 content types
- [x] Add lifecycle
- [x] Add bilingual fields
- [x] Add Growth Notes
- [x] Add relations
- [x] Add cover metadata
- [x] Add Featured and manual order
- [x] Add created/published/last-tended timestamps

## 3B. Validation

- [x] Create content validation
- [ ] Create Markdown import validation
- [x] Create publication validation
- [x] Create cover validation
- [x] Create relation validation
- [x] Create Growth Note validation

## 3C. Content service

- [x] Create content service boundary
- [x] Create legacy static-content adapter
- [x] `getPublishedContent`
- [x] `getPublishedContentByRoute`
- [x] Harden the public read adapter for legacy, dual, and database source modes
- [x] Keep public DTOs free of internal IDs, admin metadata, and migration fields
- [x] Make dual-read collection merging database-first and route-deduplicated
- [x] Require explicit adjacent source-mode transition configuration
- [x] Validate database public reads and lifecycle controls before database-only mode
- [x] Fail closed when database fallback eligibility cannot be verified
- [x] Preserve adjacent database-to-dual-to-legacy rollback controls
- [x] Document route, metadata, sitemap, search, and deployment cache refresh requirements
- [x] Add all-Region source-cutover route smoke contracts
- [ ] `getAdminContent`
- [x] `createDraft`
- [x] `updateDraft`
- [ ] `moveToReview`
- [x] `publishContent`
- [ ] `archiveContent`
- [ ] `restoreArchivedContent`
- [x] `deleteArchivedContent`
- [ ] `updateGrowthStage`
- [ ] `manageRelations`
- [ ] `manageHomeCuration`
- [ ] `manageFeatured`
- [ ] `createVersion`
- [ ] `restoreVersion`

## 3D. V1 migration script

- [x] Create deterministic migration tooling foundation
- [x] Extract Garden 5 items
- [x] Extract Forest 5 items
- [x] Extract Lake 5 items
- [x] Extract Ruins 4 items
- [x] Preserve IDs as `contents.legacy_id`
- [x] Preserve slugs
- [x] Preserve Region
- [x] Preserve Content Type
- [x] Preserve summaries
- [x] Preserve confirmed statuses; originally report missing Lake Growth Stages (superseded by Task 08A-2)
- [x] Preserve full/short detail level
- [x] Preserve detail body
- [x] Convert only Ruins `grewInto`
- [ ] Seed fixed categories
- [ ] Seed Version 1 public copy
- [x] Produce machine-readable migration report
- [x] Complete deterministic dry-run verification with no database writes
- [x] Add typed per-record import preview output
- [x] Reuse extract, transform, verify, and shared publication validation
- [x] Report exact blockers, compatibility warnings, and child readiness
- [x] Detect destination legacy ID and Region/slug conflicts from snapshots
- [x] Generate deterministic source, destination, and preview digests
- [x] Define approved-snapshot and unchanged-source approval checks
- [x] Add deterministic, blocker, warning, write-safety, invalidation, and digest tests
- [x] Adopt the legacy Published `publishedAt: null` exception without derived dates
- [x] Add manual Growth Stage resolution input and per-record audit metadata
- [x] Retire the five historical Pending Growth Stage decisions under Task 08A-2
- [x] Supersede the five Lake decisions: Lake Reflection null means not growth-tracked / not applicable
- [x] Centralize Growth Stage applicability across content, migration, Admin, Draft, and Review validation
- [x] Make `contents` and `content_revisions` nullable with database applicability constraints
- [x] Remove the five-record Lake blocker from preview, snapshot validation, and import preflight
- [x] Harden Admin and public null display without inventing an enum value or resolution
- [x] Require complete fields, passing validation, resolved blockers, and digests before approval readiness
- [x] Add blocker-resolution, policy, digest-invalidation, and no-execution tests
- [x] Add the Task 08A deterministic Growth Stage resolution file contract
- [x] Reuse V2 Growth Stage runtime validation for migration resolutions
- [x] Report resolution digest, approved records, validation status, and review notes
- [x] Reject unknown stages, malformed source identities, and duplicate approvals
- [x] Add the Task 08B complete approved migration snapshot format
- [x] Freeze source records, destination mappings, resolved stages, relations, metadata, and warnings
- [x] Require matching schema, preview, resolution, source, and destination digests for approval
- [x] Add deterministic READY/BLOCKED machine and human approval reports
- [x] Invalidate approved snapshots when content, resolution, preview, or destination state changes
- [x] Require the full approved snapshot and snapshot digest at import preparation
- [x] Add unresolved-blocker, valid-approval, digest, stale-state, incomplete-record, and determinism tests
- [x] Retire the obsolete requirement for five Lake reviewer approvals under Task 08A-2
- [x] Regenerate the 08B-1 preview at 19 ready, 0 blocked with all five Lake nulls preserved
- [x] Bind approved snapshots to validation-policy version and schema digest
- [x] Reject old snapshots after applicability, preview, schema, or validation-rule changes
- [x] Generate the deterministic 08B-1 READY artifact without resolutions or import execution
- [x] Add a server/script-only Preview import executor
- [x] Require an approved snapshot, explicit matching digest, unchanged source/destination, and zero blockers
- [x] Add one service-role-only transactional import RPC and immutable import receipt
- [x] Create contents, initial immutable versions, valid relations, tags, content tags, and approved structured metadata atomically
- [x] Preserve V1 identity and migration provenance in every initial version
- [x] Return an idempotent existing result for a completed import digest
- [x] Run post-import count, slug, relation, lifecycle, and version verification before commit
- [x] Add invalid approval, digest mismatch, idempotency, rollback, relation, and version tests
- [x] Add explicit BLOCKED, READY, SUCCESS, and FAILED import execution states
- [x] Bind the durable receipt to snapshot, Preview, and resolution digests
- [x] Record imported count, warnings, timestamp, and SUCCESS status only after commit
- [x] Reuse verification pass criteria for exact slug, Region, lifecycle, version, and relation checks
- [x] Prevent a post-import verification failure from producing a success receipt
- [x] Add deterministic read-only post-import migration verification tooling
- [x] Add the 08D-1 fixed 19-identity post-import verification boundary, including Lake-null and non-Lake Growth Stage applicability
- [x] Add 08D-2 database-source read verification for all Region collections, 19 detail routes, metadata, relations, and Lake-null Growth Stages
- [x] Add 08D-3 Keeper Admin verification for all 19 imported contents, Regions, and Growth Stage presentation
- [x] Verify content counts by total, Region, and Content Type
- [x] Verify source identity, slug, Region, lifecycle, duplicates, missing, and unexpected records
- [x] Verify one immutable initial version and complete migration provenance per item
- [x] Verify relation count, targets, orphan safety, and Published endpoint lifecycle
- [x] Verify Growth Stage, Growth Notes, tags, content-tag bindings, and structured metadata digests
- [x] Verify Published, Archived, Draft, and Review behavior through supplied public-service probes
- [x] Emit deterministic human and machine reports with PASS, FAIL, WARNING, digest, timestamp, and checks
- [x] Add missing-content, slug, relation, version, and determinism tests
- [x] Add a deterministic Phase 06E cutover readiness checklist
- [x] Define guarded legacy to dual to database source-mode transitions
- [x] Document cutover prerequisites, risks, rollback conditions, and cache invalidation
- [x] Add the final operator migration runbook without switching source mode
- [x] Add checklist, rollback, transition, and failed-verification gate tests
- [ ] Apply the Phase 06C migration and run the rollback-only SQL test in Preview
- [ ] Execute an approved Preview import after real Growth Stage approvals exist
- [ ] Collect real Preview V2 query results and run Phase 06D verification
- [ ] Supply real backup, monitoring, cache, redirect, and public-read readiness evidence
- [ ] Approve a future cutover window; Phase 06E leaves source mode unchanged

Acceptance:

- [ ] exactly 19 initial items imported
- [ ] all old public URLs resolve in Preview
- [x] no invented content in the migration bundle
- [x] migration execution is repeatable by digest
- [x] migration execution prevents duplicate records

---

# Phase 4 — GitHub authentication and Garden Keeper shell

## 4A. Authentication

### 4A-1. Auth Foundation

- [x] Add Auth foundation code structure
- [x] Add PKCE callback with authorization-code exchange
- [x] Add cookie-backed session handling and refresh synchronization
- [x] Add server-only current-user, logout, and safe redirect helpers
- [x] Add boolean-only Garden Keeper authorization foundation

### 4A-2. Provider deployment and admin route integration

- [ ] Configure Supabase GitHub provider
- [x] Create `/admin` login flow
- [ ] Verify GitHub provider identity
- [ ] Allow only the approved `moonsoul608` account
- [ ] Prefer immutable GitHub provider ID for authorization
- [ ] Connect logout helper to the future admin flow
- [x] Add unauthorized state
- [ ] Protect admin Server Actions and Route Handlers
- [x] Verify client-side state cannot bypass server checks

## 4B. Garden Keeper layout

- [x] Responsive admin shell
- [x] Dashboard
- [ ] Content navigation
- [ ] Greenhouse configuration navigation
- [ ] Notes navigation
- [ ] Analytics navigation
- [ ] Settings navigation
- [ ] Internal notification summary
- [x] Keyboard navigation
- [x] visible focus
- [x] mobile basic-use layout

### 4B-1. Admin Dashboard foundation

- [x] Add a Keeper-only read service for dashboard aggregation
- [x] Show total content and mutually exclusive lifecycle counts
- [x] Map active Review work for never-published Draft projections
- [x] Add typed Recent Activity and Quick Actions placeholders
- [x] Add safe empty and workspace-unavailable states
- [x] Keep dashboard data fetching server-side with no client mutation path
- [x] Verify authorization boundary, lifecycle mapping, and empty states

Acceptance:

- [ ] non-admin access denied
- [ ] admin session works in Preview
- [ ] no public admin data
- [ ] accessibility smoke check passes

## 4C-1. Content write foundation

- [x] Audit `contents`, `content_versions`, database types, and write RLS
- [x] Add a mutable Draft/Review `content_revisions` workspace
- [x] Keep `content_versions` append-only
- [x] Add server-only admin service and write-repository boundaries
- [x] Add typed `createDraft`, `updateDraft`, and `startDraftRevision` contracts
- [x] Require verified Garden Keeper authorization at every mutation boundary
- [x] Prepare optimistic revision concurrency without UI or publishing

## 4C-2. Draft management

- [x] Complete Keeper-only `createDraft`, `updateDraft`, and `startDraftRevision`
- [x] Keep actor, timestamps, lifecycle, and lock metadata server-managed
- [x] Reject stale Draft updates with typed `revision_conflict` errors
- [x] Keep Published and Archived projections unchanged while starting a Draft
- [x] Preserve the immutable source-version reference for cloned Drafts
- [x] Add Keeper-only `getDraftById` and filter-ready `listDrafts` queries
- [x] Reuse Draft-level title, slug, Growth Stage, and cover validation
- [x] Reject direct Draft-to-Published or Draft-to-Archived mutation
- [x] Verify Draft management authorization, lifecycle, and concurrency tests

## 4C-3. Review workflow

- [x] Add Keeper-only `prepareReview`, `submitForReview`, and `returnToDraft`
- [x] Re-run shared server validation before Draft-to-Review submission
- [x] Report normalized data, missing requirements, slug and cover status, Growth Note consistency, relation issues, and Published differences
- [x] Make Review revisions read-only in both the service and database audit trigger
- [x] Record server-derived submission and return actors/timestamps
- [x] Preserve optimistic locking and keep Published projections/version history unchanged
- [x] Verify Review authorization, validation, immutability, transitions, and conflicts

## 4D-1. Atomic publishing

- [x] Add the narrow Keeper-only `publish_review_revision` RPC
- [x] Lock and validate the content projection and Review revision atomically
- [x] Preserve stable slugs, Regions, original publication time, and immutable cover references
- [x] Synchronize normalized public tags inside the publication transaction
- [x] Create one immutable version snapshot and consume Review only after it succeeds
- [x] Return a durable receipt so identical retries are idempotent and mismatches conflict
- [x] Add the typed Admin Content Service and Publish Repository boundary
- [x] Remove direct authenticated Published-projection and version-write bypasses
- [x] Add application tests and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview

## 4D-2A. Archive foundation

- [x] Audit archive fields, immutable checkpoints, active revisions, Home curation, and direct write permissions
- [x] Add the narrow Keeper-only `archive_published_content` RPC
- [x] Lock and validate the Published projection and reject active Draft/Review workspaces atomically
- [x] Create one immutable pre-archive checkpoint with projection, tags, relations, Growth Notes, cover, actor, and timestamp
- [x] Preserve stable identity, route, publication time, body, relations, Growth Notes, and Storage references
- [x] Remove Home curation inside the archive transaction
- [x] Return a durable operation receipt so identical retries are idempotent
- [x] Add typed Admin Content Service and Archive Repository boundaries
- [x] Keep direct authenticated Archived lifecycle and version-write bypasses closed
- [x] Add application tests and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview

## 4D-2B. Restore foundation

- [x] Audit immutable version snapshots, Archived concurrency, revision provenance, and restore bypasses
- [x] Add the narrow Keeper-only `restore_version_to_draft` RPC
- [x] Lock and validate the Archived identity, selected restorable version, concurrency token, and active workspace atomically
- [x] Create an immutable `PreRestore` checkpoint that doubles as the durable idempotency receipt
- [x] Restore only approved editorial fields into a new Draft while preserving the Archived projection and stable identity
- [x] Record source version, operation ID, restore actor, restore timestamp, and initial revision lock server-side
- [x] Keep relations, Growth Notes, Home curation, publication/archive metadata, and Storage references outside automatic restore
- [x] Add typed Admin Content Service and Restore Repository boundaries
- [x] Close generic Archived-clone and direct revision-insert bypasses without weakening RLS or Storage policies
- [x] Add application tests and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview

## 4D-2C. Archived route boundary

- [x] Add a public Published / Archived / not-found route disposition boundary
- [x] Add a dedicated allow-listed Archived resting DTO
- [x] Keep Draft and Review routes indistinguishable from not found
- [x] Prevent dual-read V1 fallback for Archived, Draft, Review, and tombstoned identities
- [x] Keep normal public content and relation queries Published-only
- [x] Limit Archived related targets to current Published projections
- [x] Add lifecycle invalidation hook contracts for route, metadata, sitemap, and search
- [x] Add application tests and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview
- [x] Integrate the boundary into detail routes during the approved route-migration phase
- [ ] Implement the full Archived resting-state design in its approved UI phase

## 4D-3A. Delete safety foundation

- [x] Audit `contents`, `content_versions`, `content_revisions`, relation, redirect, dependent-record, grant, RLS, and Storage behavior before deletion
- [x] Add a Keeper-only server-generated impact preview with canonical/historical routes, redirects, versions, revision state, both relation directions, Storage reference count, and invalidation surfaces
- [x] Add a deterministic impact digest and revalidate it inside the locked deletion transaction
- [x] Add the narrow Keeper-only `delete_archived_content` RPC with Archived-only lifecycle and optimistic-concurrency checks
- [x] Reuse `route_redirects` for canonical and historical terminal 410 records with original content UUID, operation ID, and tombstone time
- [x] Add an append-only operational deletion receipt containing only actor/time, impact counts, and tombstone results
- [x] Remove live inbound/outbound relations before projection deletion while retaining immutable `content_versions` rows
- [x] Preserve Storage objects and immutable version references for the separately approved 04D-3B purge phase
- [x] Return the original receipt for identical operation retries and a typed already-completed result for a later operation
- [x] Keep direct authenticated `contents` and route deletion closed without weakening RLS or Storage policies
- [x] Add typed Admin Content Service/repository contracts, application tests, and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview

## 4D-3B. Storage reference and purge safety foundation

- [x] Audit the private cover bucket, `contents.cover_image_path`, Draft/Review revisions, immutable version snapshot shapes, and existing Storage policies
- [x] Add a server-maintained reference ledger for content projections, active revisions, and immutable version/checkpoint references
- [x] Backfill existing references and synchronize future owner writes through transaction-local database triggers without changing lifecycle RPCs
- [x] Add ordinary 30-day replacement quarantine, a separate failed-upload grace contract, and a post-commit permanent-deletion bypass marker
- [x] Add a service-role-only, fail-closed purge inspection contract that rechecks the ledger, projections, active revisions, versions, and elapsed quarantine
- [x] Define typed server repository, purge evaluation, and reconciliation scanner contracts without implementing a scanner, worker, or physical deletion
- [x] Remove direct browser-role Storage DELETE privilege while leaving the existing private bucket and all five Storage policy definitions unchanged
- [x] Add application tests and a rollback-only SQL integration test for reference protection, quarantine, deletion preservation, and direct-delete denial
- [ ] Apply the migration and execute the SQL integration test in Preview

## 4D-3C. Redirect contract hardening

- [x] Audit the existing `route_redirects` schema, route consumers, public route boundary, and content service
- [x] Add a typed server-only redirect domain, repository, service, and typed error contract
- [x] Add explicit 308 redirect type, optional reason, Keeper actor, and creation-time provenance
- [x] Reject external or malformed routes, self redirects, loops, and chains
- [x] Require a reserved source and an existing Published or Archived canonical target
- [x] Reject Draft, Review, deleted, missing, and redirect-source targets
- [x] Return the existing record for an identical command and a typed conflict for a different command on the same source
- [x] Add the narrow Keeper-only `create_route_redirect` RPC and revoke direct authenticated redirect graph writes
- [x] Preserve redirect RLS, anonymous table denial, Delete Foundation tombstones, and the existing public route resolver
- [x] Add application tests and a rollback-only SQL integration test
- [ ] Apply the migration and execute the SQL integration test in Preview

---

# Phase 5 — Core content administration

## 5A. Content list

- [x] List all lifecycle states
- [ ] Search content
- [ ] Filter by Region
- [ ] Filter by Content Type
- [ ] Filter by Growth Stage
- [ ] Filter by lifecycle
- [ ] Show last tended
- [ ] Show Featured
- [x] No bulk operations

## 5B. Create and edit

- [x] New Draft
- [x] Chinese fields
- [x] English fields
- [x] language mode
- [x] Region
- [x] Content Type
- [x] Detail Level
- [ ] fixed primary category selection
- [x] free tags
- [x] Growth Stage
- [ ] slug suggestion
- [ ] slug uniqueness check
- [ ] stable-slug warning after publication

## 5C. Markdown editor

- [ ] Markdown editing
- [ ] live preview
- [ ] mobile Edit/Preview switch
- [ ] heading helper
- [ ] bold helper
- [ ] italic helper
- [ ] quote helper
- [ ] list helper
- [ ] link helper
- [ ] no arbitrary HTML mode
- [ ] no page builder

## 5D. Autosave

- [ ] periodic autosave
- [ ] Saving state
- [ ] Saved state
- [ ] Save failed state
- [ ] retry behavior
- [ ] navigation warning for unsaved local changes
- [ ] autosave does not publish
- [ ] autosave does not create versions

## 5E. Keeper media workspace

- [x] Add Keeper-only `/admin/media` cover workspace
- [x] Show safe object path, bucket, usage counts, and lifecycle state
- [x] Map referenced, unreferenced, and quarantine-candidate awareness states
- [x] Validate JPEG, PNG, and WebP metadata with a 5 MiB server limit
- [x] Keep upload authorization and reference updates server-side
- [x] Replace Draft cover references with optimistic locking
- [x] Preserve the old object and reference lifecycle history
- [x] Keep Storage deletion, purge execution, and garbage collection unavailable
- [x] Add focused authorization, validation, upload, preservation, and mapping tests

Acceptance:

- [x] create Draft
- [x] edit Draft
- [ ] autosave Draft
- [x] recover from save failure
- [x] no public Draft exposure

---

# Phase 6 — Publication lifecycle, versions, preview, and deletion

## 6A. Review and publish

- [ ] Move Draft to Review
- [ ] Review checklist
- [ ] Validate required fields
- [ ] Validate image alt
- [ ] Validate slug
- [ ] Validate relations
- [ ] Publish
- [ ] Remove from publication safely
- [ ] Published item appears in correct Region
- [ ] Published item appears in Index
- [x] Published item appears in sitemap

## 6B. Archive and delete

- [x] Archive Published item
- [ ] Remove Archived item from discovery
- [ ] Render resting-state route
- [x] Restore Archived item
- [x] Show permanent delete only in Archived
- [x] Show relation/version/image impact
- [x] Require second confirmation
- [ ] Clean relations safely
- [ ] Clean unused Storage object
- [ ] Deleted route returns designed 404/Gone

## 6C. Version history

- [ ] Manual checkpoint
- [ ] Publish snapshot
- [ ] Restore snapshot
- [ ] Preserve current version before restore
- [ ] Maximum 10 versions
- [ ] Cover reference included
- [ ] Version list accessible

## 6D. Secure preview

- [ ] Generate preview token
- [ ] Copy preview link
- [ ] Preview uses real detail layout
- [ ] Show Preview Mode indicator
- [ ] Revoke token
- [ ] Regenerate token
- [ ] `noindex`
- [x] Exclude from sitemap
- [ ] Token gives no edit access

Acceptance:

- [ ] full lifecycle works
- [ ] version restore works
- [ ] preview is private
- [ ] Archived and Deleted behavior matches spec

---

# Phase 7 — Growth, relations, cover images, Featured, and Home curation

## 7A. Growth

- [ ] Change Growth Stage
- [ ] Require Growth Note
- [ ] Chinese Growth Note
- [ ] English Growth Note
- [ ] public/private toggle
- [ ] update `lastTendedAt` only for meaningful tending
- [ ] public Growth Timeline

## 7B. Relations

- [ ] Add `grewFrom`
- [ ] Add `grewInto`
- [ ] Add `relatedTo`
- [ ] Select existing content only
- [ ] prevent self-relation
- [ ] prevent duplicate relation
- [ ] archived-target handling
- [ ] concise public display

## 7C. Cover image

- [ ] Upload
- [ ] Replace
- [ ] Remove
- [ ] alt validation
- [ ] card integration
- [ ] detail integration
- [ ] fallback text-first layout
- [ ] Open Graph image integration

## 7D. Featured

- [ ] Toggle Featured
- [ ] Enforce maximum 3 per Region
- [ ] Region ordering
- [ ] Do not auto-feature by views

## 7E. Home curation

- [ ] Currently Growing candidate suggestions
- [ ] manual confirmation
- [ ] 3–4 item limit
- [ ] Recently Planted candidate suggestions
- [ ] manual confirmation
- [ ] 2 item limit
- [ ] prevent duplicate item across both slots
- [ ] manual order
- [ ] Home reads canonical data

Acceptance:

- [ ] public Growth Timeline correct
- [ ] relations correct
- [ ] cover is optional and accessible
- [ ] Home updates without code edits
- [ ] no duplicated Home content data

---

# Phase 8 — Public discovery and navigation upgrade

## 8A. Merge Index and Search

- [ ] Make `/index` canonical
- [ ] Add keyword search
- [ ] Search Chinese titles/summaries
- [ ] Search English titles/summaries
- [ ] Search tags
- [ ] Search primary categories
- [ ] Region filter
- [ ] Content Type filter
- [ ] Growth Stage filter
- [ ] Recently planted filter
- [ ] Recently tended filter
- [ ] default recently tended sort
- [ ] public Published only
- [ ] retain empty state

## 8B. `/search` compatibility

- [ ] Redirect or rewrite `/search`
- [ ] Preserve `q`
- [ ] Preserve supported filters
- [ ] Focus search input
- [ ] Remove duplicate implementation
- [ ] update Garden Guide
- [ ] update TopBar search link

## 8C. Path Back Navigation

- [ ] Detail-page back control
- [ ] source-aware return when reliable
- [ ] Region fallback
- [ ] Index fallback
- [ ] no dead back action
- [ ] mobile visibility
- [ ] keyboard accessibility
- [ ] lightweight path context only

## 8D. Archived, empty, and 404 states

- [ ] designed 404
- [ ] archived resting state
- [ ] empty search
- [ ] empty Saved Paths
- [ ] empty Recently Visited
- [ ] Greenhouse error
- [ ] save error
- [ ] upload error
- [ ] unauthorized state
- [ ] clear next actions
- [ ] approved copy only

Acceptance:

- [ ] `/index` covers discovery and search
- [ ] `/search` remains valid
- [ ] visitors can recover their path
- [ ] all states remain understandable

---

# Phase 9 — Greenhouse V2 integration

## 9A. Preserve V1 behavior

- [ ] Keep `/api/seed-gardener`
- [ ] Keep server-side key
- [ ] Keep `deepseek-v4-flash`
- [ ] Keep schema validation
- [ ] Keep timeout
- [ ] Keep safe error mapping
- [ ] Keep Forest prefill

## 9B. Garden Keeper configuration

- [ ] Edit system prompt
- [ ] Edit output-style guidance
- [ ] Edit example input
- [ ] Edit example output
- [ ] Keep code-enforced schema
- [ ] Prevent API key editing
- [ ] Prevent model editing
- [ ] Prevent endpoint editing
- [ ] Prevent timeout editing
- [ ] Version or audit important prompt changes

## 9C. Draft handoff

- [ ] Explicit save-to-Draft action
- [ ] No silent Draft creation from anonymous use
- [ ] Save source idea
- [ ] Save AI result
- [ ] lifecycle = Draft
- [ ] review before publish
- [ ] editable Region
- [ ] editable Content Type
- [ ] editable Growth Stage
- [ ] no automatic relations
- [ ] no automatic Home placement

Acceptance:

- [ ] public Greenhouse still works
- [ ] explicit Draft handoff works
- [ ] AI never publishes
- [ ] anonymous use cannot spam Garden Keeper silently

---

# Phase 10 — Visitor features

## 10A. Leave a note

- [ ] Public form
- [ ] optional name
- [ ] required message
- [ ] validation
- [ ] sanitization
- [ ] rate limiting
- [ ] spam protection
- [ ] success state
- [ ] error state
- [ ] private storage
- [ ] admin list
- [ ] read/unread
- [ ] delete
- [ ] no public comments
- [ ] no reply system

## 10B. Saved Paths

- [ ] outlined star default
- [ ] filled yellow star saved
- [ ] `aria-pressed`
- [ ] keyboard support
- [ ] visible focus
- [ ] save/remove feedback
- [ ] localStorage only
- [ ] current-device disclosure
- [ ] Garden Index section
- [ ] Garden Guide shortcut

## 10C. Recently Visited

- [ ] localStorage only
- [ ] 5–10 item limit
- [ ] update last visited
- [ ] manual clear
- [ ] hide unavailable content
- [ ] Garden Index section
- [ ] optional Garden Guide shortcut
- [ ] not a Home section

## 10D. Sharing

- [ ] Web Share API
- [ ] copy-link fallback
- [ ] completion feedback
- [ ] no social counts
- [ ] no identity tracking

Acceptance:

- [ ] visitor features work without accounts
- [ ] local data stays local
- [ ] notes remain private

---

# Phase 11 — Analytics, SEO, import, export, and settings

## 11A. Anonymous analytics

- [ ] page views
- [ ] Region views
- [ ] content views
- [ ] Greenhouse use count
- [ ] note submission count
- [ ] share-click count
- [ ] no stored IP
- [ ] no visitor profile
- [ ] no full browsing trail
- [ ] Garden Keeper analytics view

## 11B. SEO and Open Graph

- [x] dynamic title
- [x] dynamic description
- [x] bilingual fallback
- [x] content-level Open Graph
- [x] cover-image OG
- [x] fallback OG image
- [x] sitemap Published only
- [x] exclude Draft
- [x] exclude Review
- [x] exclude Archived
- [x] exclude Admin
- [x] exclude Preview
- [x] archived `noindex`
- [ ] preview `noindex`

## 11C. Markdown import

- [ ] single-file upload
- [ ] frontmatter parsing
- [ ] validation
- [ ] Draft creation
- [ ] error report
- [ ] no auto-publish
- [ ] no auto-relations
- [ ] no folder sync

## 11D. Export

- [ ] JSON export
- [ ] Markdown export
- [ ] Published-only option
- [ ] include Draft option
- [ ] include Archived option
- [ ] optional versions in JSON
- [ ] cover reference export
- [ ] no automatic GitHub commit

## 11E. Fixed site copy settings

- [ ] approved Home fields
- [ ] approved About fields
- [ ] approved Region descriptions
- [ ] approved ending copy
- [ ] approved Footer copy
- [ ] approved CTA fields
- [ ] prevent Region-name editing
- [ ] prevent route editing
- [ ] prevent layout editing
- [ ] prevent security-warning editing

Acceptance:

- [ ] analytics respect privacy
- [ ] SEO preview correct
- [ ] import creates safe Draft
- [ ] export is usable
- [ ] settings cannot alter structure

---

# Phase 12 — Visual, mobile, accessibility, and performance review

## 12A. Visual

- [x] Preserve V1 regional moods
- [x] Improve card hierarchy
- [ ] Integrate optional cover images
- [x] Improve detail hierarchy
- [x] Improve Growth Stage display
- [x] Improve Growth Timeline
- [x] Improve relation display
- [ ] Add restrained Home status hints
- [x] No full visual replacement

## 12B. Mobile

- [x] Home path list
- [x] detail reading order
- [x] Garden Index filters
- [ ] Saved/Recent sections
- [x] Greenhouse input/results
- [ ] admin basic use
- [x] touch target sizes
- [x] no horizontal overflow

## 12C. Accessibility

- [x] semantic heading order
- [x] skip link
- [x] keyboard navigation
- [x] visible focus
- [ ] accessible dialogs
- [x] accessible form labels
- [x] live regions
- [ ] star state not color-only
- [x] image alt
- [x] status icon + text
- [x] reduced motion
- [x] no essential hover-only information

## 12D. Performance

- [ ] image optimization
- [ ] sensible caching
- [x] no excessive client-side data
- [x] no unnecessary animation dependency
- [ ] no repeated database queries
- [ ] loading and error boundaries
- [x] production bundle review

Acceptance:

- [x] desktop and mobile QA pass
- [x] keyboard QA pass
- [x] reduced-motion QA pass
- [x] no horizontal overflow
- [x] public pages remain content-first

---

# Phase 13 — Production migration and launch

## 13A. Production preparation

- [ ] Freeze Production content edits during final migration window
- [ ] Back up V1 content data
- [ ] Back up Supabase Production
- [ ] Verify Production environment variables
- [ ] Verify GitHub OAuth callback
- [ ] Verify Storage policies
- [ ] Verify RLS
- [ ] Verify DeepSeek key
- [ ] Verify redirects

## 13B. Production import

- [ ] Run migration once
- [ ] Verify 19-item count
- [ ] Verify all slugs
- [ ] Verify all routes
- [ ] Verify all summaries
- [ ] Verify detail bodies
- [ ] Verify relations
- [ ] Verify Home curation
- [ ] Verify Search/Index
- [ ] Verify sitemap

## 13C. Launch checks

- [ ] lint
- [ ] typecheck
- [ ] production build
- [ ] existing tests
- [ ] new content tests
- [ ] auth tests
- [ ] permission tests
- [ ] migration tests
- [ ] route smoke tests
- [ ] Greenhouse tests
- [ ] note tests
- [ ] accessibility audit
- [ ] mobile QA
- [ ] reduced-motion QA
- [ ] SEO/OG QA

## 13D. Cutover and cleanup

- [ ] Switch public reads to database
- [ ] Keep temporary static fallback until acceptance
- [ ] Monitor errors
- [ ] Confirm routine admin update appears without deployment
- [ ] Confirm Production notes
- [ ] Confirm Production analytics
- [ ] Remove static fallback only after approval
- [ ] Preserve V1 documents
- [ ] Update README for V2 operation
- [ ] Record final migration result in `V2_MIGRATION.md`

Acceptance:

- [ ] V2 Production stable
- [ ] all existing public links valid
- [ ] Garden Keeper can publish without coding
- [ ] no data leak
- [ ] no V1 feature regression
- [ ] fallback removal explicitly approved

---

# Final acceptance matrix

## Product

- [ ] The Garden still feels like the same world
- [ ] no new Region
- [ ] not converted into a résumé, portfolio, blog, or community
- [ ] Home remains curated
- [ ] content remains primary

## Content

- [ ] dynamic creation works
- [ ] lifecycle works
- [ ] Growth Stage works
- [ ] Growth Notes work
- [ ] relations work
- [ ] cover image optional
- [ ] bilingual fields optional
- [ ] 19 V1 items preserved

## Admin

- [ ] GitHub single-admin auth
- [ ] Markdown editor
- [ ] live preview
- [ ] secure preview
- [ ] autosave
- [ ] 10-version history
- [ ] archive/restore/delete
- [ ] Home curation
- [ ] AI settings within limits

## Visitor

- [ ] merged Index/Search
- [ ] Path Back Navigation
- [ ] public Growth Timeline
- [ ] private note form
- [ ] local Saved Paths
- [ ] local Recently Visited
- [ ] lightweight sharing
- [ ] designed states

## Engineering

- [ ] Preview and Production isolated
- [ ] Supabase RLS correct
- [ ] no secret client-side
- [ ] old URLs preserved
- [ ] `/search` compatible
- [ ] Greenhouse API preserved
- [ ] tests pass
- [ ] build passes
- [ ] accessibility passes
