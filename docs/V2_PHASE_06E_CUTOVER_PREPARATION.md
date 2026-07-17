# The Garden V2 — 06E Cutover Preparation

Task: `06E. Cutover Preparation`

Preparation date: `2026-07-17`

Scope: cutover plan, deterministic gates, and operator runbook

Source mode changed: **no**

Import executed: **no**

Database queried or written: **no**

## Outcome

The V1 to V2 cutover is prepared but **not ready to execute**. The machine
contract in `scripts/content-v1/cutover-readiness.ts` fixes checklist ordering,
forward source-mode transitions, and rollback triggers. Every readiness item is
blocking.

No public route, content service, lifecycle service, Admin UI, Storage code,
database data, V1 content, or Production behavior changed in this phase.

## 1. Deterministic readiness checklist

An operator records evidence for every item and evaluates the complete set as
one immutable cutover record. Checks always appear in the order below. `READY`
means every check is `PASS`; otherwise the result is `BLOCKED` and source mode
must remain unchanged.

### Data readiness

| ID | Required evidence | Pass condition |
| --- | --- | --- |
| `approved_preview_exists` | Approved snapshot envelope and preview digest | The final preview is import-ready, explicitly approved, and its digest is recorded. |
| `import_completed` | Immutable Phase 06C `v1-import-result` receipt | The receipt matches the approved preview digest and reports a completed transaction. |
| `verification_passed` | Phase 06D machine report | `PASS`, or `WARNING` with explicit acceptance of the exact warnings. `FAIL` always blocks. |
| `counts_match` | Phase 06D count checks | Total 19; Garden 5; Forest 5; Lake 5; Ruins 4; Content Type totals match the approved preview. |
| `slugs_verified` | Phase 06D identity and route manifest checks | Every `legacy_id`, Region, and slug matches; there are no missing, duplicate, or unexpected routes. |
| `relations_verified` | Phase 06D relation section | Counts, endpoints, types, lifecycle, and orphan checks pass. |
| `versions_verified` | Phase 06D version section | Every item has exactly one immutable initial `V1 import` version with complete provenance. |

### Application readiness

| ID | Required evidence | Pass condition |
| --- | --- | --- |
| `database_source_mode_available` | Deployment configuration preflight | `CONTENT_SOURCE_MODE=database` is accepted by the deployed build; do not set it during preparation. |
| `public_resolver_compatible` | Resolver contract tests plus Preview route probes | Collections, details, Home curation, Index, Search, metadata, and sitemap retain their public shape. |
| `cache_invalidation_ready` | Tested invalidation procedure | Route, metadata, sitemap, and search caches can be invalidated during cutover and rollback. The existing hook is a contract, not proof of infrastructure. |
| `rollback_possible` | Tested deployment/configuration procedure | An operator can restore `CONTENT_SOURCE_MODE=legacy` without deleting V2 data. |

### Operational readiness

| ID | Required evidence | Pass condition |
| --- | --- | --- |
| `backup_confirmed` | Timestamped repository/V1 snapshot and restorable Supabase backup | Backup owner, location, restore method, and restore check are recorded before import. |
| `monitoring_available` | Dashboard and alert links with owner | Lookup failures, fallback count, 404s, duplicates, metadata, Search/Index, cache, database, and authorization failures are observable. |
| `failure_recovery_documented` | This runbook plus incident contacts and access check | The cutover operator can restore source mode, preserve evidence, and invalidate caches. |

### Safety readiness

| ID | Required evidence | Pass condition |
| --- | --- | --- |
| `redirects_verified` | Baseline URL/redirect manifest and Preview probes | Every old URL returns the expected published, archived, redirected, or not-found disposition with no loop or chain. |
| `archived_behavior_verified` | Phase 06D controls and route-boundary tests | Archived content is absent from discovery, receives only the resting response, and cannot be resurrected by legacy fallback. |
| `public_read_compatibility_verified` | Phase 06D public probes and route smoke matrix | Published items render; Draft/Review remain not found; Archived remains non-discoverable; no private/editorial fields leak. |

### Warning policy

A Phase 06D `WARNING` is not silently treated as a pass. The operator must
record the report digest, each accepted warning, approver, reason, and approval
time. Any unaccepted warning blocks cutover. A `FAIL` cannot be waived.

### Current assessment

Current state: **BLOCKED**.

