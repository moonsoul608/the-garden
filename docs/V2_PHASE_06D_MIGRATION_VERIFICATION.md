# The Garden V2 — 06D Migration Verification

Task: `06D. Migration Verification`  
Implementation date: `2026-07-17`  
Scope: read-only post-import verification  
Database queried: **no**  
Database written: **no**

## Outcome

Deterministic migration verification tooling is implemented. It compares the
Phase 06C execution receipt and exact approved preview against a supplied,
migration-scoped V2 query snapshot. It cannot execute imports and contains no
Supabase client or database mutation path.

No content was imported or modified. Public source mode, public routes,
lifecycle services, Storage, Admin UI, the migration executor, V1 source data,
and database migrations were not changed.

## Verification coverage

The verifier reports `PASS`, `FAIL`, or `WARNING` for:

- execution receipt and approved preview agreement;
- total, Region, and Content Type counts;
- missing, duplicate, and unexpected content;
- stable source identity, slug, Region, and lifecycle;
- blocked-record exclusion;
- Growth Stage and complete structured metadata through the approved record
  digest contract;
- Growth Notes, tags, and content-tag bindings;
- exactly one initial `V1 import` version per migrated item;
- immutable snapshot content and migration provenance;
- relation count, source/target identities, orphan detection, and Published
  endpoint lifecycle;
- unchanged public-service behavior for Published, Archived, Draft, and Review.

Existing compatibility warnings remain warnings. Missing Archived, Draft, or
Review control probes also produce warnings because absence of evidence is not
reported as a compatibility pass. Any observed mismatch produces a failure.

## Reports

The machine report includes:

- verification status and section statuses;
- deterministic SHA-256 verification digest;
- query-capture timestamp;
- import and preview digests;
- check totals;
- every check, expected and actual value, message, and affected identities.

The human report prints the overall and per-section outcomes, digest, timestamp,
check count, and all warning/failure findings. A machine report with `FAIL`
causes the CLI to exit non-zero.

## Determinism

The report timestamp comes from the immutable V2 query snapshot rather than the
wall clock. Values and affected identities are canonicalized and sorted before
the report digest is computed. Equivalent input arrays therefore produce the
same report and digest regardless of query result order.

## Tests

The focused test suite covers:

- missing content detection;
- slug mismatch detection;
- relation target mismatch detection;
- missing initial version detection;
- deterministic output for equivalent reordered query results;
- the complete passing fixture with preserved compatibility warnings.

The fixture is synthetic and does not claim that a real Preview import occurred.

## Change manifest

Modified files:

- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `package.json`

New files:

- `docs/V2_PHASE_06D_MIGRATION_VERIFICATION.md`
- `scripts/content-v1/migration-verification.ts`
- `scripts/content-v1/verify-migration.ts`
- `tests/content-v1-migration-verification.test.ts`

Migrations created:

- None.
