# The Garden V2 — 06C Import Execution

Task: `06C. Import Execution`
Implementation date: `2026-07-17`
Scope: migration execution boundary only
Database import executed: **no**

## Outcome

A Preview-only execution path is implemented, but no database content was
written. Execution correctly remains impossible without a real approved
preview snapshot and the five real manual Lake Growth Stage approvals.

No public route, Admin UI, lifecycle service, public source mode, Storage
policy, V1 content module, or existing content row was changed manually.

## Execution boundary

`scripts/content-v1/executor.ts` is the reusable preflight and orchestration
boundary. Task 08B strengthens it to require:

- an existing, structurally complete approved migration snapshot containing
  the frozen records, mappings, relations, warnings, and resolution audit;
- a separately supplied snapshot digest matching that artifact;
- the exact resolution input used by the approved preview;
- unchanged extracted source state;
- an unchanged destination content snapshot;
- complete validation, resolved blockers, and import-ready records.

The executor regenerates the full approval artifact using current inputs and
the recorded approval timestamp. It rejects modified, stale, blocked, or
incompletely approved input before constructing the frozen import payload.
It also rejects an existing V1 migration identity when no matching immutable
import receipt proves that the import already completed.

`scripts/content-v1/import.ts` is the only database adapter. It requires both
`--execute` and `--preview`, rejects `--production`, uses a server-only Supabase
secret, and calls only the narrow `execute_v1_import` RPC for writes.

## Atomic database command

Migration `20260717190000_phase_06c_v1_import_execution.sql` adds:

- an immutable `v1_migration_imports` digest receipt table;
- a service-role-only `execute_v1_import(jsonb)` function;
- advisory transaction serialization per import digest;
- independent database validation for envelope, counts, identities, Growth
  Stage approvals, tags, content-tag links, relations, and destination state;
- atomic creation of content, supported metadata, relations, and one initial
  immutable version per content;
- post-write count, slug uniqueness, relation integrity, lifecycle, and version
  checks before the receipt is committed.

The function is one PostgreSQL statement transaction. Any exception rolls back
all content, child, version, and receipt writes. Replaying the same digest
returns its stored result and performs no new writes.

## Mapping and provenance

The executor preserves the approved transform fields for `contents`, including
title, slug, Region, Content Type, Detail Level, Published migration lifecycle,
Growth Stage, summaries, bodies, language, primary categories, cover metadata,
Featured, manual order, and approved nullable editorial timestamps.

Initial `content_versions.snapshot` values include projection, tag, relation,
Growth Note, cover, and migration sections. Migration provenance records the V1
identity, source version, source digest, import digest, and applicable manual
Growth Stage approval metadata.

Current V1 has no structured tags or Growth Note rows. Empty collections are
preserved as empty. The prose section titled “Growth notes” remains in the
Markdown body; it is not duplicated or converted into invented structured
history.

## Reports and verification

The human report lists created contents, versions, relations, skipped records,
warnings, and verification checks. The machine result includes:

- import digest;
- technical import timestamp;
- source and schema version;
- created and skipped identities;
- warnings;
- content-count, slug, relation, lifecycle, and overall verification results.

No public cutover hook is called.

## Tests

Application tests cover:

- missing/invalid approval rejection;
- explicit digest mismatch rejection;
- duplicate execution idempotency;
- no partial in-memory boundary commit after an injected failure;
- unique, resolvable relation payloads;
- one initial version per imported content;
- service-role-only and transactional SQL structure.

`supabase/tests/phase_06c_v1_import_execution.sql` is a rollback-only Preview
integration test. It forces the first V1 version insert to fail after all 19
content inserts have been staged, then verifies that no fixture content or
receipt survives. It was provided but not executed without a configured and
migrated Preview database runtime.

## Execution status

The import was not executed and no success report was fabricated. The current
repository contains no real approval snapshot or complete real Growth Stage
resolution file. Apply the migration, run the rollback-only SQL test, obtain
the five real approvals, regenerate and approve a Preview snapshot, and only
then invoke `npm run content:v1:import`.

## Change manifest

Modified files:

- `.env.example`
- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `package.json`
- `scripts/content-v1/apply.ts`
- `tests/content-v1-preview.test.ts`
- `types/content.ts`

New files:

- `docs/V2_PHASE_06C_IMPORT_EXECUTION.md`
- `scripts/content-v1/executor.ts`
- `scripts/content-v1/import.ts`
- `supabase/tests/phase_06c_v1_import_execution.sql`
- `tests/content-v1-import-execution.test.ts`

Migrations created:

- `supabase/migrations/20260717190000_phase_06c_v1_import_execution.sql`