The repository proves that the three source modes exist and supplies resolver,
Archived, redirect-command, import, and verification contract tests. It does
not prove a real approved preview, completed Preview import, real Phase 06D
verification, restorable Production backup, operational monitoring, working
cache invalidation, or complete Preview URL probes. In particular, the current
invalidation hook describes targets but explicitly does not provide cache or
index infrastructure. Redirect command safety tests do not replace a full
public URL/redirect cutover probe.

## 2. Source-mode transition design

```text
Legacy mode
    ↓ all readiness checks + approved window
Dual mode
    ↓ stability period + zero fallback + healthy monitoring + parity + approval
Database mode
```

Direct `legacy -> database` cutover is forbidden.

### Legacy mode

Current default when `CONTENT_SOURCE_MODE` is absent. Public reads use V1 static
content and do not require the database repository.

Prerequisites to leave:

- every readiness check passes;
- the freeze is active and the operator approves the window;
- the exact rollback deployment/configuration procedure is tested.

Risks on entry to Dual:

- database and legacy projections can diverge or duplicate;
- an invalid fallback decision can expose an Archived/private route;
- current Dual Home curation deliberately has no V1 fallback, so its database
  rows must be verified before the transition;
- cache state can retain stale source results.

Rollback condition: any condition in section 3, or invalidated readiness
evidence before the transition completes.

### Dual mode

Database Published content is primary. The legacy source fills only routes the
repository identifies as unmigrated. A database Archived disposition suppresses
legacy fallback. Draft and Review remain not found. Duplicate migrated routes
must not be emitted.

Prerequisites to leave for Database:

- the checklist is still fully passing;
- the accepted Dual stability period is complete;
- observed legacy fallback count is zero;
- monitoring is healthy;
- all 19 records and public surfaces are reverified after the stability period;
- explicit final approval is recorded.

Risks on entry to Database:

- any unrecognized unmigrated route loses its fallback;
- database, resolver, or cache failure affects every public read;
- rollback remains deployment/configuration dependent.

Rollback condition: any section 3 condition, any fallback demand, or any parity
regression.

### Database mode

All public reads use V2. V1 remains preserved as an incident fallback until a
separate, explicit fallback-retirement acceptance. Phase 06E does not authorize
that retirement or deletion of V1 content.

## 3. Rollback plan

Rollback is required when any of these conditions is observed:

- verification regresses or evidence no longer matches the active deployment;
- public-read failures exceed the operator's predeclared threshold;
- unexpected 404, redirect, loop, or route disposition appears;
- duplicate items or Search/Index/discovery mismatches appear;
- Draft, Review, private fields, or an incorrect Archived response becomes public;
- the database or resolver is unavailable;
- cache state is incoherent after invalidation;
- the incident operator calls a stop.

Rollback sequence:

1. Stop the cutover and record time, deployment, active mode, report digests,
   symptoms, and monitoring links.
2. Restore `CONTENT_SOURCE_MODE=legacy` using the pretested configuration or
   deployment procedure.
3. Confirm V1 public fallback is serving the baseline route manifest.
4. Preserve all imported V2 data, receipts, snapshots, logs, and backups for
   diagnosis. Do not rerun import and do not delete or edit V2 rows during the
   incident.
5. Keep the V1 source and fallback deployable.
6. Invalidate route, metadata, sitemap, search, and deployment/CDN caches.
7. Run the public smoke matrix, including redirects and Archived/Draft/Review
   controls, and confirm monitoring returns to baseline.
8. Announce rollback status and leave cutover blocked until a new preview,
   approval, verification, and operator decision are recorded.

If a future incident occurs after V1 fallback retirement, recover from the
preserved database backup, JSON export, migration fixture, Git repository, and
deployment history. Fallback retirement is outside this task.

## 4. Final migration runbook

Each step has a hard stop. The operator must not continue when its exit evidence
is missing. Commands below are for a future approved window; none were run in
Phase 06E.

### 1. Freeze V1 changes

- Name the cutover lead, backup operator, approver, and incident channel.
- Record freeze start/end in UTC, repository commit, deployment ID, current
  `CONTENT_SOURCE_MODE`, Preview/Production project identifiers, and thresholds.
- Reject content, lifecycle, curation, redirect, and source-file changes during
  the window.
- Capture the baseline 19-item route/redirect manifest and V1 static snapshot.

