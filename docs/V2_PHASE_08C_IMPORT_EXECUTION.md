# The Garden V2 — 08C Import Execution

Task: `08C. Execute Import`  
Implementation date: `2026-07-18`  
Scope: import execution boundary only  
Production import executed: **no**  
Preview import executed: **no**  
Source mode changed: **no**

## Outcome

The existing Preview-only V1 import path now consumes the complete Task 08B
approved migration snapshot. Import remains blocked while the checked-in Task
08A resolution input is incomplete or the snapshot is not `READY`. No
resolution, successful receipt, or imported data was fabricated.

The execution contract exposes four safety states:

- `BLOCKED` for missing approval, stale digests, unresolved blockers, or an
  incompatible schema;
- `READY` after the full preflight passes and before any write;
- `SUCCESS` only for a committed, post-write-verified receipt;
- `FAILED` when the atomic boundary rejects or rolls back execution.

## Preflight and idempotency

`scripts/content-v1/executor.ts` validates the snapshot self-digest, explicit
snapshot digest, Preview digest, resolution digest, source digest, destination
digest, all Growth Stage approvals, blocker count, record completeness, and
schema version. It regenerates the approved artifact from current inputs before
constructing a payload.

A receipt lookup occurs before destination preparation. Replaying the same
approved snapshot digest returns the original `SUCCESS` receipt with
`idempotent: true`; it does not call the write boundary again. Existing V1
identities without that receipt remain a blocking conflict.

## Atomic import and receipt

The service-role-only `execute_v1_import(jsonb)` RPC remains one PostgreSQL
transaction. It creates contents, one immutable initial content version per
record, explicit relations, tags, content-tag bindings, and supported metadata.
Stable V1 `legacy_id`, slug, and relation identities are preserved; internal
UUIDs remain database identities and are never used as retry keys.

The durable JSON receipt includes `SUCCESS`, snapshot, Preview, and resolution
digests, technical timestamp, imported count, created identities, warnings,
and verification results. It is inserted only after verification passes.
Exceptions roll back content, child metadata, versions, and the receipt.

## Verification

The transaction now applies the same required checks surfaced by the existing
migration verification framework:

- exact content and initial-version counts;
- unique and exact approved slug identity;
- exact Region identity;
- Published lifecycle validity;
- exact relation resolution and count;
- one matching initial version per imported identity.

Any failure raises `post_import_verification_failed`, prevents `SUCCESS`, and
rolls back the transaction. The later read-only full migration verification
remains required after an actual approved Preview import.

## Safety and current state

The canonical resolution file still contains no real editorial approvals, so
the repository's real import state remains `BLOCKED`. This task did not invoke
the import command, connect to Supabase, change public routes, modify Admin UI,
alter lifecycle rules, or change `CONTENT_SOURCE_MODE`.

## Change manifest

Modified files:

- `docs/V2_MIGRATION.md`
- `docs/V2_PHASE_06C_IMPORT_EXECUTION.md`
- `docs/V2_TODO.md`
- `scripts/content-v1/executor.ts`
- `scripts/content-v1/import.ts`
- `scripts/content-v1/migration-verification.ts`
- `supabase/migrations/20260717190000_phase_06c_v1_import_execution.sql`
- `supabase/tests/phase_06c_v1_import_execution.sql`
- `tests/content-v1-import-execution.test.ts`
- `tests/content-v1-migration-verification.test.ts`
- `types/content.ts`

New files:

- `docs/V2_PHASE_08C_IMPORT_EXECUTION.md`

Migrations created:

- None. The existing unapplied Phase 06C import migration was strengthened;
  no database migration or import was executed.