Exit: freeze acknowledged, baseline artifacts stored, and rollback access
confirmed.

### 2. Generate final preview

Collect a read-only destination snapshot and the approved manual Growth Stage
resolution input, then run:

```bash
npm run content:v1:dry-run -- \
  --preview \
  --existing=tmp/v1-production-existing.json \
  --resolutions=tmp/v1-growth-stage-resolutions.json \
  --output=tmp/v1-final-preview.json
```

Exit: `importReady=true`, zero blockers/failures, expected 19/5/5/5/4 counts,
and source/destination/preview digests recorded.

### 3. Approve snapshot

- Compare the final preview with the frozen baseline and resolution provenance.
- Record approver, approval time, exact preview digest, and approval envelope.
- Reject and restart at step 2 if source or destination state changes.

Exit: exact snapshot approval exists and its digest matches the preview.

### 4. Execute import

Use the separate Phase 06C command only in the authorized target environment:

```bash
npm run content:v1:import -- \
  --execute \
  --preview \
  --approval=tmp/v1-approved-snapshot.json \
  --digest=sha256:<approved-preview-digest> \
  --resolutions=tmp/v1-growth-stage-resolutions.json \
  --output=tmp/v1-import-result.json
```

Exit: one committed immutable receipt matches the approved digest; transaction
verification passes. On failure, preserve output and stop—do not switch reads.

### 5. Verify

Collect the migration-scoped, read-only V2 query/public-probe snapshot and run:

```bash
npm run content:v1:verify-migration -- \
  --report=tmp/v1-import-result.json \
  --preview=tmp/v1-final-preview.json \
  --queries=tmp/v1-v2-query-results.json \
  --output=tmp/v1-migration-verification.json
```

Evaluate the full readiness contract. A `FAIL` or unaccepted `WARNING` blocks
cutover. Confirm URL/redirect, Archived, public-read, Home, Index, Search,
metadata, sitemap, and cache evidence outside the migration row checks.

Exit: checklist status `READY` and operator sign-off recorded.

### 6. Enable V2 reads

- Change only from `legacy` to `dual` in the controlled deployment procedure.
- Record deployment ID, operator, time, and evidence bundle.
- Smoke-test every public surface and compare counts/routes to the baseline.
- Do not advance directly to `database`.

Exit: Dual smoke checks pass and monitoring is healthy.

### 7. Monitor

Observe the defined stability period for lookup failures, fallback use, 404s,
redirects, duplicates, Archived/private exposure, Home, Search/Index, metadata,
sitemap, caches, database health, Greenhouse, and admin authorization.

Advancing to `database` requires zero fallback use, healthy monitoring,
reverified parity, and explicit approval. Otherwise remain in Dual or roll back.

### 8. Roll back if required

When any section 3 condition occurs, execute the rollback sequence immediately.
Rollback restores source mode and invalidates caches while preserving V2 data
and the V1 fallback.

## 5. Safety-check matrix

| Surface | Existing supporting contract | Required cutover proof | Current state |
| --- | --- | --- | --- |
| Redirects | Typed one-hop 308 command, loop/chain and unsafe-target rejection tests | Probe the complete frozen URL/redirect manifest through the deployed public boundary | Blocked pending probes |
| Archived | Database resting DTO, discovery exclusion, and Dual fallback suppression tests | Phase 06D Archived control plus full deployed route/discovery checks | Blocked pending real verification |
| Public reads | Legacy/Dual/Database resolver and lifecycle boundary tests | All 19 Published probes plus Draft/Review controls; Home, Index, Search, metadata, and sitemap parity | Blocked pending real verification |

No implementation is altered to close these operational evidence gaps in 06E.

## 6. Tests

The Phase 06E suite verifies:

- exact checklist completeness and ordering;
- a failed verification blocks cutover;
- warnings require explicit acceptance;
- only `legacy -> dual -> database` forward transitions are permitted;
- Database mode requires complete Dual exit evidence;
- every rollback trigger restores Legacy, preserves V2/V1, and invalidates caches.

## Change manifest

Modified files:

- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `package.json`

New files:

- `docs/V2_PHASE_06E_CUTOVER_PREPARATION.md`
- `scripts/content-v1/cutover-readiness.ts`
- `tests/content-v1-cutover-readiness.test.ts`

Migrations created:

- None.
